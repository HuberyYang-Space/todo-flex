import type { DerivedItem, DerivedLayout, DerivedLine, FlexState } from './types'
import { mainAxisSize } from './axis'
import { basisKind } from './basisSyntax'
import { DEFAULT_FONT_SIZE } from './constants'
import { computeFreeSpace, distributeGrow, distributeShrink, shrinkWeight } from './distribute'
import { resolveBasis } from './resolveBasis'
import { splitLines } from './splitLines'

/**
 * 按 flex 规范算出每个盒子的理论主轴尺寸。
 * 收缩只截到 0，刻意不模拟 min-width:auto：理论值与浏览器实际值的差，正是诊断层要找的信号。
 *
 * 只要有一个盒子的 basis 要到运行期才能确定，整个容器的理论值都给 null：
 * 它的尺寸一变，其余盒子分到的空间、甚至换行位置都跟着变，没有哪个数字还算得准。
 */
export function deriveLayout(state: FlexState, fontSize = DEFAULT_FONT_SIZE): DerivedLayout {
  const { container, items } = state
  const byId = new Map(items.map(item => [item.id, item]))
  const lineIds = splitLines(items, container, fontSize)
  const unresolvable = items.some(item => basisKind(item.basis) === 'runtime')
  const containerMain = mainAxisSize(container)

  const lines: DerivedLine[] = []
  const derivedItems: DerivedItem[] = []

  lineIds.forEach((ids, lineIndex) => {
    const lineItems = ids.map(id => byId.get(id)!)
    const freeSpace = computeFreeSpace(lineItems, container, fontSize)
    const totalGrow = lineItems.reduce((sum, item) => sum + Math.max(0, item.grow), 0)
    const totalShrinkWeighted = lineItems.reduce((sum, item) => sum + shrinkWeight(item, container, fontSize), 0)

    const growDeltas = freeSpace > 0 ? distributeGrow(lineItems, freeSpace) : null
    const shrinkDeltas = freeSpace < 0 ? distributeShrink(lineItems, freeSpace, container, fontSize) : null
    let remainingFreeSpace = freeSpace

    for (const item of lineItems) {
      const basisResolved = resolveBasis(item, container, fontSize)
      const hypotheticalMainSize = Math.max(0, basisResolved)
      const deltaFromGrow = growDeltas?.get(item.id) ?? 0
      const deltaFromShrink = shrinkDeltas?.get(item.id) ?? 0
      remainingFreeSpace -= deltaFromGrow + deltaFromShrink

      derivedItems.push({
        id: item.id,
        basisResolved,
        hypotheticalMainSize,
        finalMainSize: unresolvable ? null : hypotheticalMainSize + deltaFromGrow + deltaFromShrink,
        deltaFromGrow,
        deltaFromShrink,
        lineIndex,
      })
    }

    lines.push({
      index: lineIndex,
      itemIds: ids,
      usedMainSize: containerMain - freeSpace,
      freeSpace,
      remainingFreeSpace: unresolvable ? null : remainingFreeSpace,
      totalGrow,
      totalShrinkWeighted,
    })
  })

  return { lines, items: derivedItems, fontSize }
}
