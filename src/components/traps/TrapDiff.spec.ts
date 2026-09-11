import type { PropertyDiff } from '~/core/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrapDiff from './TrapDiff.vue'

function rows(diffs: PropertyDiff[]): string[] {
  return mount(TrapDiff, { props: { diffs } })
    .findAll('[data-testid="trap-diff-row"]')
    .map(row => row.text().replace(/\s+/g, ' ').trim())
}

describe('trapDiff', () => {
  it('每条差异一行', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'container', key: 'wrap', from: 'nowrap', to: 'wrap' },
      { scope: 'item', itemIndex: 0, key: 'grow', from: '0', to: '1' },
    ]

    expect(rows(diffs)).toHaveLength(2)
  })

  it('字段名翻译成 CSS 属性名', () => {
    const diffs: PropertyDiff[] = [{ scope: 'container', key: 'wrap', from: 'nowrap', to: 'wrap' }]

    expect(rows(diffs)[0]).toContain('flex-wrap')
  })

  it('minWidthAuto 的布尔值翻译成 auto 与 0', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'item', itemIndex: 0, key: 'minWidthAuto', from: 'true', to: 'false' },
    ]

    const row = rows(diffs)[0]
    expect(row).toContain('min-width')
    expect(row).toContain('auto')
    expect(row).toContain('0')
    expect(row).not.toContain('true')
  })

  it('marginAuto 的布尔值同样翻译成 auto 与 0', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'item', itemIndex: 0, key: 'marginAuto', from: 'true', to: 'false' },
    ]

    expect(rows(diffs)[0]).not.toContain('true')
    expect(rows(diffs)[0]).toContain('margin')
  })

  it('像素类字段带上单位', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'container', key: 'width', from: '720', to: '480' },
    ]

    expect(rows(diffs)[0]).toContain('720px')
    expect(rows(diffs)[0]).toContain('480px')
  })

  it('item 差异标出盒子标签，与演示区叫同一个名字', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'item', itemIndex: 1, key: 'grow', from: '0', to: '1' },
    ]

    expect(rows(diffs)[0]).toContain('B')
  })

  it('容器差异标为容器而不是某个盒子', () => {
    const diffs: PropertyDiff[] = [{ scope: 'container', key: 'wrap', from: 'nowrap', to: 'wrap' }]

    expect(rows(diffs)[0]).toContain('容器')
  })

  it('没有差异时不渲染任何行', () => {
    expect(rows([])).toHaveLength(0)
  })
})
