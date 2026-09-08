import type { FlexContainerState, FlexItemState } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { resolveBasis } from './resolveBasis'

function setup(basis: string, size = 80): { item: FlexItemState, container: FlexContainerState } {
  const state = createDefaultState()
  const item = { ...createDefaultItem('x'), basis, size }
  return { item, container: state.container }
}

describe('resolveBasis', () => {
  it('auto 取内容固有尺寸', () => {
    const { item, container } = setup('auto', 120)
    expect(resolveBasis(item, container)).toBe(120)
  })

  it('content 同样取内容固有尺寸', () => {
    const { item, container } = setup('content', 64)
    expect(resolveBasis(item, container)).toBe(64)
  })

  it('0 解析为 0，而不是回退到内容尺寸', () => {
    const { item, container } = setup('0', 80)
    expect(resolveBasis(item, container)).toBe(0)
  })

  it('像素值直接取数值', () => {
    const { item, container } = setup('150px')
    expect(resolveBasis(item, container)).toBe(150)
  })

  it('百分比按容器主轴尺寸换算', () => {
    const { item, container } = setup('25%')
    container.width = 800
    expect(resolveBasis(item, container)).toBe(200)
  })

  it('column 方向下百分比按容器高度换算', () => {
    const { item, container } = setup('50%')
    container.direction = 'column'
    container.height = 300
    expect(resolveBasis(item, container)).toBe(150)
  })

  it('非法值回退到内容固有尺寸', () => {
    const { item, container } = setup('这不是长度', 90)
    expect(resolveBasis(item, container)).toBe(90)
  })
})
