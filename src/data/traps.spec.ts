import { describe, expect, it } from 'vitest'
import { deriveLayout } from '~/core/deriveLayout'
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

/**
 * 陷阱文案里引用的每一个推导数字，都在这里直接跑一遍 deriveLayout 钉住。
 *
 * 之前的守卫测试只用 Σsize + Σgap 做算术近似，碰不到 finalMainSize，
 * 谁调一下某个 base 的 width/size，文案照样能说谎而测试全绿。
 * 这组测试改用真实推导结果比对，任何字面量与实现脱节都会先在这里红。
 */
describe('陷阱文案的数字钉在 deriveLayout 上', () => {
  it('陷阱一 min-width-auto：现象态推导值 296/80/80，free=296（推导引擎故意不模拟 min-width:auto 截断，红线 3）', () => {
    // 浏览器实际渲染会截到 320，这里的 296 是「不截断」的理论值，正是产品要演示的缝隙
    const trap = traps.find(item => item.id === 'min-width-auto')!
    const layout = deriveLayout(resolveVariant(trap, 'before'))

    expect(layout.items.map(item => item.finalMainSize)).toEqual([296, 80, 80])
    expect(layout.lines[0].freeSpace).toBe(296)
  })

  it('陷阱二 basis-source：现象态 312/192/192（free=336），修复态 232/232/232（free=696）', () => {
    const trap = traps.find(item => item.id === 'basis-source')!

    const before = deriveLayout(resolveVariant(trap, 'before'))
    expect(before.items.map(item => item.finalMainSize)).toEqual([312, 192, 192])
    expect(before.lines[0].freeSpace).toBe(336)

    const after = deriveLayout(resolveVariant(trap, 'after'))
    expect(after.items.map(item => item.finalMainSize)).toEqual([232, 232, 232])
    expect(after.lines[0].freeSpace).toBe(696)
  })

  it('陷阱三 flex-shorthand：现象态 200/200/200（free=-144，shrink 全 0 拒不收缩），修复态 152/152/152（free=456）', () => {
    const trap = traps.find(item => item.id === 'flex-shorthand')!

    const before = deriveLayout(resolveVariant(trap, 'before'))
    expect(before.items.map(item => item.finalMainSize)).toEqual([200, 200, 200])
    expect(before.lines[0].freeSpace).toBe(-144)

    const after = deriveLayout(resolveVariant(trap, 'after'))
    expect(after.items.map(item => item.finalMainSize)).toEqual([152, 152, 152])
    expect(after.lines[0].freeSpace).toBe(456)
  })

  it('陷阱四 align-content-single-line：现象态单行 free=-76，修复态两行 free=36 与 260', () => {
    const trap = traps.find(item => item.id === 'align-content-single-line')!

    const before = deriveLayout(resolveVariant(trap, 'before'))
    expect(before.lines).toHaveLength(1)
    expect(before.lines[0].freeSpace).toBe(-76)

    const after = deriveLayout(resolveVariant(trap, 'after'))
    expect(after.lines.map(line => line.freeSpace)).toEqual([36, 260])
  })

  it('陷阱五 margin-auto：三盒都是 80，free=456（就是被 A 左右两个 auto margin 各吃 228 的那笔钱）', () => {
    const trap = traps.find(item => item.id === 'margin-auto')!
    const layout = deriveLayout(resolveVariant(trap, 'before'))

    expect(layout.items.map(item => item.finalMainSize)).toEqual([80, 80, 80])
    expect(layout.lines[0].freeSpace).toBe(456)
  })
})
