import type { FlexItemState, FlexState } from '~/core/types'
import { computed, reactive } from 'vue'
import { emitCss } from '~/core/cssEmit'
import { createDefaultItem, createDefaultState } from '~/core/defaults'
import { deriveLayout } from '~/core/deriveLayout'
import { decodeOrDefault } from '~/core/urlCodec'

/** 盒子数量上限：再多面板与演示区都会失去可读性 */
export const MAX_ITEMS = 8

/**
 * 首屏状态。带分享短码进来时直接还原成对方的画面——
 * **必须在模块加载这一刻就读**，晚到 onMounted 再改会先闪一帧默认布局，
 * 还会让 GSAP Flip 把这一帧当成真实的布局变化播一遍过渡。
 */
function createInitialState(): FlexState {
  return typeof location === 'undefined' ? createDefaultState() : decodeOrDefault(location.search)
}

const state = reactive(createInitialState())

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

/**
 * 下一个可用的自增序号：取现有 id 的数字后缀最大值。
 *
 * 不能图省事用 `state.items.length`——载入进来的状态未必是 item-1..item-N 连续编号，
 * 一旦中间有跳号（[item-1, item-3]），长度算出来是 2，下一个 addItem 就生成 item-3 直接撞上。
 * resetState 那边入参恒定是 createDefaultState()，不存在这个问题，所以保持原样不动。
 */
function maxSequence(items: FlexItemState[]): number {
  return items.reduce((max, item) => {
    const suffix = Number(item.id.replace(/^item-/, ''))
    return Number.isFinite(suffix) ? Math.max(max, suffix) : max
  }, 0)
}

function resetState(): void {
  Object.assign(state, createDefaultState())
  sequence = state.items.length
}

/**
 * 整体替换布局状态。陷阱区的「载入 Playground 复现」用它。
 *
 * 不走地址栏：本模块只在加载那一刻读一次 `location.search`，之后没有任何人监听它，
 * 光写 URL 是不会生效的。改 state 反而够了——`useShareUrl` 一直 watch 着，
 * 300ms 后地址栏自己就跟上了。
 *
 * 深拷贝一次再赋值：入参多半是 `resolveVariant()` 每次新造的对象，但调用方
 * 万一传了个会复用的引用进来，单例就会跟外面那份悄悄共享 items。
 */
function loadState(next: FlexState): void {
  Object.assign(state, structuredClone(next))
  // 从载入的 id 里推下一个序号，不能用 length —— 见 maxSequence 的注释
  sequence = maxSequence(state.items)
}

/** 全站唯一的状态源 */
export function useFlexState() {
  return { state, selectedItem, derived, css, selectItem, addItem, removeItem, resetState, loadState }
}
