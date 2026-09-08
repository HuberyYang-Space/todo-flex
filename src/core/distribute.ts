import type { FlexContainerState, FlexItemState } from './types'
import { mainAxisGap, mainAxisSize } from './axis'
import { resolveBasis } from './resolveBasis'

/** 假设主轴尺寸：basis 解析值，下限截到 0 */
function hypotheticalSize(item: FlexItemState, container: FlexContainerState): number {
  return Math.max(0, resolveBasis(item, container))
}

/** 剩余空间 = 容器主轴尺寸 - Σ假设尺寸 - Σgap，负值代表溢出 */
export function computeFreeSpace(lineItems: FlexItemState[], container: FlexContainerState): number {
  const totalGap = Math.max(0, lineItems.length - 1) * mainAxisGap(container)
  const used = lineItems.reduce((sum, item) => sum + hypotheticalSize(item, container), 0)
  return mainAxisSize(container) - used - totalGap
}

/** 收缩权重 = shrink × basis，这是 shrink 与 grow 最容易被忽略的差别 */
export function shrinkWeight(item: FlexItemState, container: FlexContainerState): number {
  return Math.max(0, item.shrink) * hypotheticalSize(item, container)
}

/** 剩余空间为正时按 grow 占比分配，返回每项分得的增量（≥ 0） */
export function distributeGrow(lineItems: FlexItemState[], freeSpace: number): Map<string, number> {
  const result = new Map<string, number>()
  const totalGrow = lineItems.reduce((sum, item) => sum + Math.max(0, item.grow), 0)

  for (const item of lineItems) {
    result.set(item.id, totalGrow <= 0 ? 0 : (Math.max(0, item.grow) / totalGrow) * freeSpace)
  }

  return result
}

/** 剩余空间为负时按 shrink × basis 加权分摊，返回每项让出的增量（≤ 0） */
export function distributeShrink(
  lineItems: FlexItemState[],
  freeSpace: number,
  container: FlexContainerState,
): Map<string, number> {
  const result = new Map<string, number>()
  const weights = lineItems.map(item => shrinkWeight(item, container))
  const total = weights.reduce((sum, weight) => sum + weight, 0)

  lineItems.forEach((item, index) => {
    const delta = total <= 0 ? 0 : (weights[index] / total) * freeSpace
    // 权重为 0 的项算出来是负零，规范成正零，免得一路显示到界面上变成 "-0"
    result.set(item.id, delta === 0 ? 0 : delta)
  })

  return result
}
