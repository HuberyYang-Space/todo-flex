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

  it('换行时每行独立计算剩余空间', () => {
    const state = stateWith([{ basis: '200px' }, { basis: '200px' }, { basis: '100px' }], 400)
    state.container.wrap = 'wrap'
    const layout = deriveLayout(state)
    expect(layout.lines).toHaveLength(2)
    expect(layout.lines[0].freeSpace).toBe(0)
    expect(layout.lines[1].freeSpace).toBe(300)
    expect(itemById(layout, 'i3').lineIndex).toBe(1)
  })

  it('输出可展示的推导步骤', () => {
    const layout = deriveLayout(stateWith([
      { grow: 1, basis: '0' },
      { grow: 3, basis: '0' },
    ]))
    const growSteps = layout.steps.filter(step => step.kind === 'growDistribute')
    expect(growSteps).toHaveLength(2)
    expect(growSteps[1].itemId).toBe('i2')
    expect(growSteps[1].params.delta).toBe(450)
    expect(growSteps[1].params.totalGrow).toBe(4)
    expect(layout.steps.some(step => step.kind === 'freeSpace')).toBe(true)
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
