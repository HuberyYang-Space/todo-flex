import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readSfcStyle } from '~/test/sfcStyle'

/*
 * 只断言能算的：两套主题下的对比度与明暗序。亮色下才出现的问题只看默认的暗色永远发现不了。
 * 观感（会不会抢戏、手感如何）算不出来，仍归人眼。
 */

// 不用 import './main.css?raw'：vitest 默认 css: false，会把 CSS 导入打桩成空串
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

// 混色参数一律从组件源码里读，不在测试里抄一份：抄过去的常量不会跟着产品代码变，守卫就瞎了
const STAGE = readSfcStyle('src/components/playground/DemoStage.vue')
const OVERLAY = readSfcStyle('src/components/playground/OverlayLayer.vue')

/** 按逗号切顶层参数，括号里的逗号不算 */
function splitTopLevel(source: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '(') {
      depth++
    }
    else if (source[i] === ')') {
      depth--
    }
    else if (source[i] === ',' && depth === 0) {
      parts.push(source.slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(source.slice(start).trim())
  return parts
}

function percentOf(raw: string, env: Record<string, string>): number {
  const ref = /^var\((--[\w-]+)\)$/.exec(raw)
  return Number.parseFloat(ref ? env[ref[1]] : raw)
}

/**
 * 按浏览器的口径求值 `color-mix(in srgb, …)`、`var()`、`white`、`black`、`#hex`。
 * 与 `transparent` 混合再叠到底色上，数学上等价于直接与底色混合，所以由调用方给出 backdrop。
 */
function evalColor(expr: string, env: Record<string, string>, backdrop?: Rgb): Rgb {
  const e = expr.trim()
  if (e === 'white')
    return WHITE
  if (e === 'black')
    return BLACK
  if (e === 'transparent') {
    if (!backdrop)
      throw new Error('与 transparent 混合必须给出底色')
    return backdrop
  }
  if (e.startsWith('#'))
    return parseHex(e)

  const ref = /^var\((--[\w-]+)\)$/.exec(e)
  if (ref) {
    const raw = env[ref[1]]
    if (raw === undefined)
      throw new Error(`缺少变量 ${ref[1]}`)
    return evalColor(raw, env, backdrop)
  }

  const colorMix = /^color-mix\(in srgb,(.*)\)$/.exec(e)
  if (colorMix) {
    const [first, second] = splitTopLevel(colorMix[1])
    const weighted = /^(.*\S)\s+(\S+)$/.exec(first)
    if (!weighted)
      throw new Error(`color-mix 的第一项缺少比例：${first}`)
    return mix(evalColor(weighted[1], env, backdrop), percentOf(weighted[2], env), evalColor(second, env, backdrop))
  }

  throw new Error(`无法求值：${e}`)
}

/** 渐变的各个色标，按书写顺序；第一项是角度或形状，跳过 */
function gradientStops(value: string, env: Record<string, string>): Rgb[] {
  const inner = /^(?:linear|radial)-gradient\((.*)\)$/.exec(value)
  if (!inner)
    throw new Error(`不是渐变：${value}`)
  return splitTopLevel(inner[1]).slice(1).map(stop => evalColor(stop.replace(/\s+[\d.]+%$/, ''), env))
}

/** 取声明值里唯一的那段 color-mix(…)，如描边与投影层里的颜色部分 */
function colorMixIn(value: string): string {
  const hit = /color-mix\(.*\)$/.exec(value)
  if (!hit)
    throw new Error(`没有 color-mix：${value}`)
  return hit[0]
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

  const FACE_OF = [
    ['默认', '.stage-box'],
    ['选中', '.stage-item.is-selected .stage-box'],
  ] as const

  /** 某个状态下块体的变量环境：主题变量 + 该状态定义的体色 --face */
  function blockEnv(faceSelector: string): Record<string, string> {
    return { ...theme, '--face': STAGE.decl(faceSelector, '--face') }
  }

  it.each(FACE_OF)('等距实体块（%s态）：顶面 > 正面 > 右侧面，左上光源在两套主题下都读得出来', (_which, faceSelector) => {
    const env = blockEnv(faceSelector)
    const top = evalColor(STAGE.decl('.stage-box::before', 'background'), env)
    const right = evalColor(STAGE.decl('.stage-box::after', 'background'), env)
    const [frontTop, frontBottom] = gradientStops(STAGE.decl('.stage-box', 'background'), env)

    expect(luminance(top)).toBeGreaterThan(luminance(frontTop))
    expect(luminance(frontBottom)).toBeGreaterThan(luminance(right))
  })

  it.each(FACE_OF)('正面渐变（%s态）上端比下端亮——光从上方来', (_which, faceSelector) => {
    const [frontTop, frontBottom] = gradientStops(STAGE.decl('.stage-box', 'background'), blockEnv(faceSelector))

    expect(luminance(frontTop)).toBeGreaterThan(luminance(frontBottom))
  })

  it('选中态只换体色，不另写 background——三个面才都跟着 --face 走', () => {
    expect(() => STAGE.decl('.stage-item.is-selected .stage-box', 'background')).toThrow()
  })

  it('盒子描边达到非文字对比度下限（3:1）——盒子是可点选的 UI 组件', () => {
    const [floor] = gradientStops(STAGE.decl('.stage', 'background'), theme)
    const outline = evalColor(colorMixIn(STAGE.decl('.stage-box', 'outline')), theme, floor)

    expect(contrast(outline, floor)).toBeGreaterThanOrEqual(3)
  })

  it('剩余空间斜纹的纹路可辨识，且不弱于暗色主题的基准 2.2', () => {
    // 先确认 --stripe-op 真的有人在用：不然这里算得再好看，界面上也不是这个数
    expect(OVERLAY.decl('.stripe-flow line', 'stroke-opacity')).toBe('var(--stripe-op)')

    const [floor] = gradientStops(STAGE.decl('.stage', 'background'), theme)
    const bandBg = mix(accent, 8, floor)
    const stripe = mix(accent, Number.parseFloat(theme['--stripe-op']) * 100, bandBg)

    expect(contrast(stripe, bandBg)).toBeGreaterThanOrEqual(2)
  })

  it('方块底缘的接触暗边读得出来——纯靠台面黑影在暗色下只有 1.12', () => {
    const env = blockEnv('.stage-box')
    const [, frontBottom] = gradientStops(STAGE.decl('.stage-box', 'background'), env)
    const [edgeLayer] = splitTopLevel(STAGE.decl('.stage-box', 'box-shadow'))
    expect(edgeLayer.startsWith('inset'), '接触暗边必须是 inset，落在正面上而不是台面上').toBe(true)

    const edge = evalColor(colorMixIn(edgeLayer), env, frontBottom)

    expect(contrast(edge, frontBottom)).toBeGreaterThanOrEqual(1.6)
  })
})
