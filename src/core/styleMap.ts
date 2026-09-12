import type { Direction, FlexContainerState, FlexItemState } from './types'
import { isRowDirection } from './axis'

/**
 * 状态 → 行内样式对象的映射。
 *
 * 抽出来是因为 Playground 的 DemoStage 与陷阱区的 TrapStage 都要把同一份状态排出来，
 * 两边曾经各存一份逐字相同的副本——加一个 flex 属性就得记着改两处，漏一处不会报错，
 * 只会让其中一个演示区静悄悄地不认这个属性。
 *
 * 与 `cssEmit` 的分工：那边产出「可以粘贴进项目的 CSS 文本」，会省略初始值、
 * 也不输出容器宽高（那是演示区的取景框，不属于导出的 CSS）；这边产出「渲染用的样式对象」，
 * 状态里写了什么就输出什么。口径不同，两边刻意不合并。
 *
 * 零 DOM、零 vue 依赖（红线 2）：返回值用自己的 StyleDecls，
 * 不 import vue 的 CSSProperties，由组件侧自行收口。
 */

/** 一组行内 CSS 声明。键名用 camelCase，值带单位 */
export type StyleDecls = Record<string, string | number>

/** 容器样式。位置一律交给浏览器真实排版，这里只负责把状态翻译成 CSS（红线 1） */
export function containerStyle(container: FlexContainerState): StyleDecls {
  return {
    display: container.display,
    flexDirection: container.direction,
    flexWrap: container.wrap,
    justifyContent: container.justifyContent,
    alignItems: container.alignItems,
    alignContent: container.alignContent,
    rowGap: `${container.rowGap}px`,
    columnGap: `${container.columnGap}px`,
    width: `${container.width}px`,
    height: `${container.height}px`,
  }
}

/**
 * 单个盒子的样式。
 *
 * `minWidthAuto` 为真时一条 `min-*` 都不写：自动最小尺寸这道下限故意不在代码里模拟，
 * 留给诊断层去发现「推导值被浏览器截住了」并指出是哪条规则介入（红线 3）。
 */
export function itemStyle(item: FlexItemState, direction: Direction): StyleDecls {
  return {
    flexGrow: item.grow,
    flexShrink: item.shrink,
    flexBasis: item.basis,
    order: item.order,
    alignSelf: item.alignSelf,
    // 关掉自动最小尺寸时，要关的是主轴方向上的那一个
    ...(item.minWidthAuto ? {} : { [isRowDirection(direction) ? 'minWidth' : 'minHeight']: '0px' }),
    ...(item.marginAuto ? { margin: 'auto' } : {}),
  }
}

/** 内容占位块撑出 min-content 尺寸，这样 min-width:auto 的下限才有真实来源 */
export function contentStyle(item: FlexItemState, direction: Direction): StyleDecls {
  return isRowDirection(direction)
    ? { width: `${item.size}px` }
    : { height: `${item.size}px` }
}
