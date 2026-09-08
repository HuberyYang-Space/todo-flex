import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_ITEMS, useFlexState } from './useFlexState'

describe('useFlexState', () => {
  beforeEach(() => {
    // 状态是模块级单例，每个用例前必须复位
    useFlexState().resetState()
  })

  it('初始为三个盒子且未选中', () => {
    const { state } = useFlexState()
    expect(state.items).toHaveLength(3)
    expect(state.selectedId).toBeNull()
  })

  it('多次调用共享同一份状态', () => {
    useFlexState().state.container.direction = 'column'
    expect(useFlexState().state.container.direction).toBe('column')
  })

  it('新增的盒子 id 不与已删除的重复', () => {
    const { state, addItem, removeItem } = useFlexState()
    removeItem('item-1')
    addItem()
    const ids = state.items.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('item-1')
  })

  it('盒子数量有上限，防止面板与演示区过载', () => {
    const { state, addItem } = useFlexState()
    for (let i = 0; i < 20; i++)
      addItem()
    expect(state.items).toHaveLength(MAX_ITEMS)
  })

  it('至少保留一个盒子', () => {
    const { state, removeItem } = useFlexState()
    for (const id of [...state.items.map(item => item.id)])
      removeItem(id)
    expect(state.items).toHaveLength(1)
  })

  it('删除选中的盒子会清空选中状态', () => {
    const { state, selectItem, removeItem } = useFlexState()
    selectItem('item-2')
    removeItem('item-2')
    expect(state.selectedId).toBeNull()
  })

  it('selectedItem 跟随选中 id', () => {
    const { selectedItem, selectItem } = useFlexState()
    expect(selectedItem.value).toBeNull()
    selectItem('item-2')
    expect(selectedItem.value?.id).toBe('item-2')
  })

  it('derived 与 css 随状态变化重新计算', () => {
    const { state, derived, css } = useFlexState()
    state.container.width = 600
    state.items.forEach((item) => {
      item.grow = 1
      item.basis = '0'
    })
    expect(derived.value.items[0].finalMainSize).toBe(192) // (600 - 24) / 3
    expect(css.value).toContain('flex: 1 1 0;')
  })
})
