import { describe, expect, it } from 'vitest'
import { diffStates, resolveVariant } from '~/core/trapPatch'
import { traps } from './traps'

describe('陷阱数据', () => {
  it('恰好五个陷阱，id 互不重复', () => {
    expect(traps).toHaveLength(5)
    expect(new Set(traps.map(trap => trap.id)).size).toBe(5)
  })

  it.each(traps)('$id 的 before 与 after 都能解析成合法状态', (trap) => {
    for (const which of ['before', 'after'] as const) {
      const state = resolveVariant(trap, which)
      expect(state.items.length).toBeGreaterThan(0)
      expect(new Set(state.items.map(item => item.id)).size).toBe(state.items.length)
      expect(state.container.width).toBeGreaterThan(0)
      expect(state.container.height).toBeGreaterThan(0)
    }
  })

  it.each(traps)('$id 的 before → after 至少有一条差异', (trap) => {
    // 防止写出「改了但没改」的陷阱：归因拍会因此变成一张空表
    const diffs = diffStates(resolveVariant(trap, 'before'), resolveVariant(trap, 'after'))
    expect(diffs.length).toBeGreaterThan(0)
  })

  it.each(traps)('$id 恰好三拍且每拍都有文案', (trap) => {
    expect(trap.beats).toHaveLength(3)
    for (const beat of trap.beats) {
      expect(beat.title.length).toBeGreaterThan(0)
      expect(beat.body.length).toBeGreaterThan(0)
    }
  })

  it.each(traps)('$id 有标题与钩子文案', (trap) => {
    expect(trap.title.length).toBeGreaterThan(0)
    expect(trap.hook.length).toBeGreaterThan(0)
  })

  it('陷阱一的现象态确实会溢出容器', () => {
    // 480 的容器里塞下 320 + 80 + 80 + 两道 12 的 gap = 504
    const trap = traps.find(item => item.id === 'min-width-auto')!
    const state = resolveVariant(trap, 'before')
    const content = state.items.reduce((sum, item) => sum + item.size, 0)
    const gaps = state.container.columnGap * (state.items.length - 1)

    expect(content + gaps).toBeGreaterThan(state.container.width)
  })

  it('陷阱三的差异恰好是 flex 简写展开的那三个属性', () => {
    const trap = traps.find(item => item.id === 'flex-shorthand')!
    const diffs = diffStates(resolveVariant(trap, 'before'), resolveVariant(trap, 'after'))

    expect(new Set(diffs.map(diff => diff.key))).toEqual(new Set(['grow', 'shrink', 'basis']))
  })

  it('陷阱三关掉了自动最小尺寸，免得跟陷阱一串味', () => {
    // 不关的话 flex: 1 的结果会被 min-width:auto 从 152 撑回 200，修复态就演不出来了
    const trap = traps.find(item => item.id === 'flex-shorthand')!
    const state = resolveVariant(trap, 'after')

    expect(state.items.every(item => !item.minWidthAuto)).toBe(true)
  })

  it('陷阱四的修复态确实需要换行', () => {
    // 4 × 100 + 3 × 12 = 436 > 360，nowrap 时必然溢出、wrap 时必然分行
    const trap = traps.find(item => item.id === 'align-content-single-line')!
    const state = resolveVariant(trap, 'after')
    const content = state.items.reduce((sum, item) => sum + item.size, 0)
    const gaps = state.container.columnGap * (state.items.length - 1)

    expect(state.container.wrap).toBe('wrap')
    expect(content + gaps).toBeGreaterThan(state.container.width)
  })

  it('陷阱五的容器设了 space-between，否则无从失效', () => {
    const trap = traps.find(item => item.id === 'margin-auto')!

    expect(resolveVariant(trap, 'before').container.justifyContent).toBe('space-between')
    expect(resolveVariant(trap, 'after').container.justifyContent).toBe('space-between')
  })

  it('陷阱五的现象态留有 456px 剩余空间给 auto margin 吃', () => {
    // 文案里「456px」「每个 228px」就是从这儿算出来的，改了 base 数值这条会先红
    const trap = traps.find(item => item.id === 'margin-auto')!
    const state = resolveVariant(trap, 'before')
    const content = state.items.reduce((sum, item) => sum + item.size, 0)
    const gaps = state.container.columnGap * (state.items.length - 1)

    expect(state.container.width - content - gaps).toBe(456)
    expect(state.items[0].marginAuto).toBe(true)
  })
})
