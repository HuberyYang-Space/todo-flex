import type {
  DerivedItem,
  DerivedLayout,
  Diagnostic,
  DiagnosticRule,
  FlexItemState,
  FlexState,
  MeasuredStage,
} from './types'
import { isRowDirection } from './axis'
import { basisKind } from './resolveBasis'

/** 亚像素舍入随时带来零点几像素的偏差，不设阈值会满屏误报 */
const TOLERANCE = 0.5

function matchSizeRule(item: FlexItemState, actual: number): DiagnosticRule {
  // 不要求实际值大于理论值：多盒子收缩连锁时，被连累的那一项会先缩过头、
  // 再被自己的下限接住，结果比理论值更小，但同样是这条规则介入
  if (item.minWidthAuto && Math.abs(actual - item.size) <= TOLERANCE)
    return 'min-width-auto'

  return 'max-size-clamp'
}

/**
 * 比对理论尺寸与浏览器实际尺寸，指出是哪条规则介入了。
 *
 * `margin: auto` 是例外：它吃掉剩余空间时只改位置、不改尺寸，
 * 不会表现为尺寸偏差，只能在尺寸吻合时作为提示给出。
 */
export function diagnose(
  state: FlexState,
  derived: DerivedLayout,
  measured: MeasuredStage,
): Diagnostic[] {
  const isRow = isRowDirection(state.container.direction)
  const itemById = new Map(state.items.map(item => [item.id, item]))
  const measuredById = new Map(measured.items.map(item => [item.id, item]))
  const lineByIndex = new Map(derived.lines.map(line => [line.index, line]))

  const mainSizeOf = (record: { width: number, height: number }): number =>
    isRow ? record.width : record.height

  const diagnoseItem = (derivedItem: DerivedItem): Diagnostic | null => {
    const item = itemById.get(derivedItem.id)
    const record = measuredById.get(derivedItem.id)
    // 盒子刚增删、还没采样时跳过，不猜
    if (!item || !record)
      return null

    const actual = mainSizeOf(record)
    const theoretical = derivedItem.finalMainSize
    const base = { itemId: item.id, theoretical, actual }
    const line = lineByIndex.get(derivedItem.lineIndex)

    // 排在尺寸比对之前：浏览器按 auto 取到的内容尺寸，与 min-width:auto 撑住的现象长得一模一样
    const kind = basisKind(item.basis)
    if (kind === 'invalid')
      return { ...base, rule: 'invalid-basis', severity: 'warn', params: {} }
    if (theoretical === null)
      return kind === 'runtime' ? { ...base, rule: 'runtime-basis', severity: 'info', params: {} } : null

    if (Math.abs(actual - theoretical) > TOLERANCE) {
      const rule = matchSizeRule(item, actual)
      return { ...base, rule, severity: 'warn', params: {} }
    }

    // 看分配之后剩下的：规范里 §9.7 解伸缩长度先于 §9.9.1 分配 auto margin，grow 先分走它的那一份
    const remaining = line?.remainingFreeSpace ?? 0
    if (item.marginAuto && remaining > TOLERANCE)
      return { ...base, rule: 'margin-auto', severity: 'info', params: { freeSpace: remaining } }

    return null
  }

  return derived.items
    .map(diagnoseItem)
    .filter((diagnostic): diagnostic is Diagnostic => diagnostic !== null)
}
