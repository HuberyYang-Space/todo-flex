import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import { containerProperties } from '~/data/flexProperties'
import ContainerControls from './ContainerControls.vue'

describe('containerControls', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('为表里每个容器属性都渲染一组控件', () => {
    const wrapper = mount(ContainerControls)
    for (const prop of containerProperties)
      expect(wrapper.text()).toContain(prop.cssName)
  })

  it('点击枚举选项写回状态', async () => {
    const wrapper = mount(ContainerControls)
    await wrapper.get('[data-value="column"]').trigger('click')
    expect(useFlexState().state.container.direction).toBe('column')
  })

  it('默认不展示 advanced 选项，展开后可见', async () => {
    const wrapper = mount(ContainerControls)
    expect(wrapper.find('[data-value="left"]').exists()).toBe(false)
    await wrapper.get('[data-testid="toggle-advanced"]').trigger('click')
    expect(wrapper.find('[data-value="left"]').exists()).toBe(true)
  })

  it('数值控件写回状态且为数字类型', async () => {
    const wrapper = mount(ContainerControls)
    const input = wrapper.get('input[type="range"]')
    await input.setValue('24')
    const { state } = useFlexState()
    expect(state.container.rowGap).toBe(24)
    expect(typeof state.container.rowGap).toBe('number')
  })

  it('当前值对应的选项带 is-active 标记', () => {
    useFlexState().state.container.justifyContent = 'center'
    const wrapper = mount(ContainerControls)
    expect(wrapper.get('[data-value="center"]').classes()).toContain('is-active')
  })
})
