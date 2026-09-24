import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('顶部说明仅演示区的属性不是 CSS、不会导出，代码里也确实没有它', () => {
    const wrapper = mount(CssOutput)

    expect(wrapper.get('[data-testid="css-note"]').text()).toContain('「内容尺寸」')
    expect(wrapper.get('[data-testid="css-note"]').text()).toContain('不是 CSS 属性')
    expect(wrapper.get('[data-testid="css-code"]').text()).not.toContain('内容尺寸')
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

  // 纯 icon 按钮在无障碍树里是哑的，断言的是每个态各自的 aria-label 都在，而不是「有个 icon」
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

  it('剪贴板写入被拒时明说失败，不抛未捕获异常', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })

    const wrapper = mount(CssOutput)
    const button = wrapper.get('[data-testid="copy-css"]')
    await button.trigger('click')
    await flushPromises()

    expect(button.attributes('aria-label')).toBe('复制失败，请手动选中复制')
    expect(button.find('.i-carbon-warning').exists()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('非安全上下文没有 navigator.clipboard 时同样落到失败态', async () => {
    vi.stubGlobal('navigator', {})

    const wrapper = mount(CssOutput)
    const button = wrapper.get('[data-testid="copy-css"]')
    await button.trigger('click')
    await flushPromises()

    expect(button.attributes('aria-label')).toBe('复制失败，请手动选中复制')
    vi.unstubAllGlobals()
  })

  it('连点两次时，第二次的提示不会被第一次的计时器提前抹掉', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })

    const wrapper = mount(CssOutput)
    const button = wrapper.get('[data-testid="copy-css"]')

    await button.trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1000)
    await button.trigger('click')
    await flushPromises()

    // 距第一次点击 1600ms、距第二次 600ms：第一次的计时器若还活着，这里已经被抹回去了
    await vi.advanceTimersByTimeAsync(600)
    expect(button.attributes('aria-label')).toBe('已复制')

    await vi.advanceTimersByTimeAsync(1000)
    expect(button.attributes('aria-label')).toBe('复制 CSS')

    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // basis 可由用户与分享链接任意填写，v-html 的安全性全系于 shiki 的转义——换高亮器或加回退路径都可能引入 XSS
  it('basis 里塞进标签只会被当成文本，v-html 不会长出活的元素', async () => {
    const payload = '</style><img src=x onerror=alert(1)>'
    useFlexState().state.items[0].basis = payload

    const wrapper = mount(CssOutput)
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="css-code"] span[style]').exists()).toBe(true)
    })

    const code = wrapper.get('[data-testid="css-code"]')
    expect(code.find('img').exists()).toBe(false)
    expect(code.text()).toContain(payload)
  })

  // 「分出了 token」和「用户看得到配色」是两件事，两个都要断言
  it('shiki 把 CSS 切成带配色变量的 token', async () => {
    const wrapper = mount(CssOutput)
    // shiki 是动态 import，一次 flushPromises 拍到的还是未高亮的首帧；轮询等不到会超时变红
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="css-code"] span[style]').exists()).toBe(true)
    })

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
