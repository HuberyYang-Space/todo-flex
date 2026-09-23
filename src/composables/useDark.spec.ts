import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { isDark, toggleDark } from './useDark'

// index.html 的防闪烁脚本读的键必须就是 useDark() 写的键，对不上时它永远读到 null，刷新会先闪一帧系统主题
describe('防闪烁脚本与 useDark 的存储键', () => {
  it('index.html 读的键就是 useDark 写的键', async () => {
    localStorage.clear()

    toggleDark()
    await nextTick()
    const written = Object.keys(localStorage)

    expect(written, 'useDark() 应当把偏好写进 localStorage').not.toHaveLength(0)

    const html = readFileSync(path.resolve(import.meta.dirname, '../../index.html'), 'utf8')
    const read = html.match(/localStorage\.getItem\(['"]([^'"]+)['"]\)/)?.[1]

    expect(read, 'index.html 里应当有一段读 localStorage 的防闪烁脚本').toBeTruthy()
    expect(written).toContain(read)

    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain('classList.toggle(\'dark\'')

    void isDark
  })
})
