import { mount } from '@vue/test-utils'
import { Flip } from 'gsap/Flip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import DemoStage from '~/components/playground/DemoStage.vue'
import { useFlexState } from './useFlexState'
import { useFlip } from './useFlip'

describe('useFlip', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useFlip().setScrubbing(false)
    vi.restoreAllMocks()
  })

  it('离散的状态变化会拍下 Flip 快照', async () => {
    const spy = vi.spyOn(Flip, 'getState')
    const wrapper = mount(DemoStage, { attachTo: document.body })
    await nextTick()

    useFlexState().state.container.justifyContent = 'center'
    await nextTick()

    expect(spy).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('系统要求减弱动效时，布局照变但过渡时长归零', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    const spy = vi.spyOn(Flip, 'from')
    const wrapper = mount(DemoStage, { attachTo: document.body })
    await nextTick()

    useFlexState().state.container.justifyContent = 'center'
    await nextTick()
    await nextTick()

    // 时长归零而不是不调用 Flip：布局该变还得变，只是不再有过渡
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls[0][1]?.duration).toBe(0)
    expect(spy.mock.calls[0][1]?.stagger).toBe(0)
    wrapper.unmount()
  })

  it('没有减弱动效偏好时照常给出非零时长', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
    const spy = vi.spyOn(Flip, 'from')
    const wrapper = mount(DemoStage, { attachTo: document.body })
    await nextTick()

    useFlexState().state.container.justifyContent = 'center'
    await nextTick()
    await nextTick()

    expect(spy.mock.calls[0][1]?.duration).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('单行布局不启用 absolute 模式，免得盒子白白脱离 flex 布局', async () => {
    const spy = vi.spyOn(Flip, 'from')
    const wrapper = mount(DemoStage, { attachTo: document.body })
    await nextTick()

    useFlexState().state.container.justifyContent = 'center'
    await nextTick()
    await nextTick()

    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls[0][1]?.absolute).toBe(false)
    wrapper.unmount()
  })

  it('换行布局才启用 absolute 模式，跨行迁移需要它', async () => {
    useFlexState().state.container.wrap = 'wrap'
    const spy = vi.spyOn(Flip, 'from')
    const wrapper = mount(DemoStage, { attachTo: document.body })
    await nextTick()

    useFlexState().state.container.justifyContent = 'center'
    await nextTick()
    await nextTick()

    expect(spy.mock.calls[0][1]?.absolute).toBe(true)
    wrapper.unmount()
  })

  it('连续拖拽期间不拍快照，让方块直接跟手', async () => {
    const wrapper = mount(DemoStage, { attachTo: document.body })
    await nextTick()

    const spy = vi.spyOn(Flip, 'getState')
    useFlip().setScrubbing(true)
    useFlexState().state.container.width = 500
    await nextTick()

    expect(spy).not.toHaveBeenCalled()

    useFlip().setScrubbing(false)
    wrapper.unmount()
  })

  it('指针在控件外面松开也能结束拖拽，不会把动画永久抑制掉', () => {
    const { scrubbing, setScrubbing } = useFlip()
    setScrubbing(true)

    // 在滑块上按下、拖到别处松手：事件不会落回滑块，只能靠全局兜底
    window.dispatchEvent(new Event('pointerup'))

    expect(scrubbing.value).toBe(false)
  })

  it('指针事件被取消时同样结束拖拽', () => {
    const { scrubbing, setScrubbing } = useFlip()
    setScrubbing(true)

    window.dispatchEvent(new Event('pointercancel'))

    expect(scrubbing.value).toBe(false)
  })

  it('scrubbing 标志是模块级单例，滑块与手柄改的是同一份', () => {
    const first = useFlip()
    const second = useFlip()

    first.setScrubbing(true)
    expect(second.scrubbing.value).toBe(true)

    second.setScrubbing(false)
    expect(first.scrubbing.value).toBe(false)
  })
})
