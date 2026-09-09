import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import { useOverlay } from '~/composables/useOverlay'
import ThePlayground from './ThePlayground.vue'

describe('thePlayground', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('同时渲染操作区、演示区与 CSS 输出', () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.find('[data-testid="stage"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="css-code"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('容器属性')
    expect(wrapper.text()).toContain('盒子属性')
  })

  it('明细区随演示区一起呈现，每个盒子一行', () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.find('[data-testid="metrics"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="metrics-row"]')).toHaveLength(3)
  })

  it('拖拽手柄的键盘微调改变演示区尺寸', async () => {
    const wrapper = mount(ThePlayground)
    await wrapper.get('[data-testid="stage-resizer"]').trigger('keydown', { key: 'ArrowRight', shiftKey: true })

    expect(useFlexState().state.container.width).toBe(730)
    expect(wrapper.get('[data-testid="stage"]').attributes('style')).toContain('width: 730px')
  })

  it('叠加层开关能收起整层', async () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.find('[data-testid="overlay-toggle"]').exists()).toBe(true)

    await wrapper.get('[data-testid="overlay-toggle"]').trigger('change')
    expect(useOverlay().visible.value).toBe(false)

    // 单例状态跨用例共享，改回去免得影响后面的用例
    useOverlay().toggleVisible()
  })

  it('在演示区选中盒子后，属性面板切换到该盒子', async () => {
    const wrapper = mount(ThePlayground)
    await wrapper.findAll('[data-testid="stage-item"]')[1].trigger('click')
    expect(wrapper.get('[data-testid="item-title"]').text()).toContain('item-2')
    expect(wrapper.find('[data-testid="item-empty"]').exists()).toBe(false)
  })

  it('重置按钮恢复默认状态', async () => {
    const { state } = useFlexState()
    state.container.direction = 'column'
    const wrapper = mount(ThePlayground)
    await wrapper.get('[data-testid="reset"]').trigger('click')
    expect(state.container.direction).toBe('row')
  })
})
