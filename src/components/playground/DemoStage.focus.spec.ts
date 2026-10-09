import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DemoStage from './DemoStage.vue'

// happy-dom 里 Flip 拍过快照后，元素的 focus() 静默失效（不报错、不触发 blur），真实 Chrome 不会。
// 这里只测接焦点的逻辑；与 Flip 同时生效的情况在浏览器里核对，见 .docs/browser-verification.md
vi.mock('~/composables/useFlip', () => ({
  useFlip: () => ({ observeFlip: () => {} }),
}))

describe('demoStage 删除后的焦点', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  // 被删的元素带着焦点一起消失，焦点会掉回 body，键盘用户得从页面开头重新 Tab 过来
  it('删除后焦点落到补位的盒子上，删的是末尾就落到新的末尾', async () => {
    const wrapper = mount(DemoStage, { attachTo: document.body })
    const focusedId = (): string | undefined => (document.activeElement as HTMLElement | null)?.dataset.itemId

    await wrapper.findAll('[data-testid="stage-item"]')[1].trigger('keydown', { key: 'Delete' })
    await nextTick()
    expect(focusedId()).toBe('item-3')

    await wrapper.findAll('[data-testid="stage-item"]')[1].trigger('keydown', { key: 'Delete' })
    await nextTick()
    expect(focusedId()).toBe('item-1')
    wrapper.unmount()
  })
})
