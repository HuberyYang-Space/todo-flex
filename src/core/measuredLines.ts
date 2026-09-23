import type { FlexState, MeasuredItem, MeasuredStage } from './types'
import { isRowDirection } from './axis'
import { basisKind } from './basisSyntax'
import { DEFAULT_FONT_SIZE } from './constants'
import { resolveBasis } from './resolveBasis'
import { splitLines } from './splitLines'

/**
 * offset* 的位置与尺寸各自取整，各差 ±0.5；拿「位置 + 尺寸」去比另一个取整的位置，最多差 1.5px。
 * 小数排版（被拉伸的行框、auto margin）下这点误差会伪装成交叉轴重叠或主轴回退。
 */
const EPSILON = 1.5

/**
 * 按浏览器实际排版把盒子分成行，返回每行的 id，按视觉行序排列（与 splitLines 同一约定）。
 *
 * 推导引擎的分行不含 min-width:auto 的下限，浏览器却按撑宽后的假设尺寸断行，两者可以不同；
 * 叠加层与诊断要讲的是屏幕上的真实情况，所以这里用浏览器的断行算法：
 * 假设尺寸 = basis 与自动最小尺寸取大（演示区内容是固定尺寸的占位块，自动最小尺寸恰好是 size）。
 * 这只用于给实测盒子分组，推导引擎的理论值仍然不模拟 min-width:auto。
 *
 * 光靠几何位置分不全：宽度为 0 的盒子与下一个盒子交叉轴互不重叠时，可能同行也可能换了行。
 * 所以几何只做两件事——核对算法的结果与实测是否矛盾、以及 basis 要到运行期才能确定时兜底。
 */
export function measuredLines(state: FlexState, measured: MeasuredStage, fontSize = DEFAULT_FONT_SIZE): string[][] {
  const { container } = state
  const byId = new Map(measured.items.map(record => [record.id, record]))
  const ordered = [...state.items]
    .sort((a, b) => a.order - b.order)
    .map(item => byId.get(item.id))
    .filter((record): record is MeasuredItem => record !== undefined)

  if (container.wrap === 'nowrap')
    return ordered.length > 0 ? [ordered.map(record => record.id)] : []

  const geo = geometry(state)

  if (state.items.some(item => basisKind(item.basis) === 'runtime'))
    return geo.group(ordered)

  const lines = splitLines(state.items, container, fontSize, item =>
    Math.max(resolveBasis(item, container, fontSize), item.minWidthAuto ? item.size : 0))
    .map(line => line.map(id => byId.get(id)).filter((record): record is MeasuredItem => record !== undefined))
    .filter(line => line.length > 0)

  return geo.consistent(lines) ? lines.map(line => line.map(record => record.id)) : geo.group(ordered)
}

/** 两条浏览器必然满足的事实：各行在交叉轴上互不重叠，同一行里的盒子沿主轴只进不退 */
function geometry(state: FlexState) {
  const isRow = isRowDirection(state.container.direction)
  const reverseMain = state.container.direction.endsWith('-reverse')
  const reverseCross = state.container.wrap === 'wrap-reverse'

  const mainStart = (r: MeasuredItem): number => (isRow ? r.left : r.top)
  const mainSize = (r: MeasuredItem): number => (isRow ? r.width : r.height)
  const crossStart = (r: MeasuredItem): number => (isRow ? r.top : r.left)
  const crossEnd = (r: MeasuredItem): number => crossStart(r) + (isRow ? r.height : r.width)

  const hull = (line: MeasuredItem[]): [number, number] => [Math.min(...line.map(crossStart)), Math.max(...line.map(crossEnd))]
  const overlap = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0])
  const movedBack = (prev: MeasuredItem, next: MeasuredItem): boolean => reverseMain
    ? mainStart(next) + mainSize(next) > mainStart(prev) + EPSILON
    : mainStart(next) < mainStart(prev) + mainSize(prev) - EPSILON

  function startsNewLine(line: MeasuredItem[], next: MeasuredItem): boolean {
    const [lineCrossStart, lineCrossEnd] = hull(line)
    if (overlap([lineCrossStart, lineCrossEnd], [crossStart(next), crossEnd(next)]) > EPSILON)
      return false

    const prev = line[line.length - 1]
    if (movedBack(prev, next))
      return true

    // 前一个盒子主轴尺寸为 0 时，新行首项可能恰好落在同一坐标上，只能看它是否在交叉轴上整体越过了当前行
    if (mainSize(prev) <= EPSILON)
      return reverseCross ? crossEnd(next) <= lineCrossStart + EPSILON : crossStart(next) >= lineCrossEnd - EPSILON

    return false
  }

  return {
    group(ordered: MeasuredItem[]): string[][] {
      const lines: MeasuredItem[][] = []
      for (const record of ordered) {
        const line = lines[lines.length - 1]
        if (line && !startsNewLine(line, record))
          line.push(record)
        else
          lines.push([record])
      }
      const ids = lines.map(line => line.map(record => record.id))
      return reverseCross ? ids.reverse() : ids
    },

    consistent(lines: MeasuredItem[][]): boolean {
      const insideForward = lines.every(line => line.every((record, index) => index === 0 || !movedBack(line[index - 1], record)))
      const disjoint = lines.every((line, index) => index === 0 || overlap(hull(lines[index - 1]), hull(line)) <= EPSILON)
      return insideForward && disjoint
    },
  }
}
