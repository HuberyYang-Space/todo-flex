import type { PropertyDiff } from '~/core/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { CONTAINER_KEYS, ITEM_KEYS } from '~/core/trapPatch'
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

  it('三个盒子同一属性发生同样变化时折成一行，标签里三个盒子都在', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'item', itemIndex: 0, key: 'basis', from: 'auto', to: '0' },
      { scope: 'item', itemIndex: 1, key: 'basis', from: 'auto', to: '0' },
      { scope: 'item', itemIndex: 2, key: 'basis', from: 'auto', to: '0' },
    ]

    const output = rows(diffs)
    expect(output).toHaveLength(1)
    expect(output[0]).toContain('A')
    expect(output[0]).toContain('B')
    expect(output[0]).toContain('C')
  })

  it('同一盒子的多个属性发生变化时不会被错误折叠', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'item', itemIndex: 0, key: 'grow', from: '0', to: '1' },
      { scope: 'item', itemIndex: 0, key: 'shrink', from: '0', to: '1' },
      { scope: 'item', itemIndex: 0, key: 'basis', from: 'auto', to: '0' },
    ]

    expect(rows(diffs)).toHaveLength(3)
  })

  it('同一属性变化但盒子的 from/to 不同时不会被错误折叠', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'item', itemIndex: 0, key: 'grow', from: '0', to: '1' },
      { scope: 'item', itemIndex: 1, key: 'grow', from: '0', to: '2' },
    ]

    expect(rows(diffs)).toHaveLength(2)
  })

  it('推导层可能产出的每个字段都有对应的中文/CSS 译名', () => {
    // 类型绑定挡得住「漏写一条」，挡不住「译成了空串或原样返回字段名」，所以这条还得跑一遍
    const keys = [...CONTAINER_KEYS, ...ITEM_KEYS]
    // display/direction/wrap/grow/shrink/basis/order 的译名包含字段名本身（如 flex-grow 包含 grow）
    // 这些情况下 not.toContain 会误报，需要排除
    const keysWithoutIdentityLabels = keys.filter(
      k => !['display', 'direction', 'wrap', 'grow', 'shrink', 'basis', 'order'].includes(k),
    )

    for (const key of keysWithoutIdentityLabels) {
      const diff: PropertyDiff = { scope: 'container', key: key as any, from: 'a', to: 'b' }
      const label = mount(TrapDiff, { props: { diffs: [diff] } })
        .get('[data-testid="trap-diff-row"]')
        .text()

      expect(label, `${key} 没有译名`).not.toContain(key)
    }
  })
})
