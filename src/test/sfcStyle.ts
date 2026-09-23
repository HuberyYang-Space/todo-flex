import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

/**
 * 读 SFC 的 `<style>`，按完整选择器取声明——供守卫型测试直接读被测对象本身，
 * 而不是把它的参数抄一份进测试（抄过去的常量不会跟着产品代码变，守卫就瞎了）。
 *
 * 选择器必须整串相等：前缀匹配下 `.stage-box` 会误中 `.stage-item:focus-visible .stage-box`。
 * 只认扁平规则，`@media` 里的同名规则会被当成另一条，调用方按需区分。
 */
export function readSfcStyle(path: string) {
  const sfc = readFileSync(resolve(process.cwd(), path), 'utf-8')
  const css = [...sfc.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map(([, body]) => body)
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')

  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector, body]) => ({ selector: selector.trim().replace(/\s+/g, ' '), body }))

  function decl(selector: string, prop: string): string {
    for (const rule of rules) {
      if (rule.selector !== selector)
        continue
      const hit = new RegExp(`(?:^|;)\\s*${prop.replace(/-/g, '\\-')}\\s*:([^;]+);`).exec(rule.body)
      if (hit)
        return hit[1].trim().replace(/\s+/g, ' ')
    }
    throw new Error(`${path} 里找不到 ${selector} { ${prop} }`)
  }

  return { decl }
}
