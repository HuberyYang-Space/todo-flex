import type { FlexItemState, FlexState } from './types'

/** 浏览器的默认根字号；页面里读不到时的兜底 */
export const DEFAULT_FONT_SIZE = 16

/** 再多面板与演示区都会失去可读性，也超出 A–Z 标签的可读范围 */
export const MAX_ITEMS = 8

export const STAGE_LIMITS = {
  minWidth: 200,
  maxWidth: 1200,
  minHeight: 120,
  maxHeight: 600,
} as const

export function createDefaultItem(id: string): FlexItemState {
  return {
    id,
    grow: 0,
    shrink: 1,
    basis: 'auto',
    order: 0,
    alignSelf: 'auto',
    size: 80,
    minWidthAuto: true,
    marginAuto: false,
  }
}

export function createDefaultState(): FlexState {
  return {
    container: {
      display: 'flex',
      direction: 'row',
      wrap: 'nowrap',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      alignContent: 'normal',
      rowGap: 12,
      columnGap: 12,
      width: 720,
      height: 320,
    },
    items: ['item-1', 'item-2', 'item-3'].map(createDefaultItem),
    selectedId: null,
  }
}
