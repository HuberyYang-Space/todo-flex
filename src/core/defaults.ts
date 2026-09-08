import type { FlexItemState, FlexState } from './types'

/** 默认盒子等价于 flex: 0 1 auto，即浏览器的初始值 */
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
