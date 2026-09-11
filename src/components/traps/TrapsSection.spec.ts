import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { traps } from '~/data/traps'
import TrapsSection from './TrapsSection.vue'

// 同 TrapSection.spec.ts：不让 gsap/ScrollTrigger 进 happy-dom
vi.mock('~/composables/useTrapScroll', async () => {
  const vue = await import('vue')
  return {
    BEAT_COUNT: 3,
    useTrapScroll: () => ({ beat: vue.ref(0), degraded: vue.ref(true) }),
    prefersReducedMotion: () => true,
    shouldDegrade: () => true,
    beatFromProgress: (progress: number) => progress,
  }
})

describe('trapsSection', () => {
  it('五个陷阱各渲染一个板块', () => {
    const wrapper = mount(TrapsSection)

    expect(wrapper.findAll('[data-testid="trap-section"]')).toHaveLength(traps.length)
  })

  it('板块顺序与数据定义一致', () => {
    const wrapper = mount(TrapsSection)
    const titles = wrapper.findAll('[data-testid="trap-section"]').map(section => section.text())

    for (const [index, trap] of traps.entries())
      expect(titles[index]).toContain(trap.title)
  })

  it('区块带标题，让人知道下面是什么', () => {
    expect(mount(TrapsSection).text()).toContain('五个常见陷阱')
  })
})
