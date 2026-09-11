import type { Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import * as trapScroll from '~/composables/useTrapScroll'
import { traps } from '~/data/traps'
import TrapSection from './TrapSection.vue'

/*
 * 整个 useTrapScroll 换成假的，不走 importOriginal——
 * 真模块会连带加载 gsap/ScrollTrigger，happy-dom 里没有排版引擎，白白冒险。
 * 它自己的逻辑已经在 useTrapScroll.spec.ts 里单独测过了。
 *
 * ref 在 mock 工厂内部创建、再顺手多导出两个下划线开头的口子给测试用。
 * 不在工厂外面建：vi.mock 会被提升到所有 import 之前，那时外层变量还没初始化。
 */
vi.mock('~/composables/useTrapScroll', async () => {
  const vue = await import('vue')
  const beat = vue.ref(0)
  const degraded = vue.ref(false)

  return {
    BEAT_COUNT: 3,
    useTrapScroll: () => ({ beat, degraded }),
    prefersReducedMotion: () => false,
    shouldDegrade: () => false,
    beatFromProgress: (progress: number) => progress,
    __beat: beat,
    __degraded: degraded,
  }
})

// 拿到 mock 内部那两个 ref，好在 mount 之后推进拍号
const { __beat: beatRef, __degraded: degradedRef } = trapScroll as unknown as {
  __beat: Ref<number>
  __degraded: Ref<boolean>
}

const trap = traps.find(item => item.id === 'min-width-auto')!

function mountSection() {
  return mount(TrapSection, { props: { trap } })
}

describe('trapSection', () => {
  beforeEach(() => {
    beatRef.value = 0
    degradedRef.value = false
    useFlexState().resetState()
    vi.restoreAllMocks()
  })

  it('渲染陷阱标题与钩子', () => {
    const text = mountSection().text()

    expect(text).toContain(trap.title)
    expect(text).toContain(trap.hook)
  })

  it('三拍的文案都在 DOM 里，靠 class 标出当前拍', () => {
    const wrapper = mountSection()
    const beats = wrapper.findAll('[data-testid="trap-beat"]')

    expect(beats).toHaveLength(3)
    expect(beats[0].classes()).toContain('is-active')
    expect(beats[1].classes()).not.toContain('is-active')
  })

  it('拍号变化时当前拍跟着换', async () => {
    const wrapper = mountSection()

    beatRef.value = 1
    await wrapper.vm.$nextTick()

    const beats = wrapper.findAll('[data-testid="trap-beat"]')
    expect(beats[0].classes()).not.toContain('is-active')
    expect(beats[1].classes()).toContain('is-active')
  })

  it('前两拍演示区停在现象态——归因不能把正在解释的现象换掉', async () => {
    const wrapper = mountSection()
    const atFirstBeat = firstItemStyle(wrapper)

    beatRef.value = 1
    await wrapper.vm.$nextTick()

    expect(firstItemStyle(wrapper)).toBe(atFirstBeat)
    // 现象态的自动最小尺寸是开着的，不该出现修复态才有的那行
    expect(firstItemStyle(wrapper)).not.toContain('min-width: 0px')
  })

  it('第三拍演示区切到修复态', async () => {
    const wrapper = mountSection()

    beatRef.value = 2
    await wrapper.vm.$nextTick()

    // 陷阱一的修复态关掉了自动最小尺寸，盒子样式上会多出 min-width: 0px
    const first = wrapper.findAll('[data-testid="trap-stage-item"]')[0]
    expect(first.attributes('style')).toContain('min-width: 0px')
  })

  it('差异表只出现在归因那一拍的卡片里', () => {
    const wrapper = mountSection()
    const beats = wrapper.findAll('[data-testid="trap-beat"]')

    expect(beats[1].find('[data-testid="trap-diff-row"]').exists()).toBe(true)
    expect(beats[0].find('[data-testid="trap-diff-row"]').exists()).toBe(false)
    expect(beats[2].find('[data-testid="trap-diff-row"]').exists()).toBe(false)
  })

  it('载入现象按钮把现象态写进全局状态', async () => {
    const scrollIntoView = vi.fn()
    vi.spyOn(document, 'getElementById').mockReturnValue({ scrollIntoView } as unknown as HTMLElement)
    const { state } = useFlexState()

    await mountSection().get('[data-testid="trap-load-before"]').trigger('click')

    expect(state.container.width).toBe(480)
    expect(state.items[0].minWidthAuto).toBe(true)
    expect(state.items[0].size).toBe(320)
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('载入修复按钮把修复态写进全局状态', async () => {
    vi.spyOn(document, 'getElementById').mockReturnValue({ scrollIntoView: vi.fn() } as unknown as HTMLElement)
    const { state } = useFlexState()

    await mountSection().get('[data-testid="trap-load-after"]').trigger('click')

    expect(state.items[0].minWidthAuto).toBe(false)
  })

  it('playground 不在页面上时照样载入状态，只是不滚动', async () => {
    vi.spyOn(document, 'getElementById').mockReturnValue(null)
    const { state } = useFlexState()

    await mountSection().get('[data-testid="trap-load-before"]').trigger('click')

    // 滚不过去不该连累载入——没抛错，状态也确实换了
    expect(state.container.width).toBe(480)
  })

  it('降级形态下三拍各配一个演示区，全部展开', async () => {
    degradedRef.value = true
    const wrapper = mountSection()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid="trap-stage"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="trap-beat"]')).toHaveLength(3)
  })

  it('正常形态下只有一个演示区', () => {
    expect(mountSection().findAll('[data-testid="trap-stage"]')).toHaveLength(1)
  })
})

/** 取第一个盒子的行内样式，用来判断演示区当前渲染的是哪一态 */
function firstItemStyle(wrapper: ReturnType<typeof mountSection>): string | undefined {
  return wrapper.findAll('[data-testid="trap-stage-item"]')[0].attributes('style')
}
