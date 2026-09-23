import type { FlexContainerState, FlexItemState } from './types'
import { mainAxisSize } from './axis'
import { DEFAULT_FONT_SIZE } from './defaults'

/**
 * - `static`：推导引擎能算出像素值
 * - `runtime`：合法，但取值要到运行期才能确定（字体度量、视口、`calc()` 等），推导引擎拿不到
 * - `invalid`：浏览器会整条丢弃、按 auto 处理
 */
export type BasisKind = 'static' | 'runtime' | 'invalid'

/** 演示区的内容是一块固定尺寸的占位，max-content、min-content、fit-content 都等于它，与 auto 同值 */
const AUTO_LIKE = new Set([
  'auto',
  'content',
  'max-content',
  'min-content',
  'fit-content',
  'initial',
  'inherit',
  'unset',
  'revert',
  'revert-layer',
])

const PX_PER_UNIT = new Map([
  ['px', 1],
  ['in', 96],
  ['cm', 96 / 2.54],
  ['mm', 96 / 25.4],
  ['q', 96 / 101.6],
  ['pt', 96 / 72],
  ['pc', 16],
])

/** 演示区把字号钉在 1rem，em 与 rem 同值 */
const FONT_RELATIVE_UNITS = new Set(['em', 'rem'])

const RUNTIME_UNITS = new Set([
  'ex',
  'rex',
  'cap',
  'rcap',
  'ch',
  'rch',
  'ic',
  'ric',
  'lh',
  'rlh',
  'vw',
  'vh',
  'vi',
  'vb',
  'vmin',
  'vmax',
  'svw',
  'svh',
  'svi',
  'svb',
  'svmin',
  'svmax',
  'lvw',
  'lvh',
  'lvi',
  'lvb',
  'lvmin',
  'lvmax',
  'dvw',
  'dvh',
  'dvi',
  'dvb',
  'dvmin',
  'dvmax',
  'cqw',
  'cqh',
  'cqi',
  'cqb',
  'cqmin',
  'cqmax',
])

/** 取自真实浏览器：fit-content()、minmax()、sign()、anchor-size() 在 flex-basis 里都不被接受 */
const RUNTIME_FUNCTIONS = new Set(['calc', 'min', 'max', 'clamp', 'var', 'env', 'round', 'mod', 'rem', 'abs', 'hypot', 'calc-size', 'attr'])

function parseLength(raw: string): { value: number, unit: string } | null {
  const number = /^\+?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/.exec(raw)
  return number ? { value: Number(number[0]), unit: raw.slice(number[0].length) } : null
}

export function basisKind(basis: string): BasisKind {
  const raw = basis.trim().toLowerCase()
  if (AUTO_LIKE.has(raw))
    return 'static'

  const fn = /^([a-z-]+)\(.*\)$/.exec(raw)
  if (fn)
    return RUNTIME_FUNCTIONS.has(fn[1]) ? 'runtime' : 'invalid'

  const length = parseLength(raw)
  if (!length)
    return 'invalid'

  const { value, unit } = length
  if (unit === '')
    return value === 0 ? 'static' : 'invalid'
  if (unit === '%' || PX_PER_UNIT.has(unit) || FONT_RELATIVE_UNITS.has(unit))
    return 'static'
  return RUNTIME_UNITS.has(unit) ? 'runtime' : 'invalid'
}

/**
 * 把 flex-basis 解析成像素。故意不做 min/max 截断，那道缝隙留给诊断层。
 * 非法值与浏览器一样按 auto 处理；运行期才能确定的值这里只给占位，deriveLayout 会把整个容器标成无法推导。
 */
export function resolveBasis(item: FlexItemState, container: FlexContainerState, fontSize = DEFAULT_FONT_SIZE): number {
  const length = basisKind(item.basis) === 'static' ? parseLength(item.basis.trim().toLowerCase()) : null
  if (!length)
    return item.size

  const { value, unit } = length
  if (unit === '%')
    return (mainAxisSize(container) * value) / 100
  if (FONT_RELATIVE_UNITS.has(unit))
    return value * fontSize
  return value * (PX_PER_UNIT.get(unit) ?? 1)
}
