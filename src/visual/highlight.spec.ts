import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emitCss } from '~/core/cssEmit'
import { createDefaultState } from '~/core/defaults'
import { highlightCss } from './highlight'

/** WCAG 相对亮度 */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * 面板底色取自 main.css 而不是写死：代码块是贴在 `panel` 上的，
 * 主题变量一改，这里的判据就得跟着改，不该还在对着一个过期的常数算。
 */
function panelColors(): { light: string, dark: string } {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/main.css'), 'utf-8')
  const light = /:root\s*\{[\s\S]*?--panel:\s*(#[0-9a-f]{6})/i.exec(css)
  const dark = /html\.dark\s*\{[\s\S]*?--panel:\s*(#[0-9a-f]{6})/i.exec(css)
  expect(light, 'main.css 的 :root 里没找到 --panel').toBeTruthy()
  expect(dark, 'main.css 的 html.dark 里没找到 --panel').toBeTruthy()
  return { light: light![1].toLowerCase(), dark: dark![1].toLowerCase() }
}

/** 取双主题输出里每个 token 的两套颜色 */
function tokenColors(html: string, which: 'light' | 'dark'): string[] {
  const found = new Set<string>()
  for (const [, hex] of html.matchAll(new RegExp(`--shiki-${which}:(#[0-9a-fA-F]{6})`, 'g')))
    found.add(hex.toLowerCase())
  return [...found]
}

describe('highlightCss', () => {
  /*
   * 覆盖面尽量宽：取值越长、种类越多，能染到的 token 种类就越多。
   * 只拿默认状态去测，标点之外的 token 有好几种根本不会出现。
   */
  const state = createDefaultState()
  state.container.justifyContent = 'space-between'
  state.container.alignContent = 'space-between'
  state.container.direction = 'column-reverse'
  state.items[0].basis = 'calc(100% - 20px)'
  const sample = emitCss(state)

  it('把 CSS 切成 token，且每个 token 都带暗亮两套颜色', async () => {
    const html = await highlightCss(sample)

    expect(tokenColors(html, 'light').length, 'token 颜色太少，等于没高亮').toBeGreaterThan(2)
    expect(
      tokenColors(html, 'dark').length,
      '暗色配色缺失——单主题输出会让一套主题彻底读不了',
    ).toBeGreaterThan(2)
  })

  /*
   * 这条守卫钉的是「代码高亮在两套主题下都读得清」。
   *
   * 起因是实测：上一版选的 vitesse 在亮色面板（#ffffff）上有三个 token 够不着 AA——
   * 标点 #999999 只有 2.85、选择器名 #b07d48 3.58、属性名 #998418 3.70，
   * 而选择器名和属性名恰恰是这个站最该让人读清的两样东西。
   *
   * 这类缺陷只在亮色下出现，站点默认跟随系统，光看暗色永远发现不了；
   * 而「好不好看」没法自动判，「读不读得清」可以算——所以按算的来。
   * 换主题之前先跑这条，别挑完好看的再回头发现一套主题不达标。
   */
  it('两套主题下每个 token 对面板底色都够 AA 的 4.5', async () => {
    const html = await highlightCss(sample)
    const panel = panelColors()

    const offenders: string[] = []
    for (const theme of ['light', 'dark'] as const) {
      for (const color of tokenColors(html, theme)) {
        const ratio = contrast(color, panel[theme])
        if (ratio < 4.5)
          offenders.push(`${theme}: ${color} 贴在 ${panel[theme]} 上只有 ${ratio.toFixed(2)}:1`)
      }
    }

    expect(offenders, `这些 token 在面板底色上读不清：\n${offenders.join('\n')}`).toEqual([])
  })
})
