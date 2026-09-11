import type {
  FlexContainerState,
  FlexItemState,
  FlexState,
  PropertyDiff,
  Trap,
  TrapVariant,
} from './types'
import { createDefaultItem, createDefaultState } from './defaults'

/**
 * 差异表的行序。显式列出而不是 `Object.keys(state.container)`——
 * 后者的顺序依赖对象字面量的书写顺序，哪天调一下 createDefaultState 的字段排列，
 * 归因拍的行序就跟着无声无息地变了。测试里断言这份清单覆盖完整，漏字段会红。
 */
export const CONTAINER_KEYS = [
  'display',
  'direction',
  'wrap',
  'justifyContent',
  'alignItems',
  'alignContent',
  'rowGap',
  'columnGap',
  'width',
  'height',
] as const satisfies readonly (keyof FlexContainerState)[]

export const ITEM_KEYS = [
  'grow',
  'shrink',
  'basis',
  'order',
  'alignSelf',
  'size',
  'minWidthAuto',
  'marginAuto',
] as const satisfies readonly (keyof Omit<FlexItemState, 'id'>)[]

/** 把一层变体叠到已有状态上，返回新对象——入参一律不改 */
function applyVariant(state: FlexState, variant: TrapVariant): FlexState {
  const container = { ...state.container, ...variant.container }

  // 给了 itemCount 就按这个数量重建：多则裁掉，少则用默认盒子补齐
  const source = variant.itemCount === undefined
    ? state.items
    : Array.from(
        { length: variant.itemCount },
        (_, index) => state.items[index] ?? createDefaultItem(`item-${index + 1}`),
      )

  const items = source.map((item, index) => {
    const patch = variant.items?.find(entry => entry.index === index)?.patch
    return patch ? { ...item, ...patch } : { ...item }
  })

  return { container, items, selectedId: state.selectedId }
}

/** 默认状态 → base → 指定变体，逐层叠出一份完整可用的 FlexState */
export function resolveVariant(trap: Trap, which: 'before' | 'after'): FlexState {
  return applyVariant(applyVariant(createDefaultState(), trap.base), trap[which])
}

/**
 * 两份完整状态相减。
 *
 * **必须拿解析后的完整 state 相减，不能直读 patch**：base 里可能已经含有
 * 与 after 相同的字段，直读 patch 会报出根本不存在的假差异。
 *
 * 值一律 String 化，格式化成人话（`minWidthAuto: true` → `min-width: auto`）
 * 是展示层的事——core 不碰文案。
 */
export function diffStates(before: FlexState, after: FlexState): PropertyDiff[] {
  const diffs: PropertyDiff[] = []

  for (const key of CONTAINER_KEYS) {
    const from = before.container[key]
    const to = after.container[key]
    if (from !== to)
      diffs.push({ scope: 'container', key, from: String(from), to: String(to) })
  }

  const count = Math.min(before.items.length, after.items.length)
  for (let index = 0; index < count; index++) {
    for (const key of ITEM_KEYS) {
      const from = before.items[index][key]
      const to = after.items[index][key]
      if (from !== to)
        diffs.push({ scope: 'item', itemIndex: index, key, from: String(from), to: String(to) })
    }
  }

  return diffs
}
