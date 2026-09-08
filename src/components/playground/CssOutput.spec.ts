import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import CssOutput from './CssOutput.vue'

describe('cssOutput', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('渲染当前状态对应的 CSS', () => {
    const wrapper = mount(CssOutput)
    const code = wrapper.get('[data-testid="css-code"]').text()
    expect(code).toContain('display: flex')
    expect(code).toContain('.item-1')
  })

  it('状态变化后 CSS 同步更新', async () => {
    const { state } = useFlexState()
    const wrapper = mount(CssOutput)
    state.container.justifyContent = 'space-evenly'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="css-code"]').text()).toContain('justify-content: space-evenly')
  })

  it('点击复制把 CSS 写入剪贴板', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const wrapper = mount(CssOutput)
    await wrapper.get('[data-testid="copy-css"]').trigger('click')

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0][0]).toContain('display: flex')
    vi.unstubAllGlobals()
  })
})
