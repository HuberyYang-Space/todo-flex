import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ComparePanel from './ComparePanel.vue'

function hidden(wrapper: ReturnType<typeof mount>, key: string): boolean {
  return (wrapper.get(`#compare-panel-${key}`).attributes('style') ?? '').includes('display: none')
}

describe('comparePanel', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useMeasure().measured.value = null
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('默认停在明细表', () => {
    const wrapper = mount(ComparePanel)

    expect(wrapper.get('[data-testid="tab-metrics"]').attributes('aria-selected')).toBe('true')
    expect(hidden(wrapper, 'metrics')).toBe(false)
    expect(hidden(wrapper, 'derivation')).toBe(true)
  })

  it('点推导过程切过去，标签名带上选中的盒子', async () => {
    useFlexState().selectItem('item-2')
    const wrapper = mount(ComparePanel)
    await wrapper.get('[data-testid="tab-derivation"]').trigger('click')

    expect(wrapper.get('[data-testid="tab-derivation"]').text()).toBe('推导过程-盒子 B')
    expect(wrapper.get('[data-testid="tab-derivation"]').attributes('aria-selected')).toBe('true')
    expect(hidden(wrapper, 'derivation')).toBe(false)
    expect(hidden(wrapper, 'metrics')).toBe(true)
  })

  it('选中盒子不会把明细表切走', async () => {
    const wrapper = mount(ComparePanel)
    useFlexState().selectItem('item-1')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="tab-metrics"]').attributes('aria-selected')).toBe('true')
  })

  it('方向键切换标签，焦点跟着走', async () => {
    const wrapper = mount(ComparePanel, { attachTo: document.body })
    const metricsTab = wrapper.get('[data-testid="tab-metrics"]')
    ;(metricsTab.element as HTMLElement).focus()
    await metricsTab.trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.get('[data-testid="tab-derivation"]').attributes('aria-selected')).toBe('true')
    expect(document.activeElement?.id).toBe('compare-tab-derivation')

    await wrapper.get('[data-testid="tab-derivation"]').trigger('keydown', { key: 'Home' })
    expect(document.activeElement?.id).toBe('compare-tab-metrics')
    wrapper.unmount()
  })

  it('只有当前标签进 Tab 键序列，面板指回自己的标签', () => {
    const wrapper = mount(ComparePanel)

    expect(wrapper.get('[data-testid="tab-metrics"]').attributes('tabindex')).toBe('0')
    expect(wrapper.get('[data-testid="tab-derivation"]').attributes('tabindex')).toBe('-1')
    expect(wrapper.get('#compare-panel-derivation').attributes('aria-labelledby')).toBe('compare-tab-derivation')
  })
})
