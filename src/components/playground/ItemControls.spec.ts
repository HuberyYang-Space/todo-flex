import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_ITEMS, useFlexState } from '~/composables/useFlexState'
import ItemControls from './ItemControls.vue'
import ItemList from './ItemList.vue'

describe('itemControls', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('未选中盒子时给出提示而不是空白面板', () => {
    const wrapper = mount(ItemControls)
    expect(wrapper.find('[data-testid="item-empty"]').exists()).toBe(true)
  })

  it('选中后渲染该盒子的属性控件', async () => {
    const wrapper = mount(ItemControls)
    useFlexState().selectItem('item-2')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="item-empty"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('flex-grow')
    expect(wrapper.text()).toContain('flex-basis')
  })

  it('改动只作用于当前选中的盒子', async () => {
    const { state, selectItem } = useFlexState()
    const wrapper = mount(ItemControls)
    selectItem('item-2')
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-value="0"]').trigger('click')
    expect(state.items[1].basis).toBe('0')
    expect(state.items[0].basis).toBe('auto')
  })

  it('flex 简写预设一次回填三个分量', async () => {
    const { state, selectItem } = useFlexState()
    const wrapper = mount(ItemControls)
    selectItem('item-1')
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-preset="1"]').trigger('click')
    expect(state.items[0]).toMatchObject({ grow: 1, shrink: 1, basis: '0' })

    await wrapper.get('[data-preset="none"]').trigger('click')
    expect(state.items[0]).toMatchObject({ grow: 0, shrink: 0, basis: 'auto' })
  })

  it('当前三元组与某个预设吻合时该预设高亮', async () => {
    const { state, selectItem } = useFlexState()
    const wrapper = mount(ItemControls)
    selectItem('item-1')
    state.items[0].grow = 1
    state.items[0].shrink = 1
    state.items[0].basis = 'auto'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-preset="auto"]').classes()).toContain('is-active')
    expect(wrapper.get('[data-preset="none"]').classes()).not.toContain('is-active')
  })
})

describe('itemList', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('列出全部盒子', () => {
    expect(mount(ItemList).findAll('[data-testid="item-row"]')).toHaveLength(3)
  })

  it('新增按钮追加盒子', async () => {
    const wrapper = mount(ItemList)
    await wrapper.get('[data-testid="add-item"]').trigger('click')
    expect(useFlexState().state.items).toHaveLength(4)
  })

  it('到达上限后新增按钮禁用', async () => {
    const { addItem } = useFlexState()
    for (let i = 0; i < MAX_ITEMS; i++)
      addItem()
    const wrapper = mount(ItemList)
    expect(wrapper.get('[data-testid="add-item"]').attributes('disabled')).toBeDefined()
  })

  it('删除按钮移除对应盒子', async () => {
    const wrapper = mount(ItemList)
    await wrapper.findAll('[data-testid="remove-item"]')[0].trigger('click')
    const { state } = useFlexState()
    expect(state.items).toHaveLength(2)
    expect(state.items.map(item => item.id)).not.toContain('item-1')
  })

  it('点击行选中该盒子', async () => {
    const wrapper = mount(ItemList)
    await wrapper.findAll('[data-testid="item-row"]')[2].trigger('click')
    expect(useFlexState().state.selectedId).toBe('item-3')
  })
})
