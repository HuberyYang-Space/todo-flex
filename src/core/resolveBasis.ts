import type { FlexContainerState, FlexItemState } from './types'
import { mainAxisSize } from './axis'
import { FONT_RELATIVE_UNITS, PX_PER_UNIT, staticLength } from './basisSyntax'
import { DEFAULT_FONT_SIZE } from './constants'

/**
 * 把 flex-basis 解析成像素。故意不做 min/max 截断，那道缝隙留给诊断层。
 * 运行期才能确定的值这里只给占位，deriveLayout 会把整个容器标成无法推导。
 */
export function resolveBasis(item: FlexItemState, container: FlexContainerState, fontSize = DEFAULT_FONT_SIZE): number {
  const length = staticLength(item.basis)
  if (!length)
    return item.size

  const { value, unit } = length
  if (unit === '%')
    return (mainAxisSize(container) * value) / 100
  if (FONT_RELATIVE_UNITS.has(unit))
    return value * fontSize
  return value * (PX_PER_UNIT.get(unit) ?? 1)
}
