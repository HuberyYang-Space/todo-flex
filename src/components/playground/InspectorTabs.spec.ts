import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import InspectorTabs from './InspectorTabs.vue'

describe('inspectorTabs', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('默认停在明细：理论 vs 实际先出现，CSS 不渲染', () => {
    const wrapper = mount(InspectorTabs)

    expect(wrapper.find('[data-testid="metrics"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="css-code"]').exists()).toBe(false)
  })

  it('切到 CSS 后两块互换，同一时刻只有一块占着这片地方', async () => {
    const wrapper = mount(InspectorTabs)
    await wrapper.get('[data-testid="inspector-tab-css"]').trigger('click')

    expect(wrapper.find('[data-testid="css-code"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="metrics"]').exists()).toBe(false)
  })

  it('当前标签在无障碍树里标出来，不止是看着高亮', async () => {
    const wrapper = mount(InspectorTabs)
    const metricsTab = wrapper.get('[data-testid="inspector-tab-metrics"]')
    const cssTab = wrapper.get('[data-testid="inspector-tab-css"]')

    expect(metricsTab.attributes('aria-selected')).toBe('true')
    expect(cssTab.attributes('aria-selected')).toBe('false')

    await cssTab.trigger('click')
    expect(metricsTab.attributes('aria-selected')).toBe('false')
    expect(cssTab.attributes('aria-selected')).toBe('true')
  })

  it('切回明细后能重新读到行，不是切走就丢了状态', async () => {
    const wrapper = mount(InspectorTabs)
    await wrapper.get('[data-testid="inspector-tab-css"]').trigger('click')
    await wrapper.get('[data-testid="inspector-tab-metrics"]').trigger('click')

    expect(wrapper.findAll('[data-testid="metrics-row"]')).toHaveLength(3)
  })
})
