import type { ExplainStep, FlexItemState } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { deriveLayout } from './deriveLayout'
import { explainItem } from './explain'

function stateWith(items: Partial<FlexItemState>[], container: Partial<ReturnType<typeof createDefaultState>['container']> = {}) {
  const state = createDefaultState()
  Object.assign(state.container, container)
  state.items = items.map((spec, index) => ({ ...createDefaultItem(`i${index + 1}`), ...spec }))
  return state
}

function explain(state: ReturnType<typeof stateWith>, id: string, fontSize?: number): ExplainStep[] {
  return explainItem(state, deriveLayout(state, fontSize), id)
}

const kinds = (steps: ExplainStep[]) => steps.map(step => step.kind)

describe('explainItem', () => {
  it('伸展：basis → 本行剩余 → grow 分配 → 理论最终', () => {
    const state = stateWith([
      { basis: '30%', grow: 1 },
      { basis: '150px', grow: 1 },
      { basis: '150px', grow: 0 },
    ], { width: 720, columnGap: 12 })

    expect(explain(state, 'i1')).toEqual([
      { kind: 'basis', form: 'percent', raw: '30%', value: 30, unit: '%', factor: 720, result: 216 },
      { kind: 'free', container: 720, terms: [216, 150, 150], gap: 12, result: 180 },
      { kind: 'grow', grow: 1, totalGrow: 2, free: 180, result: 90 },
      { kind: 'final', basis: 216, delta: 90, result: 306 },
    ])
  })

  it('收缩：先给权重与权重和，再按权重分摊溢出', () => {
    const state = stateWith([{ basis: '300px' }, { basis: '400px' }], { width: 600, columnGap: 0 })
    const steps = explain(state, 'i1')

    expect(kinds(steps)).toEqual(['basis', 'free', 'shrink-weight', 'shrink-total', 'shrink-share', 'final'])
    expect(steps[2]).toEqual({ kind: 'shrink-weight', shrink: 1, basis: 300, result: 300 })
    expect(steps[3]).toEqual({ kind: 'shrink-total', terms: [300, 400], result: 700 })
    expect(steps[4]).toMatchObject({ kind: 'shrink-share', weight: 300, weightSum: 700, overflow: -100, factorSum: 2, initialOverflow: -100 })
    expect((steps[4] as { result: number }).result).toBeCloseTo(-300 / 7)
  })

  it('本盒子在第 1 轮被冻结：列出冻结那一轮后直接给最终，不再有分摊行', () => {
    const state = stateWith([{ shrink: 10, basis: '10px' }, { shrink: 1, basis: '300px' }], { width: 110, columnGap: 0 })

    expect(explain(state, 'i1').slice(2)).toEqual([
      { kind: 'shrink-weight', shrink: 10, basis: 10, result: 100 },
      { kind: 'freeze', round: 1, overflow: -200, frozen: [{ id: 'i1', share: -50, basis: 10 }], remaining: -190 },
      { kind: 'final', basis: 10, delta: -10, result: 0 },
    ])
  })

  it('别的盒子被冻结：冻结轮之后按剩下的盒子重算权重和', () => {
    const state = stateWith([{ shrink: 10, basis: '10px' }, { shrink: 1, basis: '300px' }], { width: 110, columnGap: 0 })

    expect(explain(state, 'i2').slice(3)).toEqual([
      { kind: 'freeze', round: 1, overflow: -200, frozen: [{ id: 'i1', share: -50, basis: 10 }], remaining: -190 },
      { kind: 'shrink-total', terms: [300], result: 300 },
      { kind: 'shrink-share', weight: 300, weightSum: 300, overflow: -190, factorSum: 1, initialOverflow: -200, result: -190 },
      { kind: 'final', basis: 300, delta: -190, result: 110 },
    ])
  })

  it('grow 之和小于 1：步骤里带着 Σgrow，界面据此换公式', () => {
    const state = stateWith([{ basis: '100px', grow: 0.5 }], { width: 600 })
    expect(explain(state, 'i1')[2]).toEqual({ kind: 'grow', grow: 0.5, totalGrow: 0.5, free: 500, result: 250 })
  })

  it('shrink 之和小于 1：分摊行带着 Σshrink 与初始溢出', () => {
    const state = stateWith([{ basis: '900px', shrink: 0.5 }], { width: 600 })
    expect(explain(state, 'i1')[4]).toEqual({ kind: 'shrink-share', weight: 450, weightSum: 450, overflow: -300, factorSum: 0.5, initialOverflow: -300, result: -150 })
  })

  it('剩余恰好为 0：不伸不缩', () => {
    const state = stateWith([{ basis: '100px' }, { basis: '200px' }], { width: 300, columnGap: 0 })
    expect(kinds(explain(state, 'i1'))).toEqual(['basis', 'free', 'balanced', 'final'])
  })

  it('权重全为 0：溢出留在行上，不收缩', () => {
    const state = stateWith([{ basis: '400px', shrink: 0 }, { basis: '400px', shrink: 0 }], { width: 600, columnGap: 0 })
    expect(kinds(explain(state, 'i1'))).toEqual(['basis', 'free', 'shrink-weight', 'no-shrink', 'final'])
  })

  it('basis 的五种写法各给出换算依据', () => {
    const state = stateWith([
      { basis: 'auto', size: 80 },
      { basis: '0' },
      { basis: '2em' },
      { basis: '1in' },
    ], { width: 1200 })
    const layout = deriveLayout(state, 20)

    expect(explainItem(state, layout, 'i1')[0]).toEqual({ kind: 'basis', form: 'content', raw: 'auto', value: 80, unit: '', factor: 1, result: 80 })
    expect(explainItem(state, layout, 'i2')[0]).toEqual({ kind: 'basis', form: 'length', raw: '0', value: 0, unit: '', factor: 1, result: 0 })
    expect(explainItem(state, layout, 'i3')[0]).toEqual({ kind: 'basis', form: 'font', raw: '2em', value: 2, unit: 'em', factor: 20, result: 40 })
    expect(explainItem(state, layout, 'i4')[0]).toEqual({ kind: 'basis', form: 'unit', raw: '1in', value: 1, unit: 'in', factor: 96, result: 96 })
  })

  it('多行时加一步分行：给出本行累加，以及下一个放不下的盒子', () => {
    const state = stateWith(Array.from({ length: 4 }, () => ({ basis: '300px' })), { width: 720, columnGap: 12, wrap: 'wrap' })

    expect(explain(state, 'i1')[1]).toEqual({ kind: 'line', lineNumber: 1, lineCount: 2, terms: [300, 300], gap: 12, next: 300, limit: 720 })
    expect(explain(state, 'i3')[1]).toEqual({ kind: 'line', lineNumber: 2, lineCount: 2, terms: [300, 300], gap: 12, next: null, limit: 720 })
  })

  it('wrap-reverse：行号按视觉行序，下一个按 order 顺序', () => {
    const state = stateWith(Array.from({ length: 4 }, () => ({ basis: '300px' })), { width: 720, columnGap: 12, wrap: 'wrap-reverse' })

    expect(explain(state, 'i1')[1]).toMatchObject({ lineNumber: 2, next: 300 })
    expect(explain(state, 'i3')[1]).toMatchObject({ lineNumber: 1, next: null })
  })

  it('order 打乱时分行按 order 累加，不按文档顺序', () => {
    // order 顺序是 B(100) C(400) | D(200) A(300)：100 + 12 + 400 + 12 + 200 = 724 > 720
    const state = stateWith([
      { basis: '300px', order: 1 },
      { basis: '100px' },
      { basis: '400px' },
      { basis: '200px' },
    ], { width: 720, columnGap: 12, wrap: 'wrap' })

    expect(explain(state, 'i2')[1]).toMatchObject({ lineNumber: 1, terms: [100, 400], next: 200 })
    expect(explain(state, 'i1')[1]).toMatchObject({ lineNumber: 2, terms: [200, 300], next: null })
  })

  it('column 方向：主轴取 height，gap 取 rowGap', () => {
    const state = stateWith([{ basis: '100px', grow: 1 }, { basis: '100px', grow: 1 }], {
      direction: 'column',
      height: 320,
      rowGap: 10,
      columnGap: 99,
    })
    expect(explain(state, 'i1')[1]).toEqual({ kind: 'free', container: 320, terms: [100, 100], gap: 10, result: 110 })
  })

  it('自己的 basis 要到运行期才能确定：两步就停', () => {
    const state = stateWith([{ basis: '10vw' }, { basis: '100px' }])
    expect(explain(state, 'i1')).toEqual([
      { kind: 'basis-runtime', raw: '10vw' },
      { kind: 'unresolvable', blockers: [] },
    ])
  })

  it('别的盒子的 basis 要到运行期才能确定：本盒子 basis 照常解析，随即停下并点名', () => {
    const state = stateWith([{ basis: '100px' }, { basis: '10vw' }])
    expect(explain(state, 'i1')).toEqual([
      { kind: 'basis', form: 'length', raw: '100px', value: 100, unit: 'px', factor: 1, result: 100 },
      { kind: 'unresolvable', blockers: ['i2'] },
    ])
  })

  it('找不到盒子时返回空数组', () => {
    expect(explain(stateWith([{}]), 'nope')).toEqual([])
  })
})
