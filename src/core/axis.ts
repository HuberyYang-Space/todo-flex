import type { Direction, FlexContainerState } from './types'

export function isRowDirection(direction: Direction): boolean {
  return direction === 'row' || direction === 'row-reverse'
}

export function mainAxisSize(container: FlexContainerState): number {
  return isRowDirection(container.direction) ? container.width : container.height
}

export function mainAxisGap(container: FlexContainerState): number {
  return isRowDirection(container.direction) ? container.columnGap : container.rowGap
}

/** 屏幕坐标系下的单位向量：x 向右为正，y 向下为正 */
export interface AxisVector {
  dx: number
  dy: number
}

/** `-reverse` 只翻主轴，`wrap-reverse` 只翻交叉轴，两者互不影响 */
export function axisVectors(container: FlexContainerState): { main: AxisVector, cross: AxisVector } {
  const mainSign = container.direction.endsWith('-reverse') ? -1 : 1
  const crossSign = container.wrap === 'wrap-reverse' ? -1 : 1

  return isRowDirection(container.direction)
    ? { main: { dx: mainSign, dy: 0 }, cross: { dx: 0, dy: crossSign } }
    : { main: { dx: 0, dy: mainSign }, cross: { dx: crossSign, dy: 0 } }
}
