import type { FlexContainerState, FlexItemState } from './types'
import { mainAxisGap, mainAxisSize } from './axis'
import { resolveBasis } from './resolveBasis'

/**
 * 按 order 排序后分行，返回每行的 item id。
 * 返回值按「视觉行序」排列：wrap-reverse 会反转行的先后。
 */
export function splitLines(items: FlexItemState[], container: FlexContainerState): string[][] {
  // Array.prototype.sort 是稳定排序，order 相同的项保持文档顺序
  const ordered = [...items].sort((a, b) => a.order - b.order)

  if (container.wrap === 'nowrap')
    return [ordered.map(item => item.id)]

  const limit = mainAxisSize(container)
  const gap = mainAxisGap(container)
  const lines: string[][] = []
  let current: string[] = []
  let used = 0

  for (const item of ordered) {
    const size = Math.max(0, resolveBasis(item, container))
    const nextUsed = current.length === 0 ? size : used + gap + size

    // 当前行已有内容且放不下时才断行，保证单个超宽盒子独占一行而非产生空行
    if (current.length > 0 && nextUsed > limit) {
      lines.push(current)
      current = [item.id]
      used = size
    }
    else {
      current.push(item.id)
      used = nextUsed
    }
  }

  if (current.length > 0)
    lines.push(current)

  return container.wrap === 'wrap-reverse' ? lines.reverse() : lines
}
