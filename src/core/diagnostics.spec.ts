import type { FlexItemState, MeasuredItem, MeasuredStage } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { deriveLayout } from './deriveLayout'
import { diagnose } from './diagnostics'

function stateWith(items: Partial<FlexItemState>[], width = 600, gap = 0) {
  const state = createDefaultState()
  state.container.width = width
  state.container.columnGap = gap
  state.items = items.map((spec, index) => ({ ...createDefaultItem(`i${index + 1}`), ...spec }))
  return state
}

/** 按理论值造一份「完全吻合」的观测结果，再由各用例按需覆盖某一项 */
function measuredFrom(
  state: ReturnType<typeof stateWith>,
  overrides: Record<string, Partial<MeasuredItem>> = {},
): MeasuredStage {
  const layout = deriveLayout(state)
  return {
    width: state.container.width,
    height: state.container.height,
    items: layout.items.map(item => ({
      id: item.id,
      width: item.finalMainSize ?? 0,
      height: state.container.height,
      left: 0,
      top: 0,
      ...overrides[item.id],
    })),
  }
}

function diagnoseWith(
  state: ReturnType<typeof stateWith>,
  overrides: Record<string, Partial<MeasuredItem>> = {},
) {
  return diagnose(state, deriveLayout(state), measuredFrom(state, overrides))
}

describe('diagnose', () => {
  it('理论与实际一致时不产出任何诊断', () => {
    const state = stateWith([{ basis: '100px' }, { basis: '200px' }])
    expect(diagnoseWith(state)).toEqual([])
  })

  it('差值恰好 0.5px 仍视为一致，不产出诊断', () => {
    const state = stateWith([{ basis: '100px' }])
    expect(diagnoseWith(state, { i1: { width: 100.5 } })).toEqual([])
  })

  it('差值超过 0.5px 才判定为有规则介入', () => {
    const state = stateWith([{ basis: '100px' }])
    expect(diagnoseWith(state, { i1: { width: 100.6 } })).toHaveLength(1)
  })

  it('实际大于理论且贴住内容固有尺寸时，判定为 min-width:auto 撑住了下限', () => {
    // 容器 300，两项 basis 各 300，理论上应各收缩到 150；
    // 但 i1 的内容固有尺寸是 240，min-width:auto 不让它缩到 150 以下
    const state = stateWith([
      { basis: '300px', size: 240, minWidthAuto: true },
      { basis: '300px', size: 40, minWidthAuto: true },
    ], 300)

    const [diagnostic] = diagnoseWith(state, { i1: { width: 240 } })

    expect(diagnostic.itemId).toBe('i1')
    expect(diagnostic.rule).toBe('min-width-auto')
    expect(diagnostic.severity).toBe('warn')
    expect(diagnostic.theoretical).toBe(150)
    expect(diagnostic.actual).toBe(240)
  })

  it('收缩连锁导致实际值反而小于理论值时，仍认得出是 min-width:auto 接住了下限', () => {
    // A 拒绝缩到内容尺寸 240 以下，压力全转嫁给 B，
    // B 一路缩到自己的内容尺寸 80 才停——它同样是被 min-width:auto 截断的，
    // 只是结果比理论值更小。这是浏览器验证时发现的真实场景。
    const state = stateWith([
      { basis: '300px', size: 240 },
      { basis: '300px', size: 80 },
    ], 300, 12)

    const [, diagnostic] = diagnoseWith(state, { i1: { width: 240 }, i2: { width: 80 } })

    expect(diagnostic.itemId).toBe('i2')
    expect(diagnostic.rule).toBe('min-width-auto')
  })

  it('关掉 min-width:auto 的项不会被判成 min-width-auto', () => {
    const state = stateWith([
      { basis: '300px', size: 240, minWidthAuto: false },
      { basis: '300px', size: 40 },
    ], 300)

    const [diagnostic] = diagnoseWith(state, { i1: { width: 240 } })

    expect(diagnostic.rule).not.toBe('min-width-auto')
  })

  it('margin:auto 不改变尺寸，只在尺寸吻合时作为提示给出', () => {
    // 容器 600、单项 100px，剩余 500 全被 margin 吃掉，但盒子仍是 100px
    const state = stateWith([{ basis: '100px', size: 100, marginAuto: true }])

    const [diagnostic] = diagnoseWith(state)

    expect(diagnostic.rule).toBe('margin-auto')
    expect(diagnostic.severity).toBe('info')
    expect(diagnostic.params.freeSpace).toBe(500)
  })

  it('尺寸对不上时优先报偏差，不被 margin 提示挤掉', () => {
    const state = stateWith([{ basis: '100px', size: 100, marginAuto: true }])

    const [diagnostic] = diagnoseWith(state, { i1: { width: 300 } })

    expect(diagnostic.severity).toBe('warn')
    expect(diagnostic.rule).not.toBe('margin-auto')
  })

  it('没开 margin:auto 的项在尺寸吻合时不产出任何提示', () => {
    const state = stateWith([{ basis: '100px', size: 100 }])

    expect(diagnoseWith(state)).toEqual([])
  })

  it('同一行里有 grow 时不报 margin:auto —— 剩余空间已被 grow 吃光', () => {
    // 容器 600、两项各 100px，剩余 400 全被 i1 的 grow 吃掉；
    // 按规范 §9.7 先于 §9.5，轮到 auto margin 时已经一个像素都不剩
    const state = stateWith([
      { basis: '100px', size: 100, grow: 1 },
      { basis: '100px', size: 100, marginAuto: true },
    ], 600)

    expect(diagnoseWith(state)).toEqual([])
  })

  it('grow 之和小于 1 时，分剩下的空间归 margin:auto，按剩下的量报', () => {
    // 浏览器实测：容器 600，A grow 0.5 长到 300，B 前面的 auto margin 拿到剩下的 200
    const state = stateWith([
      { basis: '100px', size: 100, grow: 0.5 },
      { basis: '100px', size: 100, marginAuto: true },
    ], 600)

    expect(diagnoseWith(state)).toEqual([
      expect.objectContaining({ itemId: 'i2', rule: 'margin-auto', params: { freeSpace: 200 } }),
    ])
  })

  it('该行没有剩余空间时，margin:auto 不成立，落到兜底解释', () => {
    // 容器 300、两项各 300px，剩余为负
    const state = stateWith([
      { basis: '300px', size: 20, marginAuto: true },
      { basis: '300px', size: 20 },
    ], 300)

    const [diagnostic] = diagnoseWith(state, { i1: { width: 200 } })

    expect(diagnostic.rule).toBe('max-size-clamp')
  })

  it('同时开着 margin:auto 时，尺寸被下限接住仍报 min-width-auto', () => {
    // 剩余空间为正（margin-auto 条件成立），同时实际尺寸贴住内容固有尺寸
    const state = stateWith([
      { basis: '0', grow: 0, size: 240, minWidthAuto: true, marginAuto: true },
    ], 600)

    const [diagnostic] = diagnoseWith(state, { i1: { width: 240 } })

    expect(diagnostic.rule).toBe('min-width-auto')
  })

  it('实际值不贴内容尺寸的偏差落到 max-size-clamp 兜底', () => {
    const state = stateWith([{ basis: '100px', size: 80 }])

    const [diagnostic] = diagnoseWith(state, { i1: { width: 130 } })

    expect(diagnostic.rule).toBe('max-size-clamp')
  })

  it('column 方向拿高度与理论值比对，不看宽度', () => {
    const state = stateWith([{ basis: '100px', size: 80 }])
    state.container.direction = 'column'
    state.container.height = 400

    // 宽度偏离但高度吻合：主轴是纵向，不该产出诊断
    const noise = diagnoseWith(state, { i1: { width: 999, height: 100 } })
    expect(noise).toEqual([])

    // 高度偏离才算数
    const real = diagnoseWith(state, { i1: { width: 999, height: 130 } })
    expect(real).toHaveLength(1)
    expect(real[0].actual).toBe(130)
  })

  it('basis 非法时直接指出，不归因成 min-width:auto', () => {
    // 浏览器丢弃 flex-basis: 50、按 auto 取内容尺寸 80，恰好与 min-width:auto 撑住的现象长得一样
    const state = stateWith([{ basis: '50', size: 80 }])

    const [diagnostic] = diagnoseWith(state, { i1: { width: 80 } })

    expect(diagnostic).toMatchObject({ rule: 'invalid-basis', severity: 'warn' })
  })

  it('basis 要到运行期才能确定时指出是谁，同一容器里的其余盒子不做比对', () => {
    const state = stateWith([{ basis: 'calc(50% - 10px)', size: 80 }, { basis: '100px' }])

    expect(diagnoseWith(state, { i1: { width: 290 }, i2: { width: 100 } })).toEqual([
      expect.objectContaining({ itemId: 'i1', rule: 'runtime-basis', severity: 'info' }),
    ])
  })

  it('缺少观测值的项直接跳过，不猜测', () => {
    const state = stateWith([{ basis: '100px' }, { basis: '100px' }])
    const measured = measuredFrom(state, { i1: { width: 300 } })
    measured.items = measured.items.filter(item => item.id !== 'i1')

    expect(diagnose(state, deriveLayout(state), measured)).toEqual([])
  })
})
