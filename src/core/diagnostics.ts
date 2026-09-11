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

/**
 * 理论与实际的差值超过这个阈值才认为有规则介入。
 * 亚像素舍入随时会带来零点几个像素的偏差，不设阈值会满屏误报。
 */
const TOLERANCE = 0.5

/** 尺寸对不上时，判断是哪条规则介入了 */
function matchSizeRule(item: FlexItemState, actual: number): DiagnosticRule {
  // 实际尺寸停在内容固有尺寸上，就是被自动最小尺寸接住了。
  // 不要求实际值大于理论值——多盒子收缩连锁时，被连累的那一项会先缩过头，
  // 再被自己的下限接住，结果反而比理论值更小，但同样是这条规则介入。
  if (item.minWidthAuto && Math.abs(actual - item.size) <= TOLERANCE)
    return 'min-width-auto'

  return 'max-size-clamp'
}

/**
 * 比对推导出的理论尺寸与浏览器渲染出的实际尺寸，指出是哪条规则介入了。
 *
 * 推导引擎刻意不模拟 min-width:auto 等下限截断，留出的正是这道缝隙——
 * 用户自由玩耍时撞上的坑，在这里被自动发现并解释。
 *
 * `margin: auto` 是例外：浏览器实测确认它吃掉剩余空间时只改变位置、不改变尺寸，
 * 因此不可能表现为尺寸偏差，只能在尺寸吻合时作为状态提示给出。
 */
export function diagnose(
  state: FlexState,
  derived: DerivedLayout,
  measured: MeasuredStage,
): Diagnostic[] {
  const isRow = isRowDirection(state.container.direction)
  const itemById = new Map(state.items.map(item => [item.id, item]))
  const measuredById = new Map(measured.items.map(item => [item.id, item]))
  const freeSpaceByLine = new Map(derived.lines.map(line => [line.index, line.freeSpace]))

  const mainSizeOf = (record: { width: number, height: number }): number =>
    isRow ? record.width : record.height

  const diagnoseItem = (derivedItem: DerivedItem): Diagnostic | null => {
    const item = itemById.get(derivedItem.id)
    const record = measuredById.get(derivedItem.id)
    // 观测值缺失（盒子刚增删、还没采样）时跳过，不猜
    if (!item || !record)
      return null

    const actual = mainSizeOf(record)
    const theoretical = derivedItem.finalMainSize
    const base = { itemId: item.id, theoretical, actual }
    const lineFreeSpace = freeSpaceByLine.get(derivedItem.lineIndex) ?? 0

    if (Math.abs(actual - theoretical) > TOLERANCE) {
      const rule = matchSizeRule(item, actual)
      return { ...base, rule, severity: 'warn', params: {} }
    }

    // 尺寸吻合不代表没事：margin:auto 正在悄悄吃掉本该由 justify-content 分配的空间
    if (item.marginAuto && lineFreeSpace > TOLERANCE) {
      return {
        ...base,
        rule: 'margin-auto',
        severity: 'info',
        params: { freeSpace: lineFreeSpace },
      }
    }

    return null
  }

  return derived.items
    .map(diagnoseItem)
    .filter((diagnostic): diagnostic is Diagnostic => diagnostic !== null)
}
