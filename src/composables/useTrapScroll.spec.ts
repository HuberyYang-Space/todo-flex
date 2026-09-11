import { mount } from '@vue/test-utils'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { BEAT_COUNT, beatFromProgress, prefersReducedMotion, shouldDegrade, useTrapScroll } from './useTrapScroll'

describe('beatFromProgress', () => {
  it('三拍平分整段进度', () => {
    expect(BEAT_COUNT).toBe(3)
    expect(beatFromProgress(0, 0)).toBe(0)
    expect(beatFromProgress(0.5, 1)).toBe(1)
    expect(beatFromProgress(0.9, 2)).toBe(2)
  })

  it('进度跑满时停在最后一拍，不越界', () => {
    expect(beatFromProgress(1, 2)).toBe(2)
    expect(beatFromProgress(1.2, 2)).toBe(2)
  })

  it('进度为负时停在第一拍', () => {
    expect(beatFromProgress(-0.3, 0)).toBe(0)
  })

  it('刚过边界一点点不换拍——滞回把抖动挡在外面', () => {
    // 边界在 1/3 ≈ 0.3333，滞回带宽 0.04，所以 0.34 还不够
    expect(beatFromProgress(0.34, 0)).toBe(0)
  })

  it('越过滞回带才换拍', () => {
    expect(beatFromProgress(0.40, 0)).toBe(1)
  })

  it('往回滚同样要越过滞回带才退拍', () => {
    expect(beatFromProgress(0.32, 1)).toBe(1)
    expect(beatFromProgress(0.28, 1)).toBe(0)
  })

  it('第二道边界上的滞回与第一道一致', () => {
    expect(beatFromProgress(0.68, 1)).toBe(1)
    expect(beatFromProgress(0.72, 1)).toBe(2)
    expect(beatFromProgress(0.65, 2)).toBe(2)
    expect(beatFromProgress(0.62, 2)).toBe(1)
  })

  it('一步跨过多拍时直接落到目标拍，不用逐拍挪', () => {
    expect(beatFromProgress(0.95, 0)).toBe(2)
  })
})

describe('降级判断', () => {
  function stubMatchMedia(matcher: (query: string) => boolean): void {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: matcher(query) }) as MediaQueryList,
    )
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('系统开着「减少动态效果」时降级', () => {
    stubMatchMedia(query => query.includes('prefers-reduced-motion'))

    expect(prefersReducedMotion()).toBe(true)
    expect(shouldDegrade()).toBe(true)
  })

  it('窄屏时降级——pin 在移动端会被地址栏伸缩带着抖', () => {
    stubMatchMedia(query => query.includes('max-width'))

    expect(prefersReducedMotion()).toBe(false)
    expect(shouldDegrade()).toBe(true)
  })

  it('宽屏且未开减少动效时不降级', () => {
    stubMatchMedia(() => false)

    expect(shouldDegrade()).toBe(false)
  })
})

describe('useTrapScroll 挂载时机', () => {
  /** 用一个最小组件包一层，好让 onMounted / 模板 ref 这些生命周期设施跑起来 */
  function mountHarness() {
    const Harness = defineComponent({
      setup() {
        const el = ref<HTMLElement>()
        const { beat, degraded } = useTrapScroll(el)
        return { el, beat, degraded }
      },
      template: '<div ref="el" />',
    })
    return mount(Harness, { attachTo: document.body })
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('setup 期 degraded 就已经是正确值，不必等任何 tick', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
    vi.spyOn(ScrollTrigger, 'create').mockReturnValue({ kill: vi.fn() } as unknown as ScrollTrigger)

    const wrapper = mountHarness()

    // mount() 一返回就该是对的——不是 ref(true) 晚一拍等 onMounted 才纠正
    expect(wrapper.vm.degraded).toBe(false)
    wrapper.unmount()
  })

  it('降级命中时一次都不建 ScrollTrigger', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    const createSpy = vi.spyOn(ScrollTrigger, 'create').mockReturnValue({ kill: vi.fn() } as unknown as ScrollTrigger)

    const wrapper = mountHarness()

    expect(wrapper.vm.degraded).toBe(true)
    expect(createSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
