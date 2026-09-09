import type { DerivedItem, DerivedLayout } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultState } from './defaults'
import { computeDepths } from './depth'
import { deriveLayout } from './deriveLayout'

/** 只有 computeDepths 用得到的字段是真的，其余补零 */
function makeDerived(items: Pick<DerivedItem, 'id' | 'deltaFromGrow' | 'deltaFromShrink'>[]): DerivedLayout {
  return {
    lines: [],
    items: items.map(item => ({
      ...item,
      basisResolved: 0,
      hypotheticalMainSize: 0,
      finalMainSize: 0,
      lineIndex: 0,
    })),
    steps: [],
  }
}

describe('computeDepths', () => {
  it('平衡态的盒子厚度为 0，是一块平板', () => {
    const derived = makeDerived([{ id: 'a', deltaFromGrow: 0, deltaFromShrink: 0 }])
    expect(computeDepths(derived, 720).get('a')).toBe(0)
  })

  it('grow 分得的空间按容器主轴尺寸归一化成正厚度', () => {
    const derived = makeDerived([{ id: 'a', deltaFromGrow: 360, deltaFromShrink: 0 }])
    expect(computeDepths(derived, 720).get('a')).toBe(0.5)
  })

  it('shrink 让出的空间归一化成负厚度', () => {
    const derived = makeDerived([{ id: 'a', deltaFromGrow: 0, deltaFromShrink: -180 }])
    expect(computeDepths(derived, 720).get('a')).toBe(-0.25)
  })

  it('归一化基准是容器尺寸而不是组内最大值，两个盒子各按自己的比例算', () => {
    const derived = makeDerived([
      { id: 'a', deltaFromGrow: 400, deltaFromShrink: 0 },
      { id: 'b', deltaFromGrow: 100, deltaFromShrink: 0 },
    ])
    const depths = computeDepths(derived, 800)
    // 按组内最大值归一化的话 a 会是 1、b 会是 0.25；按容器归一化则是各自的绝对占比
    expect(depths.get('a')).toBe(0.5)
    expect(depths.get('b')).toBe(0.125)
  })

  it('超出容器尺寸的极端值截到 ±1，不产出超厚方块', () => {
    const derived = makeDerived([
      { id: 'a', deltaFromGrow: 5000, deltaFromShrink: 0 },
      { id: 'b', deltaFromGrow: 0, deltaFromShrink: -5000 },
    ])
    const depths = computeDepths(derived, 400)
    expect(depths.get('a')).toBe(1)
    expect(depths.get('b')).toBe(-1)
  })

  it('容器尺寸为 0 时全部归零，不产出 Infinity 或 NaN', () => {
    const derived = makeDerived([{ id: 'a', deltaFromGrow: 100, deltaFromShrink: 0 }])
    const depths = computeDepths(derived, 0)
    expect(depths.get('a')).toBe(0)
    expect(Number.isFinite(depths.get('a'))).toBe(true)
  })

  it('接得住推导引擎的真实输出：默认状态三个盒子都不伸缩，全是平板', () => {
    const state = createDefaultState()
    const depths = computeDepths(deriveLayout(state), state.container.width)
    expect([...depths.values()]).toEqual([0, 0, 0])
  })

  it('接得住推导引擎的真实输出：单个盒子 grow 独吞剩余空间时明显凸起', () => {
    const state = createDefaultState()
    state.items[0].grow = 1
    const depths = computeDepths(deriveLayout(state), state.container.width)
    // 720 - 240 - 24 = 456 全给了第一个盒子
    expect(depths.get('item-1')).toBeCloseTo(456 / 720, 5)
    expect(depths.get('item-2')).toBe(0)
  })
})
