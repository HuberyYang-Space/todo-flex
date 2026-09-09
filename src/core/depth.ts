import type { DerivedLayout } from './types'

/**
 * 把每个盒子的伸缩量归一化成方块厚度，值域 −1..1。
 *
 * 正数 = grow 分得空间（凸起），负数 = shrink 让出空间（凹陷），0 = 平衡态的平板。
 *
 * 归一化基准是**容器主轴尺寸**，不是组内最大 delta。按组内最大值归一化的话，
 * 任何状态下总有一个方块顶到满厚度，厚度就只剩「组内排名」的意思——
 * 改一下 gap 让最大值变了，全体厚度会跟着整体跳动，同一个盒子在不同状态下也不再可比。
 * 按容器归一化则是绝对量：分到容器的三分之一就是三分之一的厚度，跨状态可对照。
 *
 * 这里只归一化、不产出像素——像素上限是视觉参数，属于 visual/motion.ts。
 */
export function computeDepths(
  derived: DerivedLayout,
  containerMainSize: number,
): Map<string, number> {
  const depths = new Map<string, number>()

  for (const item of derived.items) {
    // 容器还没有尺寸时（首帧、被折叠）不猜，一律按平板处理，免得除出 Infinity
    if (containerMainSize <= 0) {
      depths.set(item.id, 0)
      continue
    }

    // grow 与 shrink 不会同时非零，直接相加即可得到带符号的伸缩量
    const delta = item.deltaFromGrow + item.deltaFromShrink
    depths.set(item.id, clamp(delta / containerMainSize, -1, 1))
  }

  return depths
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
