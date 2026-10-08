import { describe, expect, it } from 'vitest'
import { axisVectors, measuredMainSize } from './axis'
import { createDefaultState } from './defaults'

describe('axisVectors', () => {
  it('row 的主轴向右、交叉轴向下', () => {
    const { container } = createDefaultState()
    expect(axisVectors(container)).toEqual({
      main: { dx: 1, dy: 0 },
      cross: { dx: 0, dy: 1 },
    })
  })

  it('row-reverse 只翻转主轴，交叉轴不动', () => {
    const { container } = createDefaultState()
    container.direction = 'row-reverse'
    expect(axisVectors(container)).toEqual({
      main: { dx: -1, dy: 0 },
      cross: { dx: 0, dy: 1 },
    })
  })

  it('column 时主轴向下、交叉轴向右', () => {
    const { container } = createDefaultState()
    container.direction = 'column'
    expect(axisVectors(container)).toEqual({
      main: { dx: 0, dy: 1 },
      cross: { dx: 1, dy: 0 },
    })
  })

  it('wrap-reverse 只翻转交叉轴，主轴不动', () => {
    const { container } = createDefaultState()
    container.wrap = 'wrap-reverse'
    expect(axisVectors(container)).toEqual({
      main: { dx: 1, dy: 0 },
      cross: { dx: 0, dy: -1 },
    })
  })

  it('column-reverse + wrap-reverse 两轴同时翻转', () => {
    const { container } = createDefaultState()
    container.direction = 'column-reverse'
    container.wrap = 'wrap-reverse'
    expect(axisVectors(container)).toEqual({
      main: { dx: 0, dy: -1 },
      cross: { dx: -1, dy: 0 },
    })
  })
})

describe('measuredMainSize', () => {
  it('横向主轴取实测宽，纵向主轴取实测高，reverse 不改变取哪一边', () => {
    const record = { width: 120, height: 40 }
    expect(measuredMainSize(record, 'row')).toBe(120)
    expect(measuredMainSize(record, 'row-reverse')).toBe(120)
    expect(measuredMainSize(record, 'column')).toBe(40)
    expect(measuredMainSize(record, 'column-reverse')).toBe(40)
  })
})
