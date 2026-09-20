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

  it('每个枚举属性的取值一次全摆出来，没有折叠区', () => {
    const wrapper = mount(ContainerControls)

    // 原先收在「更多值」里的近义值，现在首屏就在
    expect(wrapper.find('[data-value="left"]').exists()).toBe(true)
    expect(wrapper.find('[data-value="self-start"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="toggle-advanced"]').exists()).toBe(false)

    for (const prop of containerProperties) {
      if (prop.kind !== 'enum')
        continue
      for (const option of prop.options)
        expect(wrapper.find(`[data-value="${option.value}"]`).exists(), `${prop.cssName} 缺了 ${option.value}`).toBe(true)
    }
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
