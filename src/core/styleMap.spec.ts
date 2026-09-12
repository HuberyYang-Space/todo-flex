import type { Direction, FlexContainerState, FlexItemState } from './types'
import { describe, expect, it } from 'vitest'
import { containerStyle, contentStyle, itemStyle } from './styleMap'

function container(overrides: Partial<FlexContainerState> = {}): FlexContainerState {
  return {
    display: 'flex',
    direction: 'row',
    wrap: 'nowrap',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    alignContent: 'normal',
    rowGap: 12,
    columnGap: 16,
    width: 720,
    height: 320,
    ...overrides,
  }
}

function item(overrides: Partial<FlexItemState> = {}): FlexItemState {
  return {
    id: 'a',
    grow: 0,
    shrink: 1,
    basis: 'auto',
    order: 0,
    alignSelf: 'auto',
    size: 120,
    minWidthAuto: true,
    marginAuto: false,
    ...overrides,
  }
}

describe('containerStyle', () => {
  it('十个容器属性一个不落地映射出来，长度值带 px', () => {
    expect(containerStyle(container())).toEqual({
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      alignContent: 'normal',
      rowGap: '12px',
      columnGap: '16px',
      width: '720px',
      height: '320px',
    })
  })

  it('align-content 为 normal 也照样输出', () => {
    // 与 emitCss 的分工：那边省略初始值是为了让复制出去的 CSS 干净，
    // 演示区这边要的是「状态里写的就是渲染用的」，一省略就对不上账了
    expect(containerStyle(container({ alignContent: 'normal' })).alignContent).toBe('normal')
  })

  it('宽高照样输出——它是演示区的取景框，不跟 emitCss 的口径走', () => {
    const style = containerStyle(container({ width: 480, height: 200 }))

    expect(style.width).toBe('480px')
    expect(style.height).toBe('200px')
  })

  it('gap 拆成 rowGap/columnGap 两条，不用简写', () => {
    const style = containerStyle(container({ rowGap: 0, columnGap: 24 }))

    expect(style.rowGap).toBe('0px')
    expect(style.columnGap).toBe('24px')
    expect(style.gap).toBeUndefined()
  })
})

describe('itemStyle', () => {
  it('flex 三个分量与 order/alignSelf 原样输出，数值不转字符串', () => {
    const style = itemStyle(item({ grow: 2, shrink: 3, basis: '120px', order: -1, alignSelf: 'center' }), 'row')

    expect(style.flexGrow).toBe(2)
    expect(style.flexShrink).toBe(3)
    expect(style.flexBasis).toBe('120px')
    expect(style.order).toBe(-1)
    expect(style.alignSelf).toBe('center')
  })

  it('order 为 0、alignSelf 为 auto 时也不省略', () => {
    // emitCss 会省掉这两条初始值，映射层不能省：:style 上少一条就是「沿用上一帧」
    const style = itemStyle(item(), 'row')

    expect(style.order).toBe(0)
    expect(style.alignSelf).toBe('auto')
  })

  it('minWidthAuto 为真时绝不写任何 min-*', () => {
    // 红线 3：自动最小尺寸这道下限故意不在代码里模拟，
    // 留给诊断层去发现「理论值被浏览器截住了」并解释。这里补一条 min-* 就把缝隙堵死了。
    const style = itemStyle(item({ minWidthAuto: true }), 'row')

    expect(style.minWidth).toBeUndefined()
    expect(style.minHeight).toBeUndefined()
  })

  it('row 下关掉自动最小尺寸，关的是 min-width', () => {
    const style = itemStyle(item({ minWidthAuto: false }), 'row')

    expect(style.minWidth).toBe('0px')
    expect(style.minHeight).toBeUndefined()
  })

  it('column 下关掉自动最小尺寸，关的是 min-height', () => {
    const style = itemStyle(item({ minWidthAuto: false }), 'column')

    expect(style.minHeight).toBe('0px')
    expect(style.minWidth).toBeUndefined()
  })

  it.each<[Direction, string]>([
    ['row', 'minWidth'],
    ['row-reverse', 'minWidth'],
    ['column', 'minHeight'],
    ['column-reverse', 'minHeight'],
  ])('%s 认的是主轴而不是字面方向，关掉后写 %s', (direction, key) => {
    expect(itemStyle(item({ minWidthAuto: false }), direction)[key]).toBe('0px')
  })

  it('marginAuto 开则写 margin: auto，关则整条不出现', () => {
    expect(itemStyle(item({ marginAuto: true }), 'row').margin).toBe('auto')
    expect(itemStyle(item({ marginAuto: false }), 'row').margin).toBeUndefined()
  })
})

describe('contentStyle', () => {
  it('row 下 size 撑的是宽度', () => {
    expect(contentStyle(item({ size: 320 }), 'row')).toEqual({ width: '320px' })
  })

  it('column 下 size 撑的是高度', () => {
    expect(contentStyle(item({ size: 320 }), 'column')).toEqual({ height: '320px' })
  })

  it('reverse 方向按主轴算，不按字面', () => {
    expect(contentStyle(item({ size: 80 }), 'row-reverse')).toEqual({ width: '80px' })
    expect(contentStyle(item({ size: 80 }), 'column-reverse')).toEqual({ height: '80px' })
  })
})
