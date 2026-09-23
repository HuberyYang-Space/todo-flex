import type { FlexContainerState, FlexItemState, MeasuredItem } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { measuredLines } from './measuredLines'
import chromeScenes from './measuredLines.chrome.json'

/** basis 用运行期才能确定的 calc()，浏览器断行算法算不了，走几何兜底 */
function scene(container: Partial<FlexContainerState>, boxes: [string, number, number, number, number][], orders: Record<string, number> = {}) {
  const state = createDefaultState()
  Object.assign(state.container, { wrap: 'wrap', ...container })
  state.items = boxes.map(([id]) => ({ ...createDefaultItem(id), basis: 'calc(1px)', order: orders[id] ?? 0 }))
  const items: MeasuredItem[] = boxes.map(([id, left, top, width, height]) => ({ id, left, top, width, height }))
  return measuredLines(state, { width: 300, height: 200, items })
}

describe('measuredLines：几何兜底', () => {
  it('nowrap 永远只有一行', () => {
    expect(scene({ wrap: 'nowrap' }, [['A', 0, 0, 150, 20], ['B', 150, 0, 150, 20], ['C', 300, 0, 150, 20]]))
      .toEqual([['A', 'B', 'C']])
  })

  it('主轴坐标回退就是换了行（min-width:auto 撑宽后提前换行的实测场景）', () => {
    expect(scene({}, [['A', 0, 0, 150, 20], ['B', 150, 0, 150, 20], ['C', 0, 20, 150, 20]]))
      .toEqual([['A', 'B'], ['C']])
  })

  it('row-reverse 下主轴从右往左排，回退方向相应反过来', () => {
    expect(scene({ direction: 'row-reverse' }, [['A', 150, 0, 150, 20], ['B', 0, 0, 150, 20], ['C', 150, 20, 150, 20]]))
      .toEqual([['A', 'B'], ['C']])
  })

  it('column 下主轴是纵向', () => {
    expect(scene({ direction: 'column' }, [['A', 0, 0, 20, 150], ['B', 0, 150, 20, 150], ['C', 20, 0, 20, 150]]))
      .toEqual([['A', 'B'], ['C']])
  })

  it('按 order 排好之后的顺序扫描，与浏览器的排版顺序一致', () => {
    expect(scene({}, [['A', 0, 20, 150, 20], ['B', 0, 0, 150, 20], ['C', 150, 0, 150, 20]], { A: 1 }))
      .toEqual([['B', 'C'], ['A']])
  })

  it('justify-content: center 时新行首项仍在上一行末项之前', () => {
    expect(scene({ justifyContent: 'center' }, [['A', 50, 0, 150, 20], ['B', 200, 0, 150, 20], ['C', 125, 20, 150, 20]]))
      .toEqual([['A', 'B'], ['C']])
  })

  it('gap 为 0 且 align-self 不同、交叉轴互不重叠时，主轴没回退就仍是同一行', () => {
    expect(scene({ columnGap: 0 }, [['A', 0, 0, 100, 10], ['B', 100, 90, 100, 10]]))
      .toEqual([['A', 'B']])
  })

  it('前一个盒子宽度为 0、新行首项落在同一坐标上时，靠交叉轴越过当前行判出换行', () => {
    expect(scene({ columnGap: 0 }, [['A', 0, 0, 0, 20], ['B', 0, 20, 300, 20]]))
      .toEqual([['A'], ['B']])
  })

  it('wrap-reverse 按视觉行序返回（与推导引擎的 splitLines 同一约定）', () => {
    expect(scene({ wrap: 'wrap-reverse' }, [['A', 0, 20, 150, 20], ['B', 150, 20, 150, 20], ['C', 0, 0, 150, 20]]))
      .toEqual([['C'], ['A', 'B']])
  })

  it('浏览器断行算法：min-width:auto 把盒子撑到内容尺寸，提前换行（位置取自真实 Chrome）', () => {
    const state = createDefaultState()
    Object.assign(state.container, { wrap: 'wrap', width: 300, columnGap: 0, rowGap: 0 })
    state.items = ['A', 'B', 'C'].map(id => ({ ...createDefaultItem(id), basis: '100px', size: 150 }))
    const items = [['A', 0, 0], ['B', 150, 0], ['C', 0, 20]].map(([id, left, top]) => ({ id: id as string, left: left as number, top: top as number, width: 150, height: 20 }))

    expect(measuredLines(state, { width: 300, height: 200, items })).toEqual([['A', 'B'], ['C']])
  })

  it('断行算法的结果与实测矛盾时，退回几何分组而不是硬套', () => {
    // 状态说三个盒子放得下一行，实测却是 C 回到了行首——以实测为准
    const state = createDefaultState()
    Object.assign(state.container, { wrap: 'wrap', width: 720 })
    state.items = ['A', 'B', 'C'].map(id => createDefaultItem(id))
    const items = [['A', 0, 0], ['B', 150, 0], ['C', 0, 20]].map(([id, left, top]) => ({ id: id as string, left: left as number, top: top as number, width: 150, height: 20 }))

    expect(measuredLines(state, { width: 720, height: 200, items })).toEqual([['A', 'B'], ['C']])
  })

  it('还没被观测到的盒子跳过，不猜', () => {
    const state = createDefaultState()
    state.items = [createDefaultItem('A'), createDefaultItem('ghost')]
    expect(measuredLines(state, { width: 300, height: 200, items: [{ id: 'A', left: 0, top: 0, width: 50, height: 20 }] }))
      .toEqual([['A']])
  })
})

/*
 * 取自真实 Chrome 的随机场景里，纯靠几何位置分错的那些：全都卡在主轴尺寸为 0 的盒子上。
 * 同样是「宽度为 0、交叉轴互不重叠」，有的实际在同一行，有的实际换了行——几何上分不出来。
 */
describe('measuredLines：真实 Chrome 的疑难场景', () => {
  it.each(chromeScenes.map(scene => [scene.scene, scene] as const))('场景 %i', (_, scene) => {
    const state = createDefaultState()
    Object.assign(state.container, scene.container)
    state.items = scene.items as FlexItemState[]

    expect(measuredLines(state, { width: scene.container.width, height: scene.container.height, items: scene.measured })).toEqual(scene.lines)
  })
})
