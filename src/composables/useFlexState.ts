import type { FlexItemState, FlexState } from '~/core/types'
import type { ShareIssue } from '~/core/urlCodec'
import { DEFAULT_FONT_SIZE, MAX_ITEMS } from '~/core/constants'
import { emitCss } from '~/core/cssEmit'
import { createDefaultItem, createDefaultState } from '~/core/defaults'
import { deriveLayout } from '~/core/deriveLayout'
import { decodeOrDefault } from '~/core/urlCodec'

/**
 * 必须在模块加载这一刻读地址栏：晚到 onMounted 会先闪一帧默认布局，
 * 还会让 GSAP Flip 把这一帧当成真实的布局变化播一遍过渡。
 */
function readInitialUrl(): { state: FlexState, issue: ShareIssue | null } {
  return typeof location === 'undefined' ? { state: createDefaultState(), issue: null } : decodeOrDefault(location.search)
}

const initial = readInitialUrl()
const state = reactive(initial.state)

/** 首屏链接被整条拒掉的原因。状态一变，地址栏就被改写成当前状态，提示说的那条链接已经不在了 */
const shareIssue = shallowRef<ShareIssue | null>(initial.issue)
watch(state, () => {
  shareIssue.value = null
}, { deep: true, once: true })

/** em / rem 的换算基准。只在加载时读一次，用户在会话中途改浏览器默认字号的情况不追 */
const rootFontSize = typeof document === 'undefined'
  ? DEFAULT_FONT_SIZE
  : Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || DEFAULT_FONT_SIZE

// 自增而不是按数量取号：删除后再新增不会撞号
let sequence = state.items.length

const selectedItem = computed<FlexItemState | null>(
  () => state.items.find(item => item.id === state.selectedId) ?? null,
)
const derived = computed(() => deriveLayout(state, rootFontSize))
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
  if (state.items.length <= 1)
    return

  const index = state.items.findIndex(item => item.id === id)
  if (index === -1)
    return

  state.items.splice(index, 1)
  if (state.selectedId === id)
    state.selectedId = null
}

function dismissShareIssue(): void {
  shareIssue.value = null
}

function resetState(): void {
  Object.assign(state, createDefaultState())
  sequence = state.items.length
}

export function useFlexState() {
  return { state, selectedItem, derived, css, shareIssue, dismissShareIssue, selectItem, addItem, removeItem, resetState }
}
