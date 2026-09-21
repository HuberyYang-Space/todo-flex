import { flushPromises, mount } from '@vue/test-utils'
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

  /*
   * 这条守卫钉的是「复制按钮是 icon，而且换成 icon 之后无障碍信息没丢」。
   *
   * 纯 icon 按钮在无障碍树里是哑的——它没有文本节点，读屏器只会念出「按钮」。
   * 原来那版按钮的文案「复制 / 已复制」同时承担了视觉与无障碍两份职责，
   * 换成 icon 就把后一份弄丢了，而且这件事在界面上完全看不出来。
   * 所以这里断言的不是「有个 icon」，是「两个态各自的 aria-label 都在」。
   */
  it('复制按钮用 icon 呈现，两个态都留着无障碍名称', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })

    const wrapper = mount(CssOutput)
    const button = wrapper.get('[data-testid="copy-css"]')

    expect(button.text(), '复制按钮不该再有文案，icon 才是唯一的视觉载体').toBe('')
    expect(button.find('.i-carbon-copy').exists()).toBe(true)
    expect(button.attributes('aria-label')).toBe('复制 CSS')

    await button.trigger('click')
    await flushPromises()

    expect(button.find('.i-carbon-checkmark').exists(), '已复制态要换 icon，不然点了没反馈').toBe(true)
    expect(button.attributes('aria-label')).toBe('已复制')

    vi.unstubAllGlobals()
  })

  /*
   * 这条守卫钉的是「代码块真的被高亮了」。
   *
   * 上一版用 Prism，标记是生成了（<span class="token">），但 main.css 里一行 token 配色都没有，
   * 于是界面上看到的是一整块单色文本——「高亮跑通了」和「用户看得到高亮」是两件事。
   * 所以这里既要断言分词结果（一行 CSS 被拆成多个 token），
   * 也要断言 token 身上带着配色变量，否则同样的哑火会再来一次。
   */
  it('shiki 把 CSS 切成带配色变量的 token', async () => {
    const wrapper = mount(CssOutput)
    await flushPromises()

    const code = wrapper.get('[data-testid="css-code"]')
    const spans = code.findAll('span[style]')
    expect(spans.length, '没有任何带内联样式的 token，说明高亮没落地').toBeGreaterThan(5)

    const styles = spans.map(span => span.attributes('style') ?? '').join(' ')
    expect(styles, '暗亮两套配色都要写进自定义属性，少一套就有一个主题读不了').toContain('--shiki-light')
    expect(styles).toContain('--shiki-dark')

    // 高亮后文本内容必须原样保留，不能被转义或吞字
    expect(code.text()).toContain('display: flex')
  })
})
