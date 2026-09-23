import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 读了就得有人定义，定义了就得有人读。
 * `var(--x, fallback)` 读不存在的变量不报错，只会静默走 fallback；反方向是零消费方。
 */

const ROOT = resolve(process.cwd())

/** shiki 把这两个变量写在每个 token 的行内样式上，定义方不在本仓库 */
const RUNTIME_PROVIDED = new Set(['--shiki-light', '--shiki-dark'])

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory())
      return sourceFiles(path)
    return /\.(?:vue|css|ts)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : []
  })
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function scan() {
  const reads = new Map<string, string[]>()
  const defs = new Map<string, string[]>()
  const note = (map: Map<string, string[]>, name: string, file: string) =>
    map.set(name, [...(map.get(name) ?? []), relative(ROOT, file)])

  for (const file of [...sourceFiles(join(ROOT, 'src')), join(ROOT, 'uno.config.ts')]) {
    const source = stripComments(readFileSync(file, 'utf-8'))
    for (const [, name] of source.matchAll(/var\(\s*(--[\w-]+)/g))
      note(reads, name, file)
    // 样式表里的声明，以及组件用 :style 下发的 '--x': … 键
    for (const [, name] of source.matchAll(/(?<![\w-])(--[\w-]+)\s*:/g))
      note(defs, name, file)
    for (const [, name] of source.matchAll(/'(--[\w-]+)'\s*:/g))
      note(defs, name, file)
  }

  return { reads, defs }
}

describe('css 自定义属性的读写闭合', () => {
  const { reads, defs } = scan()

  it('扫描器本身是活的：认得出一对已知的读与定义', () => {
    expect(reads.has('--accent')).toBe(true)
    expect(defs.has('--accent')).toBe(true)
    // 组件经 :style 下发、再由 <style> 读取的那一类也要认得出来
    expect(reads.has('--overhang')).toBe(true)
    expect(defs.has('--overhang')).toBe(true)
  })

  it('每一个被读取的变量都有定义方', () => {
    const undefinedVars = [...reads]
      .filter(([name]) => !defs.has(name) && !RUNTIME_PROVIDED.has(name))
      .map(([name, files]) => `${name} ← ${[...new Set(files)].join(', ')}`)

    expect(undefinedVars).toEqual([])
  })

  it('每一个被定义的变量都有读取方', () => {
    const unread = [...defs]
      .filter(([name]) => !reads.has(name))
      .map(([name, files]) => `${name} ← ${[...new Set(files)].join(', ')}`)

    expect(unread).toEqual([])
  })
})
