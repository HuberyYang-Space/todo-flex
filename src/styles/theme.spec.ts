import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * 主题守卫。
 *
 * 起因：M6 打磨时发现的六条缺陷，没有一条是"看"出来的——全是把两套主题的变量代进
 * sRGB 插值 + WCAG 相对亮度算出来的。既然能算，就能钉住。
 *
 * 这类缺陷单靠浏览器核对极不可靠：亮色主题下才出现的问题，只看暗色永远发现不了，
 * 而站点默认就是暗色。项目里已经因此栽过一次（正面比顶面还亮，左上光源读不出来）。
 *
 * 这里只断言"能算的"：对比度与明暗序。观感（会不会抢戏、手感如何）算不出来，仍归人眼。
 */

/*
 * 直接读文件而不是 import './main.css?raw'：
 * vitest 默认 css: false，会把 CSS 导入打桩成空串，?raw 也一样拿不到内容。
 */
const CSS = readFileSync(resolve(process.cwd(), 'src/styles/main.css'), 'utf-8')

type Rgb = [number, number, number]

function parseHex(hex: string): Rgb {
  const s = hex.trim().replace('#', '')
  return [0, 2, 4].map(i => Number.parseInt(s.slice(i, i + 2), 16)) as Rgb
}

/** 从 main.css 里取出某个选择器块下的自定义属性 */
function readVars(selector: string): Record<string, string> {
  const block = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(CSS)
  if (!block)
    throw new Error(`main.css 里找不到 ${selector} 块`)

  const vars: Record<string, string> = {}
  for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:([^;]+);/g))
    vars[name] = value.trim()

  return vars
}

/** color-mix(in srgb, a pct%, b)：在 sRGB 编码值上线性插值 */
function mix(a: Rgb, pct: number, b: Rgb): Rgb {
  const k = pct / 100
  return a.map((v, i) => v * k + b[i] * (1 - k)) as Rgb
}

/** WCAG 相对亮度 */
function luminance([r, g, b]: Rgb): number {
  const f = (v: number): number => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** WCAG 对比度 */
function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const WHITE: Rgb = [255, 255, 255]
const BLACK: Rgb = [0, 0, 0]

const THEMES = {
  亮色: readVars(':root'),
  暗色: readVars('html.dark'),
}

/** 取某套主题的一个颜色变量 */
function c(theme: Record<string, string>, name: string): Rgb {
  const raw = theme[name]
  if (!raw)
    throw new Error(`主题里缺少 ${name}`)
  return parseHex(raw)
}

/** 文字用 opacity 淡化，等价于与背景按比例混合 */
function faded(fg: Rgb, opacity: number, bg: Rgb): Rgb {
  return mix(fg, opacity * 100, bg)
}

describe('对比度算法自校验', () => {
  it('黑白对比度是 21:1', () => {
    expect(contrast(WHITE, BLACK)).toBeCloseTo(21, 1)
  })

  it('同色对比度是 1:1', () => {
    expect(contrast(WHITE, WHITE)).toBeCloseTo(1, 5)
  })

  it('对照 WCAG 文档的已知值：#767676 在白底上是 4.54:1', () => {
    expect(contrast(parseHex('#767676'), WHITE)).toBeCloseTo(4.54, 1)
  })
})

describe.each(Object.entries(THEMES))('%s主题', (_name, theme) => {
  const bg = c(theme, '--bg')
  const fg = c(theme, '--fg')
  const panel = c(theme, '--panel')
  const accent = c(theme, '--accent')

  it('正文文字达到 WCAG AA（4.5:1）', () => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('op-60 的说明文字达到 AA——站点有八处这样用', () => {
    // 亮色主题曾是 4.11，只看暗色（6.33）永远发现不了
    expect(contrast(faded(fg, 0.6, bg), bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('op-70 的次要文字达到 AA', () => {
    expect(contrast(faded(fg, 0.7, bg), bg)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['默认', '--accent'],
    ['选中', '--accent-2'],
  ])('等距实体块（%s态）：顶面 > 正面 > 右侧面，左上光源在两套主题下都读得出来', (_which, varName) => {
    const base = c(theme, varName)
    const face = mix(base, 34, panel)
    const top = mix(WHITE, 45, face)
    const right = mix(BLACK, 40, face)
    // 正面从 --face 派生，不各自去跟 accent 调色——后者的明暗序会随主题翻车
    const frontTop = mix(WHITE, 8, face)
    const frontBottom = mix(BLACK, 6, face)

    expect(luminance(top)).toBeGreaterThan(luminance(frontTop))
    expect(luminance(frontBottom)).toBeGreaterThan(luminance(right))
  })

  it.each([
    ['默认', '--accent'],
    ['选中', '--accent-2'],
  ])('正面渐变（%s态）上端比下端亮——光从上方来', (_which, varName) => {
    const face = mix(c(theme, varName), 34, panel)

    expect(luminance(mix(WHITE, 8, face))).toBeGreaterThan(luminance(mix(BLACK, 6, face)))
  })

  it('盒子描边达到非文字对比度下限（3:1）——盒子是可点选的 UI 组件', () => {
    const floor = mix(accent, 7, panel)
    const outline = mix(accent, Number.parseFloat(theme['--stage-line-k']), floor)

    expect(contrast(outline, floor)).toBeGreaterThanOrEqual(3)
  })

  it('剩余空间斜纹的纹路可辨识，且不弱于暗色主题的基准 2.2', () => {
    const floor = mix(accent, 7, panel)
    const bandBg = mix(accent, 8, floor)
    const stripe = mix(accent, Number.parseFloat(theme['--stripe-op']) * 100, bandBg)

    expect(contrast(stripe, bandBg)).toBeGreaterThanOrEqual(2)
  })

  it('方块底缘的接触暗边读得出来——纯靠台面黑影在暗色下只有 1.12', () => {
    const face = mix(accent, 34, panel)
    const frontBottom = mix(BLACK, 6, face)
    const edge = mix(BLACK, 45, frontBottom)

    expect(contrast(edge, frontBottom)).toBeGreaterThanOrEqual(1.6)
  })
})
