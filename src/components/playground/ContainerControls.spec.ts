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

  it('每个输入控件都有各不相同的可访问名称，读屏下分得清两个 gap 滑块', () => {
    const wrapper = mount(ContainerControls)
    const names = wrapper.findAll('input').map(input => input.attributes('aria-label'))

    expect(names.length).toBeGreaterThan(0)
    for (const name of names)
      expect(name).toBeTruthy()
    expect(new Set(names).size).toBe(names.length)
  })

  it('枚举选项按属性分组，并用 aria-pressed 暴露当前取值', () => {
    useFlexState().state.container.justifyContent = 'center'
    const wrapper = mount(ContainerControls)
    const group = wrapper.get('[role="group"][aria-label="justify-content"]')

    expect(group.get('[data-value="center"]').attributes('aria-pressed')).toBe('true')
    expect(group.get('[data-value="flex-start"]').attributes('aria-pressed')).toBe('false')
  })

  it('当前值对应的选项带 is-active 标记', () => {
    useFlexState().state.container.justifyContent = 'center'
    const wrapper = mount(ContainerControls)
    expect(wrapper.get('[data-value="center"]').classes()).toContain('is-active')
  })
})
