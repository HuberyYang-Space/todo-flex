import type { FlexItemState } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { splitLines } from './splitLines'

function makeItems(specs: Partial<FlexItemState>[]): FlexItemState[] {
  return specs.map((spec, index) => ({ ...createDefaultItem(`i${index + 1}`), ...spec }))
}

describe('splitLines', () => {
  it('nowrap 时永远只有一行，即使总尺寸超出容器', () => {
    const { container } = createDefaultState()
    container.width = 200
    const items = makeItems([{ size: 150 }, { size: 150 }, { size: 150 }])
    expect(splitLines(items, container)).toEqual([['i1', 'i2', 'i3']])
  })

  it('wrap 时按假设尺寸加 gap 累计断行', () => {
    const { container } = createDefaultState()
    container.wrap = 'wrap'
    container.width = 300
    container.columnGap = 10
    // 120 + 10 + 120 = 250 放得下；再加 10 + 120 = 380 放不下，第三个换行
    const items = makeItems([{ size: 120 }, { size: 120 }, { size: 120 }])
    expect(splitLines(items, container)).toEqual([['i1', 'i2'], ['i3']])
  })

  it('单个盒子超宽时独占一行，不会产生空行', () => {
    const { container } = createDefaultState()
    container.wrap = 'wrap'
    container.width = 100
    const items = makeItems([{ size: 500 }, { size: 40 }])
    expect(splitLines(items, container)).toEqual([['i1'], ['i2']])
  })

  it('order 小的排在前面，并影响分行结果', () => {
    const { container } = createDefaultState()
    container.wrap = 'wrap'
    container.width = 300
    container.columnGap = 0
    const items = makeItems([
      { size: 200, order: 2 },
      { size: 200, order: 1 },
      { size: 50, order: 0 },
    ])
    expect(splitLines(items, container)).toEqual([['i3', 'i2'], ['i1']])
  })

  it('order 相同时保持文档顺序（稳定排序）', () => {
    const { container } = createDefaultState()
    const items = makeItems([{ size: 10 }, { size: 10 }, { size: 10 }])
    expect(splitLines(items, container)).toEqual([['i1', 'i2', 'i3']])
  })

  it('wrap-reverse 反转行的视觉顺序', () => {
    const { container } = createDefaultState()
    container.wrap = 'wrap-reverse'
    container.width = 300
    container.columnGap = 0
    const items = makeItems([{ size: 200 }, { size: 200 }])
    expect(splitLines(items, container)).toEqual([['i2'], ['i1']])
  })

  it('column 方向按容器高度分行', () => {
    const { container } = createDefaultState()
    container.direction = 'column'
    container.wrap = 'wrap'
    container.height = 200
    container.rowGap = 0
    const items = makeItems([{ size: 120 }, { size: 120 }])
    expect(splitLines(items, container)).toEqual([['i1'], ['i2']])
  })
})
