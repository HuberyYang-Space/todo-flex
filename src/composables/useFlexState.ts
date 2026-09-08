import type { FlexItemState } from '~/core/types'
import { computed, reactive } from 'vue'
import { emitCss } from '~/core/cssEmit'
import { createDefaultItem, createDefaultState } from '~/core/defaults'
import { deriveLayout } from '~/core/deriveLayout'

/** 盒子数量上限：再多面板与演示区都会失去可读性 */
export const MAX_ITEMS = 8

const state = reactive(createDefaultState())

// 自增序号保证 id 唯一，删除后再新增不会撞号
let sequence = state.items.length

const selectedItem = computed<FlexItemState | null>(
  () => state.items.find(item => item.id === state.selectedId) ?? null,
)
const derived = computed(() => deriveLayout(state))
const css = computed(() => emitCss(state))

function selectItem(id: string | null): void {
  state.selectedId = id
}

function addItem(): void {
  if (state.items.length >= MAX_ITEMS)
    return
  state.items.push(createDefaultItem(`item-${++sequence}`))
}

function removeItem(id: string): void {
  // 至少留一个盒子，否则演示区没有任何可看的东西
  if (state.items.length <= 1)
    return

  const index = state.items.findIndex(item => item.id === id)
  if (index === -1)
    return

  state.items.splice(index, 1)
  if (state.selectedId === id)
    state.selectedId = null
}

function resetState(): void {
  Object.assign(state, createDefaultState())
  sequence = state.items.length
}

/** 全站唯一的状态源 */
export function useFlexState() {
  return { state, selectedItem, derived, css, selectItem, addItem, removeItem, resetState }
}
