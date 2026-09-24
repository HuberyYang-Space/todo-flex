import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import ShareNotice from './ShareNotice.vue'

describe('shareNotice', () => {
  beforeEach(() => {
    useFlexState().shareIssue.value = null
  })

  it('链接没出错时不出现', () => {
    expect(mount(ShareNotice).find('[data-testid="share-notice"]').exists()).toBe(false)
  })

  it.each([
    ['version', '无法识别的版本'],
    ['missing', '缺少参数'],
    ['content', '无法解析的值'],
  ] as const)('链接因 %s 被整条拒掉时说明原因与后果', (issue, reason) => {
    useFlexState().shareIssue.value = issue

    const notice = mount(ShareNotice).get('[data-testid="share-notice"]')

    expect(notice.text()).toContain(reason)
    expect(notice.text()).toContain('已显示默认状态')
    expect(notice.attributes('role')).toBe('status')
  })

  it('点关闭后消失', async () => {
    useFlexState().shareIssue.value = 'version'
    const wrapper = mount(ShareNotice)

    await wrapper.get('[data-testid="share-notice-close"]').trigger('click')

    expect(wrapper.find('[data-testid="share-notice"]').exists()).toBe(false)
  })
})
