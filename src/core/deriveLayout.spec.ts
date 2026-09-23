import type { FlexItemState } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { deriveLayout } from './deriveLayout'

function stateWith(items: Partial<FlexItemState>[], width = 600, gap = 0) {
  const state = createDefaultState()
  state.container.width = width
  state.container.columnGap = gap
  state.items = items.map((spec, index) => ({ ...createDefaultItem(`i${index + 1}`), ...spec }))
  return state
}

function itemById(layout: ReturnType<typeof deriveLayout>, id: string) {
  const found = layout.items.find(item => item.id === id)
  if (!found)
    throw new Error(`未找到推导结果：${id}`)
  return found
}

describe('deriveLayout', () => {
  it('grow 为 0 时最终尺寸等于 basis，剩余空间留在行上', () => {
    const layout = deriveLayout(stateWith([{ basis: '100px' }, { basis: '100px' }]))
    expect(itemById(layout, 'i1').finalMainSize).toBe(100)
    expect(layout.lines[0].freeSpace).toBe(400)
  })

  it('flex: 1 1 0 时等分容器', () => {
    const layout = deriveLayout(stateWith([
      { grow: 1, shrink: 1, basis: '0' },
      { grow: 1, shrink: 1, basis: '0' },
      { grow: 1, shrink: 1, basis: '0' },
    ]))
    expect(itemById(layout, 'i1').finalMainSize).toBe(200)
    expect(itemById(layout, 'i2').finalMainSize).toBe(200)
    expect(itemById(layout, 'i3').finalMainSize).toBe(200)
  })

  it('flex: 1 1 auto 时按内容尺寸打底再分剩余，不是等分', () => {
    // 这是「flex:1 为什么没等分」的核心：basis auto 保留了内容尺寸
    const layout = deriveLayout(stateWith([
      { grow: 1, basis: 'auto', size: 100 },
      { grow: 1, basis: 'auto', size: 200 },
    ]))
    // 剩余 600-300=300，两项各分 150
    expect(itemById(layout, 'i1').finalMainSize).toBe(250)
    expect(itemById(layout, 'i2').finalMainSize).toBe(350)
  })

  it('gap 计入剩余空间', () => {
    const layout = deriveLayout(stateWith([
      { grow: 1, basis: '0' },
      { grow: 1, basis: '0' },
    ], 600, 40))
    expect(layout.lines[0].freeSpace).toBe(560)
    expect(itemById(layout, 'i1').finalMainSize).toBe(280)
  })

  it('溢出时按 shrink × basis 加权收缩', () => {
    const layout = deriveLayout(stateWith([
      { shrink: 1, basis: '600px' },
      { shrink: 1, basis: '200px' },
    ], 400))
    // 溢出 -400，权重 600:200 → -300 / -100
    expect(itemById(layout, 'i1').finalMainSize).toBe(300)
    expect(itemById(layout, 'i2').finalMainSize).toBe(100)
  })

  it('不模拟 min-width:auto 的下限截断，理论值可以小于内容尺寸', () => {
    // 这个缝隙是留给诊断层发现的，推导引擎必须诚实地给出「理论上会收到多小」
    const layout = deriveLayout(stateWith([
      { shrink: 1, basis: 'auto', size: 400, minWidthAuto: true },
      { shrink: 1, basis: 'auto', size: 400, minWidthAuto: true },
    ], 200))
    expect(itemById(layout, 'i1').finalMainSize).toBe(100)
  })

  // 期望值取自真实浏览器（min-width:0，只剩「尺寸不可能为负」这一道下限）
  it('被压穿的项冻结在 0，不算出负尺寸', () => {
    const layout = deriveLayout(stateWith([
      { basis: '100px', shrink: 5, minWidthAuto: false },
      { basis: '1000px', shrink: 0, minWidthAuto: false },
    ], 100))

    expect(itemById(layout, 'i1').finalMainSize).toBe(0)
    expect(itemById(layout, 'i2').finalMainSize).toBe(1000)
  })

  it('冻结之后，剩下的溢出量在其余项之间重新分摊', () => {
    const layout = deriveLayout(stateWith([
      { basis: '10px', shrink: 10, minWidthAuto: false },
      { basis: '200px', shrink: 1, minWidthAuto: false },
      { basis: '200px', shrink: 1, minWidthAuto: false },
    ], 100))

    expect(layout.items.map(item => item.finalMainSize)).toEqual([0, 50, 50])
  })

  it('因子之和小于 1 时与浏览器一致，分剩下的空间留在行上', () => {
    const grow = deriveLayout(stateWith([
      { basis: '100px', grow: 0.5, minWidthAuto: false },
      { basis: '100px', minWidthAuto: false },
    ], 600))
    expect(itemById(grow, 'i1').finalMainSize).toBe(300)
    expect(grow.lines[0].remainingFreeSpace).toBe(200)

    const shrink = deriveLayout(stateWith([{ basis: '900px', shrink: 0.5, minWidthAuto: false }], 600))
    expect(itemById(shrink, 'i1').finalMainSize).toBe(750)
  })

  it('分配之后的剩余：grow 吃光时为 0，没人 grow 时就是分配前的剩余', () => {
    const eaten = deriveLayout(stateWith([{ basis: '100px', grow: 1 }, { basis: '100px' }]))
    const kept = deriveLayout(stateWith([{ basis: '100px' }, { basis: '100px' }]))

    expect(eaten.lines[0].remainingFreeSpace).toBe(0)
    expect(kept.lines[0].remainingFreeSpace).toBe(400)
  })

  it('根字号一路传到分行与收缩里，不在半路退回默认值', () => {
    // 根字号 20 时 9em = 180px，两个放不进 330 的一行；按默认 16 算是 144，会被错排成两个一行
    const wrap = stateWith([{ basis: '9em' }, { basis: '9em' }, { basis: '9em' }], 330)
    wrap.container.wrap = 'wrap'
    expect(deriveLayout(wrap, 20).lines).toHaveLength(3)

    // 10em = 200、100px，溢出 50 按 200:100 分摊
    const shrink = deriveLayout(stateWith([{ basis: '10em', minWidthAuto: false }, { basis: '100px', minWidthAuto: false }], 250), 20)
    expect(itemById(shrink, 'i1').finalMainSize).toBeCloseTo(200 - 50 * 2 / 3)
  })

  it('有盒子的 basis 要到运行期才能确定时，整个容器的理论值都不给', () => {
    const layout = deriveLayout(stateWith([{ basis: 'calc(50% - 10px)' }, { basis: '100px' }]))

    expect(layout.items.map(item => item.finalMainSize)).toEqual([null, null])
    expect(layout.lines.map(line => line.remainingFreeSpace)).toEqual([null])
  })

  it('换行时每行独立计算剩余空间', () => {
    const state = stateWith([{ basis: '200px' }, { basis: '200px' }, { basis: '100px' }], 400)
    state.container.wrap = 'wrap'
    const layout = deriveLayout(state)
    expect(layout.lines).toHaveLength(2)
    expect(layout.lines[0].freeSpace).toBe(0)
    expect(layout.lines[1].freeSpace).toBe(300)
    expect(itemById(layout, 'i3').lineIndex).toBe(1)
  })

  it('每行都记录 totalGrow 与 totalShrinkWeighted', () => {
    const layout = deriveLayout(stateWith([
      { grow: 2, shrink: 1, basis: '100px' },
      { grow: 1, shrink: 2, basis: '100px' },
    ]))
    expect(layout.lines[0].totalGrow).toBe(3)
    expect(layout.lines[0].totalShrinkWeighted).toBe(300)
  })
})
