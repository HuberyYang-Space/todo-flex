import type { FlexItemState } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { computeFreeSpace, distributeGrow, distributeShrink, shrinkWeight } from './distribute'

function makeItems(specs: Partial<FlexItemState>[]): FlexItemState[] {
  return specs.map((spec, index) => ({ ...createDefaultItem(`i${index + 1}`), ...spec }))
}

describe('computeFreeSpace', () => {
  it('剩余空间 = 容器主轴 - Σ假设尺寸 - Σgap', () => {
    const { container } = createDefaultState()
    container.width = 600
    container.columnGap = 20
    const items = makeItems([{ size: 100 }, { size: 100 }, { size: 100 }])
    // 600 - 300 - 40 = 260
    expect(computeFreeSpace(items, container)).toBe(260)
  })

  it('单个盒子时不计入 gap', () => {
    const { container } = createDefaultState()
    container.width = 500
    container.columnGap = 20
    expect(computeFreeSpace(makeItems([{ size: 100 }]), container)).toBe(400)
  })

  it('内容超出容器时返回负值', () => {
    const { container } = createDefaultState()
    container.width = 200
    container.columnGap = 0
    const items = makeItems([{ size: 150 }, { size: 150 }])
    expect(computeFreeSpace(items, container)).toBe(-100)
  })

  it('基于 basis 而非内容尺寸计算', () => {
    const { container } = createDefaultState()
    container.width = 500
    container.columnGap = 0
    const items = makeItems([{ size: 300, basis: '100px' }, { size: 300, basis: '100px' }])
    expect(computeFreeSpace(items, container)).toBe(300)
  })
})

describe('distributeGrow', () => {
  it('按 grow 占比瓜分剩余空间', () => {
    const items = makeItems([{ grow: 1 }, { grow: 3 }])
    const result = distributeGrow(items, 200)
    expect(result.get('i1')).toBe(50)
    expect(result.get('i2')).toBe(150)
  })

  it('grow 全为 0 时谁都不分，剩余空间原样留下', () => {
    const items = makeItems([{ grow: 0 }, { grow: 0 }])
    const result = distributeGrow(items, 200)
    expect(result.get('i1')).toBe(0)
    expect(result.get('i2')).toBe(0)
  })

  // 规范 §9.7 第 4b 步；期望值取自真实浏览器
  it('grow 之和小于 1 时只分出对应比例的剩余空间', () => {
    expect(distributeGrow(makeItems([{ grow: 0.5 }]), 500).get('i1')).toBe(250)

    const two = distributeGrow(makeItems([{ grow: 0.2 }, { grow: 0.3 }]), 500)
    expect(two.get('i1')).toBeCloseTo(100)
    expect(two.get('i2')).toBeCloseTo(150)
  })

  it('负数 grow 按 0 处理', () => {
    const items = makeItems([{ grow: -5 }, { grow: 1 }])
    const result = distributeGrow(items, 100)
    expect(result.get('i1')).toBe(0)
    expect(result.get('i2')).toBe(100)
  })
})

describe('distributeShrink', () => {
  it('按 shrink × basis 加权分摊溢出量，结果为负', () => {
    const { container } = createDefaultState()
    // 权重：1×300 = 300 与 1×100 = 100，合计 400
    // 溢出 -200 → i1 分 -150，i2 分 -50
    const items = makeItems([
      { shrink: 1, basis: '300px' },
      { shrink: 1, basis: '100px' },
    ])
    const result = distributeShrink(items, -200, container)
    expect(result.get('i1')).toBe(-150)
    expect(result.get('i2')).toBe(-50)
  })

  it('shrink 之和小于 1 时只让出对应比例的溢出量', () => {
    const { container } = createDefaultState()
    const items = makeItems([{ shrink: 0.5, basis: '900px' }])

    expect(distributeShrink(items, -300, container).get('i1')).toBe(-150)
  })

  it('shrink 为 0 的项不参与收缩', () => {
    const { container } = createDefaultState()
    const items = makeItems([
      { shrink: 0, basis: '200px' },
      { shrink: 1, basis: '200px' },
    ])
    const result = distributeShrink(items, -100, container)
    expect(result.get('i1')).toBe(0)
    expect(result.get('i2')).toBe(-100)
  })

  it('全部 shrink 为 0 时不收缩，溢出保持', () => {
    const { container } = createDefaultState()
    const items = makeItems([{ shrink: 0 }, { shrink: 0 }])
    const result = distributeShrink(items, -100, container)
    expect(result.get('i1')).toBe(0)
    expect(result.get('i2')).toBe(0)
  })

  it('basis 为 0 的项权重为 0，不参与收缩', () => {
    const { container } = createDefaultState()
    const items = makeItems([
      { shrink: 1, basis: '0' },
      { shrink: 1, basis: '200px' },
    ])
    expect(shrinkWeight(items[0], container)).toBe(0)
    const result = distributeShrink(items, -100, container)
    expect(result.get('i1')).toBe(0)
    expect(result.get('i2')).toBe(-100)
  })
})
