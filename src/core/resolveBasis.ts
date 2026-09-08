import type { FlexContainerState, FlexItemState } from './types'
import { mainAxisSize } from './axis'

/**
 * 把 flex-basis 字符串解析成像素值。
 * 注意：这里不做 min/max 截断——min-width:auto 的下限故意不模拟，
 * 留给诊断层比对理论与实际时发现并解释。
 */
export function resolveBasis(item: FlexItemState, container: FlexContainerState): number {
  const raw = item.basis.trim()

  // auto 与 content 都退回内容固有尺寸
  if (raw === 'auto' || raw === 'content')
    return item.size

  if (raw.endsWith('%')) {
    const percent = Number.parseFloat(raw)
    return Number.isNaN(percent) ? item.size : (mainAxisSize(container) * percent) / 100
  }

  const length = Number.parseFloat(raw)
  return Number.isNaN(length) ? item.size : length
}
