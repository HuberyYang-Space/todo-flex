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

  it('scrubbing 标志是模块级单例，滑块与手柄改的是同一份', () => {
    const first = useFlip()
    const second = useFlip()

    first.setScrubbing(true)
    expect(second.scrubbing.value).toBe(true)

    second.setScrubbing(false)
    expect(first.scrubbing.value).toBe(false)
  })
})
