import type { Direction, FlexContainerState } from './types'

/** row / row-reverse 的主轴是横向 */
export function isRowDirection(direction: Direction): boolean {
  return direction === 'row' || direction === 'row-reverse'
}

/** 主轴上的容器尺寸 */
export function mainAxisSize(container: FlexContainerState): number {
  return isRowDirection(container.direction) ? container.width : container.height
}

/** 主轴方向上相邻项之间的间距 */
export function mainAxisGap(container: FlexContainerState): number {
  return isRowDirection(container.direction) ? container.columnGap : container.rowGap
}
