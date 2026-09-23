import type { DerivedLayout, MeasuredStage } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { deriveLayout } from './deriveLayout'
import { computeOverlay } from './overlay'

/** 只有 computeOverlay 用得到的字段是真的，其余补默认值 */
function makeLines(lines: { index: number, itemIds: string[], remainingFreeSpace: number }[]): DerivedLayout {
  return {
    lines: lines.map(line => ({
      ...line,
      freeSpace: line.remainingFreeSpace,
      usedMainSize: 0,
      totalGrow: 0,
      totalShrinkWeighted: 0,
    })),
    items: [],
    fontSize: 16,
  }
}

/*
 * 真实 Chrome，根字号 20：A 宽 0，B 的 16em = 320px 放不下 300 的容器，换到第二行。
 * 几何上分不出来（A 宽 0、两者交叉轴不重叠），只能靠断行算法——而它必须用推导时的同一个字号，
 * 按默认 16 算 B 只有 256px，会被错排成同一行。
 */
function emScene() {
  const state = createDefaultState()
  Object.assign(state.container, { width: 300, wrap: 'wrap', columnGap: 0, rowGap: 0 })
  state.items = [
    { ...createDefaultItem('A'), basis: '0', size: 20, minWidthAuto: false },
    { ...createDefaultItem('B'), basis: '16em', size: 20 },
  ]
  const measured: MeasuredStage = {
    width: 300,
    height: 200,
    items: [
      { id: 'A', left: 0, top: 0, width: 0, height: 15 },
      { id: 'B', left: 0, top: 15, width: 300, height: 15 },
    ],
  }
  return { state, measured }
}

function stage(width: number, height: number, items: MeasuredStage['items']): MeasuredStage {
  return { width, height, items }
}

describe('computeOverlay', () => {
  it('行尾的空白画成一块剩余空间色块', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: 300 }])
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
    ])

    const { bands } = computeOverlay(state, derived, measured)

    expect(bands).toEqual([
      { kind: 'free', lineIndex: 0, x: 100, y: 0, width: 300, height: 200, flow: 'reverse', flowAxis: 'x' },
    ])
  })

  it('盒子之间的空隙扣掉 gap，剩下的才算剩余空间', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 20
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], remainingFreeSpace: 180 }])
    // 两个盒子之间隔了 100px，其中 20px 是 gap，剩下 80px 才是剩余空间
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
      { id: 'item-2', left: 200, top: 0, width: 100, height: 200 },
    ])

    const { bands } = computeOverlay(state, derived, measured)

    expect(bands).toEqual([
      // 紧贴后一个盒子画：200 - 80 = 120 起，宽 80
      { kind: 'free', lineIndex: 0, x: 120, y: 0, width: 80, height: 200, flow: 'forward', flowAxis: 'x' },
      { kind: 'free', lineIndex: 0, x: 300, y: 0, width: 100, height: 200, flow: 'reverse', flowAxis: 'x' },
    ])
  })

  it('空隙恰好等于 gap 时不画色块', () => {
    const state = createDefaultState()
    state.container.width = 220
    state.container.columnGap = 20
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], remainingFreeSpace: 0 }])
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
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: -80 }])
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
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: 200 }])
    const measured = stage(400, 300, [
      { id: 'item-1', left: 0, top: 0, width: 400, height: 100 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([
      { kind: 'free', lineIndex: 0, x: 0, y: 100, width: 400, height: 200, flow: 'reverse', flowAxis: 'y' },
    ])
  })

  it('多行各算各的，色块只覆盖本行的交叉轴范围', () => {
    const state = createDefaultState()
    state.container.width = 300
    state.container.wrap = 'wrap'
    state.container.columnGap = 0
    const derived = makeLines([
      { index: 0, itemIds: ['item-1'], remainingFreeSpace: 100 },
      { index: 1, itemIds: ['item-2'], remainingFreeSpace: 200 },
    ])
    const measured = stage(300, 200, [
      { id: 'item-1', left: 0, top: 0, width: 200, height: 90 },
      { id: 'item-2', left: 0, top: 110, width: 100, height: 90 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([
      { kind: 'free', lineIndex: 0, x: 200, y: 0, width: 100, height: 90, flow: 'reverse', flowAxis: 'x' },
      { kind: 'free', lineIndex: 1, x: 100, y: 110, width: 200, height: 90, flow: 'reverse', flowAxis: 'x' },
    ])
  })

  // 真实 Chrome：min-width:auto 把三个 basis 100px 的盒子撑到 150，浏览器排成两行，推导引擎是一行
  it('按浏览器实际分行来画，而不是按推导引擎的分行', () => {
    const state = createDefaultState()
    Object.assign(state.container, { width: 300, wrap: 'wrap', columnGap: 0, rowGap: 0 })
    state.items = ['A', 'B', 'C'].map(id => ({ ...createDefaultItem(id), basis: '100px', size: 150 }))
    const measured = stage(300, 200, [
      { id: 'A', left: 0, top: 0, width: 150, height: 20 },
      { id: 'B', left: 150, top: 0, width: 150, height: 20 },
      { id: 'C', left: 0, top: 20, width: 150, height: 20 },
    ])

    const overlay = computeOverlay(state, deriveLayout(state), measured)

    expect(overlay.bands).toEqual([
      { kind: 'free', lineIndex: 1, x: 150, y: 20, width: 150, height: 20, flow: 'reverse', flowAxis: 'x' },
    ])
    // 实际的两行在推导里都不存在，理论剩余无从对照
    expect(overlay.lines).toEqual([
      { index: 0, theoretical: null, actual: 0 },
      { index: 1, theoretical: null, actual: 150 },
    ])
  })

  it('分行用的是推导时的同一个根字号', () => {
    const { state, measured } = emScene()
    expect(computeOverlay(state, deriveLayout(state, 20), measured).lines.map(line => line.index)).toEqual([0, 1])
  })

  it('亚像素级的空隙不画，免得满屏发丝色块', () => {
    const state = createDefaultState()
    state.container.width = 200.3
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: 0.3 }])
    const measured = stage(200.3, 200, [
      { id: 'item-1', left: 0, top: 0, width: 200, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([])
  })

  it('观测里还没有这一行的盒子时跳过，不猜', () => {
    const state = createDefaultState()
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: 100 }])
    const measured = stage(400, 200, [])

    expect(computeOverlay(state, derived, measured)).toEqual({ bands: [], lines: [] })
  })

  it('每行同时给出理论与实际剩余空间，供图例并排对照', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 20
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], remainingFreeSpace: 180 }])
    // 实际渲染里两个盒子各 120（被 min-width:auto 撑住了），实际剩余 400-240-20=140
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 120, height: 200 },
      { id: 'item-2', left: 140, top: 0, width: 120, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).lines).toEqual([
      { index: 0, theoretical: 180, actual: 140 },
    ])
  })

  it('理论剩余取分配之后剩下的量，与实测剩余同一个口径', () => {
    const state = createDefaultState()
    Object.assign(state.container, { width: 600, columnGap: 0 })
    state.items = [{ ...createDefaultItem('item-1'), basis: '100px', grow: 0.5 }]
    const measured = stage(600, 200, [{ id: 'item-1', left: 0, top: 0, width: 350, height: 200 }])

    expect(computeOverlay(state, deriveLayout(state), measured).lines).toEqual([
      { index: 0, theoretical: 250, actual: 250 },
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
    expect(bands.at(-1)).toEqual({ kind: 'free', lineIndex: 0, x: 264, y: 0, width: 456, height: 320, flow: 'reverse', flowAxis: 'x' })
  })
})

// 斜纹朝「这块空间一旦被分配会流向谁」动；flow 用屏幕坐标，forward 朝右 / 下
describe('computeOverlay 的斜纹流向', () => {
  it('行尾的剩余空间流向前面那个盒子', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: 300 }])
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
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: 300 }])
    const measured = stage(400, 200, [
      { id: 'item-1', left: 300, top: 0, width: 100, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands.map(band => band.flow)).toEqual(['forward'])
  })

  it('被两个盒子夹住的空间没有唯一去向，沿主轴正方向流', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], remainingFreeSpace: 100 }])
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
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], remainingFreeSpace: 100 }])
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
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: 200 }])
    const measured = stage(400, 300, [
      { id: 'item-1', left: 0, top: 0, width: 400, height: 100 },
    ])

    expect(computeOverlay(state, derived, measured).bands.map(band => band.flow)).toEqual(['reverse'])
  })

  it('溢出标记不吃斜纹，也就没有流向', () => {
    const state = createDefaultState()
    state.container.width = 200
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: -80 }])
    const measured = stage(200, 200, [
      { id: 'item-1', left: 0, top: 0, width: 280, height: 200 },
    ])

    const [band] = computeOverlay(state, derived, measured).bands
    expect(band.kind).toBe('overflow')
    expect(band.flow).toBeUndefined()
  })
})

// 纹路朝向由流动轴决定，不看色块长宽比：长宽比与 flex-direction 无关，拿它当线索会读反
describe('computeOverlay 的流动轴', () => {
  it('row 下剩余空间沿水平轴流动', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: 300 }])
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands.map(band => band.flowAxis)).toEqual(['x'])
  })

  it('column 下剩余空间沿垂直轴流动，哪怕色块画出来是宽扁的', () => {
    const state = createDefaultState()
    state.container.direction = 'column'
    state.container.height = 320
    state.container.rowGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: 56 }])
    // 720 宽 × 56 高：极扁的横条，但它是沿垂直主轴流的
    const measured = stage(720, 320, [
      { id: 'item-1', left: 0, top: 0, width: 720, height: 264 },
    ])

    const [band] = computeOverlay(state, derived, measured).bands
    expect(band.width).toBeGreaterThan(band.height)
    expect(band.flowAxis).toBe('y')
  })

  it('column-reverse 的流动轴同样是垂直轴', () => {
    const state = createDefaultState()
    state.container.direction = 'column-reverse'
    state.container.height = 320
    state.container.rowGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: 120 }])
    const measured = stage(400, 320, [
      { id: 'item-1', left: 0, top: 0, width: 400, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands.map(band => band.flowAxis)).toEqual(['y'])
  })

  it('溢出标记不吃斜纹，也就没有流动轴', () => {
    const state = createDefaultState()
    state.container.width = 200
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], remainingFreeSpace: -80 }])
    const measured = stage(200, 200, [
      { id: 'item-1', left: 0, top: 0, width: 280, height: 200 },
    ])

    const [band] = computeOverlay(state, derived, measured).bands
    expect(band.flowAxis).toBeUndefined()
  })
})
