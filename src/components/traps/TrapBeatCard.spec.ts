import type { PropertyDiff, TrapBeat } from '~/core/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrapBeatCard from './TrapBeatCard.vue'

const beat: TrapBeat = {
  title: '现象',
  body: 'A 没有被压到 200px',
  code: '.item { flex: 1 1 auto; }',
}

const diffs: PropertyDiff[] = [
  { scope: 'item', itemIndex: 0, key: 'minWidthAuto', from: 'true', to: 'false' },
]

function mountCard(overrides: Partial<InstanceType<typeof TrapBeatCard>['$props']> = {}) {
  return mount(TrapBeatCard, {
    props: { beat, index: 0, active: true, diffs, ...overrides },
  })
}

describe('trapBeatCard', () => {
  it('渲染标号、标题与正文', () => {
    const text = mountCard({ index: 2 }).text()

    // 标号是从 1 开始数给人看的，不是数组下标
    expect(text).toContain('3')
    expect(text).toContain(beat.title)
    expect(text).toContain(beat.body)
  })

  it('当前拍带 is-active，非当前拍不带', () => {
    expect(mountCard({ active: true }).classes()).toContain('is-active')
    expect(mountCard({ active: false }).classes()).not.toContain('is-active')
  })

  it('代码块交给 prismjs 高亮，不是原样塞进 DOM', () => {
    const html = mountCard().get('pre').html()

    expect(html).toContain('token')
  })

  it('没给 code 就不渲染代码块', () => {
    expect(mountCard({ beat: { title: 't', body: 'b' } }).find('pre').exists()).toBe(false)
  })

  it('差异表只挂在归因那一拍（index 1）上', () => {
    expect(mountCard({ index: 0 }).find('[data-testid="trap-diff-row"]').exists()).toBe(false)
    expect(mountCard({ index: 1 }).find('[data-testid="trap-diff-row"]').exists()).toBe(true)
    expect(mountCard({ index: 2 }).find('[data-testid="trap-diff-row"]').exists()).toBe(false)
  })

  it('默认插槽放在卡片末尾，给降级形态塞演示区用', () => {
    const wrapper = mount(TrapBeatCard, {
      props: { beat, index: 0, active: true, diffs },
      slots: { default: '<div data-testid="slotted" />' },
    })

    expect(wrapper.find('[data-testid="slotted"]').exists()).toBe(true)
  })
})
