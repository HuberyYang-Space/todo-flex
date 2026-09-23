import type { FlexContainerState, FlexItemState } from './types'
import { mainAxisGap, mainAxisSize } from './axis'
import { DEFAULT_FONT_SIZE } from './constants'
import { resolveBasis } from './resolveBasis'

function hypotheticalSize(item: FlexItemState, container: FlexContainerState, fontSize: number): number {
  return Math.max(0, resolveBasis(item, container, fontSize))
}

/** 剩余空间 = 容器主轴尺寸 - Σ假设尺寸 - Σgap，负值代表溢出 */
export function computeFreeSpace(lineItems: FlexItemState[], container: FlexContainerState, fontSize = DEFAULT_FONT_SIZE): number {
  const totalGap = Math.max(0, lineItems.length - 1) * mainAxisGap(container)
  const used = lineItems.reduce((sum, item) => sum + hypotheticalSize(item, container, fontSize), 0)
  return mainAxisSize(container) - used - totalGap
}

/** 收缩权重 = shrink × basis；grow 不加权，这是两者最容易被忽略的差别 */
export function shrinkWeight(item: FlexItemState, container: FlexContainerState, fontSize = DEFAULT_FONT_SIZE): number {
  return Math.max(0, item.shrink) * hypotheticalSize(item, container, fontSize)
}

/**
 * 剩余空间为正时按 grow 占比分配，返回每项分得的增量（≥ 0）。
 * grow 之和小于 1 时只分出对应比例（规范 §9.7 第 4b 步），其余留在行上交给 justify-content 与 auto margin。
 */
export function distributeGrow(lineItems: FlexItemState[], freeSpace: number): Map<string, number> {
  const result = new Map<string, number>()
  const totalGrow = lineItems.reduce((sum, item) => sum + Math.max(0, item.grow), 0)
  const distributable = totalGrow < 1 ? freeSpace * totalGrow : freeSpace

  for (const item of lineItems) {
    result.set(item.id, totalGrow <= 0 ? 0 : (Math.max(0, item.grow) / totalGrow) * distributable)
  }

  return result
}

/**
 * 剩余空间为负时按 shrink × basis 加权分摊，返回每项让出的增量（≤ 0）。
 *
 * 按规范 §9.7 的冻结循环：分摊后会被压到 0 以下的项冻结在 0，剩下的溢出量在其余项之间重新分摊；
 * 未冻结项的 shrink 之和小于 1 时只让出对应比例（第 4b 步）。
 * 下限只有 0——尺寸不可能为负；min-width:auto 仍然故意不模拟。
 */
export function distributeShrink(
  lineItems: FlexItemState[],
  freeSpace: number,
  container: FlexContainerState,
  fontSize = DEFAULT_FONT_SIZE,
): Map<string, number> {
  const result = new Map<string, number>()
  const frozen = new Set<string>()
  let remaining = freeSpace

  while (remaining < 0) {
    const active = lineItems.filter(item => !frozen.has(item.id))
    const total = active.reduce((sum, item) => sum + shrinkWeight(item, container, fontSize), 0)
    if (total <= 0)
      break

    const factorSum = active.reduce((sum, item) => sum + Math.max(0, item.shrink), 0)
    const effective = factorSum < 1 ? Math.max(remaining, freeSpace * factorSum) : remaining
    const share = (item: FlexItemState): number => (shrinkWeight(item, container, fontSize) / total) * effective
    const violators = active.filter(item => hypotheticalSize(item, container, fontSize) + share(item) < 0)

    if (violators.length === 0) {
      for (const item of active)
        result.set(item.id, share(item))
      break
    }

    for (const item of violators) {
      const size = hypotheticalSize(item, container, fontSize)
      frozen.add(item.id)
      result.set(item.id, -size)
      remaining += size
    }
  }

  for (const item of lineItems) {
    const delta = result.get(item.id) ?? 0
    // 权重为 0 的项算出来是 -0，不规范成 0 会一路显示到界面上
    result.set(item.id, delta === 0 ? 0 : delta)
  }

  return result
}
