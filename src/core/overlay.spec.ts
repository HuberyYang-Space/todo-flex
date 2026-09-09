import type { DerivedLayout, MeasuredStage } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultState } from './defaults'
import { deriveLayout } from './deriveLayout'
import { computeOverlay } from './overlay'

/** 只有 computeOverlay 用得到的字段是真的，其余补默认值 */
function makeLines(lines: { index: number, itemIds: string[], freeSpace: number }[]): DerivedLayout {
  return {
    lines: lines.map(line => ({
      ...line,
      usedMainSize: 0,
      totalGrow: 0,
      totalShrinkWeighted: 0,
    })),
    items: [],
    steps: [],
  }
}

function stage(width: number, height: number, items: MeasuredStage['items']): MeasuredStage {
  return { width, height, items }
}

describe('computeOverlay', () => {
  it('行尾的空白画成一块剩余空间色块', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: 300 }])
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
    ])

    const { bands } = computeOverlay(state, derived, measured)

    expect(bands).toEqual([
      { kind: 'free', lineIndex: 0, x: 100, y: 0, width: 300, height: 200, flow: 'reverse' },
    ])
  })

  it('盒子之间的空隙扣掉 gap，剩下的才算剩余空间', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 20
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], freeSpace: 180 }])
    // 两个盒子之间隔了 100px，其中 20px 是 gap，剩下 80px 才是剩余空间
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
      { id: 'item-2', left: 200, top: 0, width: 100, height: 200 },
    ])

    const { bands } = computeOverlay(state, derived, measured)

    expect(bands).toEqual([
      // 紧贴后一个盒子画：200 - 80 = 120 起，宽 80
      { kind: 'free', lineIndex: 0, x: 120, y: 0, width: 80, height: 200, flow: 'forward' },
      { kind: 'free', lineIndex: 0, x: 300, y: 0, width: 100, height: 200, flow: 'reverse' },
    ])
  })

  it('空隙恰好等于 gap 时不画色块', () => {
    const state = createDefaultState()
    state.container.width = 220
    state.container.columnGap = 20
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], freeSpace: 0 }])
    const measured = stage(220, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
      { id: 'item-2', left: 120, top: 0, width: 100, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([])
  })

  it('盒子撑出容器时画成 overflow 标记而不是负宽色块', () => {
    const state = createDefaultState()
    state.container.width = 200
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: -80 }])
    const measured = stage(200, 200, [
      { id: 'item-1', left: 0, top: 0, width: 280, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([
      { kind: 'overflow', lineIndex: 0, x: 200, y: 0, width: 80, height: 200 },
    ])
  })

  it('column 方向上主轴换成纵向，色块横跨该行的宽度', () => {
    const state = createDefaultState()
    state.container.direction = 'column'
    state.container.height = 300
    state.container.rowGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: 200 }])
    const measured = stage(400, 300, [
      { id: 'item-1', left: 0, top: 0, width: 400, height: 100 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([
      { kind: 'free', lineIndex: 0, x: 0, y: 100, width: 400, height: 200, flow: 'reverse' },
    ])
  })

  it('多行各算各的，色块只覆盖本行的交叉轴范围', () => {
    const state = createDefaultState()
    state.container.width = 300
    state.container.wrap = 'wrap'
    state.container.columnGap = 0
    const derived = makeLines([
      { index: 0, itemIds: ['item-1'], freeSpace: 100 },
      { index: 1, itemIds: ['item-2'], freeSpace: 200 },
    ])
    const measured = stage(300, 200, [
      { id: 'item-1', left: 0, top: 0, width: 200, height: 90 },
      { id: 'item-2', left: 0, top: 110, width: 100, height: 90 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([
      { kind: 'free', lineIndex: 0, x: 200, y: 0, width: 100, height: 90, flow: 'reverse' },
      { kind: 'free', lineIndex: 1, x: 100, y: 110, width: 200, height: 90, flow: 'reverse' },
    ])
  })

  it('亚像素级的空隙不画，免得满屏发丝色块', () => {
    const state = createDefaultState()
    state.container.width = 200.3
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: 0.3 }])
    const measured = stage(200.3, 200, [
      { id: 'item-1', left: 0, top: 0, width: 200, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([])
  })

  it('观测里还没有这一行的盒子时跳过，不猜', () => {
    const state = createDefaultState()
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: 100 }])
    const measured = stage(400, 200, [])

    expect(computeOverlay(state, derived, measured)).toEqual({ bands: [], lines: [] })
  })

  it('每行同时给出理论与实际剩余空间，供图例并排对照', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 20
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], freeSpace: 180 }])
    // 实际渲染里两个盒子各 120（被 min-width:auto 撑住了），实际剩余 400-240-20=140
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 120, height: 200 },
      { id: 'item-2', left: 140, top: 0, width: 120, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).lines).toEqual([
      { index: 0, theoretical: 180, actual: 140 },
    ])
  })

  it('接得住推导引擎的真实输出（默认状态下三个盒子一行）', () => {
    const state = createDefaultState()
    const derived = deriveLayout(state)
    const measured = stage(720, 320, [
      { id: 'item-1', left: 0, top: 0, width: 80, height: 320 },
      { id: 'item-2', left: 92, top: 0, width: 80, height: 320 },
      { id: 'item-3', left: 184, top: 0, width: 80, height: 320 },
    ])

    const { bands, lines } = computeOverlay(state, derived, measured)

    expect(lines).toHaveLength(1)
    // 720 - 240 - 24 = 456
    expect(lines[0].actual).toBe(456)
    expect(bands.at(-1)).toEqual({ kind: 'free', lineIndex: 0, x: 264, y: 0, width: 456, height: 320, flow: 'reverse' })
  })
})

/*
 * 剩余空间色块的斜纹要朝「这块空间一旦被分配，会流向谁」的方向动。
 * flow 一律用屏幕坐标表述：forward = 朝坐标增大的方向（右 / 下），reverse = 朝减小的方向（左 / 上）。
 */
describe('computeOverlay 的斜纹流向', () => {
  it('行尾的剩余空间流向前面那个盒子', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: 300 }])
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands.map(band => band.flow)).toEqual(['reverse'])
  })

  it('行首的剩余空间流向后面那个盒子', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 0
    // justify-content: flex-end 的效果：盒子被推到末尾，空的是前面
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: 300 }])
    const measured = stage(400, 200, [
      { id: 'item-1', left: 300, top: 0, width: 100, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands.map(band => band.flow)).toEqual(['forward'])
  })

  it('被两个盒子夹住的空间没有唯一去向，沿主轴正方向流', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], freeSpace: 100 }])
    // item-2 一直占到容器末尾，所以只有中间这一块 band
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
      { id: 'item-2', left: 200, top: 0, width: 200, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands.map(band => band.flow)).toEqual(['forward'])
  })

  it('row-reverse 的主轴正方向在屏幕上朝左，夹住的空间跟着反过来', () => {
    const state = createDefaultState()
    state.container.direction = 'row-reverse'
    state.container.width = 400
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], freeSpace: 100 }])
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
      { id: 'item-2', left: 200, top: 0, width: 200, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands.map(band => band.flow)).toEqual(['reverse'])
  })

  it('column 方向上「前面那个盒子」在上方，尾部空间朝上流', () => {
    const state = createDefaultState()
    state.container.direction = 'column'
    state.container.height = 300
    state.container.rowGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: 200 }])
    const measured = stage(400, 300, [
      { id: 'item-1', left: 0, top: 0, width: 400, height: 100 },
    ])

    expect(computeOverlay(state, derived, measured).bands.map(band => band.flow)).toEqual(['reverse'])
  })

  it('溢出标记不吃斜纹，也就没有流向', () => {
    const state = createDefaultState()
    state.container.width = 200
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: -80 }])
    const measured = stage(200, 200, [
      { id: 'item-1', left: 0, top: 0, width: 280, height: 200 },
    ])

    const [band] = computeOverlay(state, derived, measured).bands
    expect(band.kind).toBe('overflow')
    expect(band.flow).toBeUndefined()
  })
})
