import type { Trap } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultState } from './defaults'
import { CONTAINER_KEYS, diffStates, ITEM_KEYS, resolveVariant } from './trapPatch'

/** 造一个最小可用的陷阱，只有被测字段是真的 */
function makeTrap(partial: Partial<Trap>): Trap {
  return {
    id: 'test',
    title: '测试陷阱',
    hook: '钩子',
    base: {},
    before: {},
    after: {},
    beats: [
      { title: '现象', body: '' },
      { title: '归因', body: '' },
      { title: '修复', body: '' },
    ],
    ...partial,
  }
}

describe('resolveVariant', () => {
  it('不带任何 patch 时就是默认状态', () => {
    expect(resolveVariant(makeTrap({}), 'before')).toEqual(createDefaultState())
  })

  it('按 default → base → 变体的顺序叠加，后者覆盖前者', () => {
    const trap = makeTrap({
      base: { container: { width: 480, justifyContent: 'center' } },
      before: { container: { width: 300 } },
    })

    const state = resolveVariant(trap, 'before')

    expect(state.container.width).toBe(300) // 变体覆盖 base
    expect(state.container.justifyContent).toBe('center') // base 保留
    expect(state.container.height).toBe(320) // 默认值保留
  })

  it('item patch 按索引落到对应盒子，其余盒子不受影响', () => {
    const trap = makeTrap({
      base: { items: [{ index: 0, patch: { grow: 1, size: 320 } }] },
    })

    const state = resolveVariant(trap, 'before')

    expect(state.items[0].grow).toBe(1)
    expect(state.items[0].size).toBe(320)
    expect(state.items[1].grow).toBe(0)
    expect(state.items[1].size).toBe(80)
  })

  it('itemCount 大于默认数量时补出新盒子，id 不重复', () => {
    const trap = makeTrap({ base: { itemCount: 4, items: [{ index: 3, patch: { size: 100 } }] } })

    const state = resolveVariant(trap, 'before')

    expect(state.items).toHaveLength(4)
    expect(state.items[3].size).toBe(100)
    expect(new Set(state.items.map(item => item.id)).size).toBe(4)
  })

  it('itemCount 小于默认数量时裁掉多余的盒子', () => {
    const state = resolveVariant(makeTrap({ base: { itemCount: 2 } }), 'before')

    expect(state.items).toHaveLength(2)
  })

  it('before 与 after 互不污染——解析 after 不会带上 before 的改动', () => {
    const trap = makeTrap({
      before: { container: { wrap: 'nowrap' } },
      after: { container: { wrap: 'wrap' } },
    })

    expect(resolveVariant(trap, 'before').container.wrap).toBe('nowrap')
    expect(resolveVariant(trap, 'after').container.wrap).toBe('wrap')
  })

  it('返回的是新对象，反复调用不会互相影响', () => {
    const trap = makeTrap({ base: { items: [{ index: 0, patch: { grow: 1 } }] } })

    const first = resolveVariant(trap, 'before')
    first.items[0].grow = 99

    expect(resolveVariant(trap, 'before').items[0].grow).toBe(1)
  })
})

describe('diffStates', () => {
  it('两份状态完全相同时没有任何差异', () => {
    expect(diffStates(createDefaultState(), createDefaultState())).toEqual([])
  })

  it('容器属性的差异带上 container 作用域', () => {
    const before = createDefaultState()
    const after = createDefaultState()
    after.container.wrap = 'wrap'

    expect(diffStates(before, after)).toEqual([
      { scope: 'container', key: 'wrap', from: 'nowrap', to: 'wrap' },
    ])
  })

  it('item 属性的差异带上索引', () => {
    const before = createDefaultState()
    const after = createDefaultState()
    after.items[1].minWidthAuto = false

    expect(diffStates(before, after)).toEqual([
      { scope: 'item', itemIndex: 1, key: 'minWidthAuto', from: 'true', to: 'false' },
    ])
  })

  it('base 里已经改过、before 与 after 又一致的字段不算差异', () => {
    // 这是 diff 必须拿两份完整 state 相减、而不是直读 patch 的原因
    const trap = makeTrap({
      base: { container: { width: 480 } },
      before: { items: [{ index: 0, patch: { minWidthAuto: true } }] },
      after: { items: [{ index: 0, patch: { minWidthAuto: false } }] },
    })

    const diffs = diffStates(resolveVariant(trap, 'before'), resolveVariant(trap, 'after'))

    expect(diffs).toEqual([
      { scope: 'item', itemIndex: 0, key: 'minWidthAuto', from: 'true', to: 'false' },
    ])
  })

  it('顺序确定：容器差异在前，item 差异按索引升序在后', () => {
    const before = createDefaultState()
    const after = createDefaultState()
    after.items[2].grow = 1
    after.items[0].grow = 1
    after.container.wrap = 'wrap'

    expect(diffStates(before, after).map(diff => [diff.scope, diff.itemIndex])).toEqual([
      ['container', undefined],
      ['item', 0],
      ['item', 2],
    ])
  })

  it('盒子数量不同时只比对两边都有的那些，不崩', () => {
    const before = createDefaultState()
    const after = createDefaultState()
    after.items = after.items.slice(0, 2)

    expect(() => diffStates(before, after)).not.toThrow()
    expect(diffStates(before, after)).toEqual([])
  })
})

describe('差异表的字段清单', () => {
  it('差异表的容器字段清单是完整的', () => {
    expect([...CONTAINER_KEYS].sort()).toEqual(
      Object.keys(createDefaultState().container).sort(),
    )
  })

  it('差异表的盒子字段清单是完整的', () => {
    const itemKeys = Object.keys(createDefaultState().items[0]).filter(key => key !== 'id')
    expect([...ITEM_KEYS].sort()).toEqual(itemKeys.sort())
  })
})
