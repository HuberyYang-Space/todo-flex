import type { Direction, FlexContainerState, FlexItemState } from './types'
import { isRowDirection } from './axis'

/**
 * 状态 → 渲染用的行内样式。与 `cssEmit` 口径不同、刻意不合并：
 * 那边产出可粘贴的 CSS，省略初始值与容器宽高；这边状态里写了什么就输出什么。
 * 返回自己的 StyleDecls 而不是 vue 的 CSSProperties，保持 core 零 vue 依赖。
 * 键名用 camelCase，值带单位。
 */
export type StyleDecls = Record<string, string | number>

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

/** `minWidthAuto` 为真时一条 `min-*` 都不写，让浏览器的自动最小尺寸真实生效 */
export function itemStyle(item: FlexItemState, direction: Direction): StyleDecls {
  return {
    flexGrow: item.grow,
    flexShrink: item.shrink,
    flexBasis: item.basis,
    order: item.order,
    alignSelf: item.alignSelf,
    ...(item.minWidthAuto ? {} : { [isRowDirection(direction) ? 'minWidth' : 'minHeight']: '0px' }),
    ...(item.marginAuto ? { margin: 'auto' } : {}),
  }
}

/** 内容占位块撑出 min-content，min-width:auto 的下限才有真实来源 */
export function contentStyle(item: FlexItemState, direction: Direction): StyleDecls {
  return isRowDirection(direction)
    ? { width: `${item.size}px` }
    : { height: `${item.size}px` }
}
