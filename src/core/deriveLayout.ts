import type { DerivationStep, DerivedItem, DerivedLayout, DerivedLine, FlexState } from './types'
import { mainAxisSize } from './axis'
import { computeFreeSpace, distributeGrow, distributeShrink, shrinkWeight } from './distribute'
import { resolveBasis } from './resolveBasis'
import { splitLines } from './splitLines'

/**
 * 推导引擎：按 flex 规范算出每个盒子的「理论」主轴尺寸，并记录推导过程。
 * 刻意不模拟 min-width:auto 等下限截断——理论值与浏览器实际值的差，
 * 正是诊断层用来发现「哪条规则介入了」的信号。
 */
export function deriveLayout(state: FlexState): DerivedLayout {
  const { container, items } = state
  const byId = new Map(items.map(item => [item.id, item]))
  const lineIds = splitLines(items, container)
  const containerMain = mainAxisSize(container)

  const lines: DerivedLine[] = []
  const derivedItems: DerivedItem[] = []
  const steps: DerivationStep[] = []

  if (lineIds.length > 1) {
    steps.push({
      kind: 'lineBreak',
      lineIndex: 0,
      params: { lineCount: lineIds.length },
      messageKey: 'derive.lineBreak',
    })
  }

  lineIds.forEach((ids, lineIndex) => {
    const lineItems = ids.map(id => byId.get(id)!)
    const freeSpace = computeFreeSpace(lineItems, container)
    const totalGrow = lineItems.reduce((sum, item) => sum + Math.max(0, item.grow), 0)
    const totalShrinkWeighted = lineItems.reduce((sum, item) => sum + shrinkWeight(item, container), 0)

    steps.push({
      kind: 'freeSpace',
      lineIndex,
      params: { containerMain, used: containerMain - freeSpace, freeSpace },
      messageKey: 'derive.freeSpace',
    })

    const growDeltas = freeSpace > 0 ? distributeGrow(lineItems, freeSpace) : null
    const shrinkDeltas = freeSpace < 0 ? distributeShrink(lineItems, freeSpace, container) : null

    for (const item of lineItems) {
      const basisResolved = resolveBasis(item, container)
      const hypotheticalMainSize = Math.max(0, basisResolved)
      const deltaFromGrow = growDeltas?.get(item.id) ?? 0
      const deltaFromShrink = shrinkDeltas?.get(item.id) ?? 0

      derivedItems.push({
        id: item.id,
        basisResolved,
        hypotheticalMainSize,
        finalMainSize: hypotheticalMainSize + deltaFromGrow + deltaFromShrink,
        deltaFromGrow,
        deltaFromShrink,
        lineIndex,
      })

      steps.push({
        kind: 'resolveBasis',
        lineIndex,
        itemId: item.id,
        params: { basisResolved, size: item.size },
        messageKey: 'derive.resolveBasis',
      })

      if (deltaFromGrow > 0) {
        steps.push({
          kind: 'growDistribute',
          lineIndex,
          itemId: item.id,
          params: { grow: item.grow, totalGrow, freeSpace, delta: deltaFromGrow },
          messageKey: 'derive.growDistribute',
        })
      }

      if (deltaFromShrink < 0) {
        steps.push({
          kind: 'shrinkDistribute',
          lineIndex,
          itemId: item.id,
          params: {
            shrink: item.shrink,
            weight: shrinkWeight(item, container),
            totalShrinkWeighted,
            overflow: freeSpace,
            delta: deltaFromShrink,
          },
          messageKey: 'derive.shrinkDistribute',
        })
      }
    }

    lines.push({
      index: lineIndex,
      itemIds: ids,
      usedMainSize: containerMain - freeSpace,
      freeSpace,
      totalGrow,
      totalShrinkWeighted,
    })
  })

  return { lines, items: derivedItems, steps }
}
