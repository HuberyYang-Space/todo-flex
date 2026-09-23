import type { FlexContainerState, FlexItemState, FlexState } from './types'
import type { PropertyDef } from '~/data/flexProperties'
import { containerProperties, itemProperties } from '~/data/flexProperties'

/** 默认值只在属性表里写一份，面板显示的默认与初始状态不会各说各话 */
function defaultsOf<T>(props: PropertyDef[]): T {
  return Object.fromEntries(props.map(prop => [prop.key, prop.default])) as T
}

export function createDefaultItem(id: string): FlexItemState {
  return { id, ...defaultsOf<Omit<FlexItemState, 'id'>>(itemProperties) }
}

export function createDefaultState(): FlexState {
  return {
    container: defaultsOf<FlexContainerState>(containerProperties),
    items: ['item-1', 'item-2', 'item-3'].map(createDefaultItem),
    selectedId: null,
  }
}
