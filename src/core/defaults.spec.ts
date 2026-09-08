import { describe, expect, it } from 'vitest'
import { isRowDirection, mainAxisGap, mainAxisSize } from './axis'
import { createDefaultItem, createDefaultState } from './defaults'

describe('createDefaultState', () => {
  it('默认是 row 方向、不换行的三盒子布局', () => {
    const state = createDefaultState()
    expect(state.container.direction).toBe('row')
    expect(state.container.wrap).toBe('nowrap')
    expect(state.items).toHaveLength(3)
    expect(state.selectedId).toBeNull()
  })

  it('每个盒子的 id 唯一', () => {
    const ids = createDefaultState().items.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('默认盒子是 flex: 0 1 auto，保留 min-width:auto', () => {
    const item = createDefaultItem('item-1')
    expect(item.grow).toBe(0)
    expect(item.shrink).toBe(1)
    expect(item.basis).toBe('auto')
    expect(item.minWidthAuto).toBe(true)
    expect(item.marginAuto).toBe(false)
  })
})

describe('轴向工具', () => {
  it('row / row-reverse 的主轴是横向', () => {
    expect(isRowDirection('row')).toBe(true)
    expect(isRowDirection('row-reverse')).toBe(true)
    expect(isRowDirection('column')).toBe(false)
    expect(isRowDirection('column-reverse')).toBe(false)
  })

  it('主轴尺寸随 direction 在宽高之间切换', () => {
    const state = createDefaultState()
    state.container.width = 720
    state.container.height = 320
    expect(mainAxisSize(state.container)).toBe(720)
    state.container.direction = 'column'
    expect(mainAxisSize(state.container)).toBe(320)
  })

  it('主轴间距 row 取 column-gap、column 取 row-gap', () => {
    const state = createDefaultState()
    state.container.rowGap = 8
    state.container.columnGap = 16
    expect(mainAxisGap(state.container)).toBe(16)
    state.container.direction = 'column'
    expect(mainAxisGap(state.container)).toBe(8)
  })
})
