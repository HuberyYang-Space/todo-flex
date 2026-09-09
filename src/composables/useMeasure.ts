import type { MaybeRefOrGetter } from 'vue'
import type { MeasuredItem, MeasuredStage } from '~/core/types'
import { onScopeDispose, shallowRef, toValue, watch } from 'vue'
import { useFlexState } from './useFlexState'

/** 全站唯一的观测结果，明细表与叠加层都从这里取数 */
const measured = shallowRef<MeasuredStage | null>(null)

/** 当前接入观测的演示区，resume() 要靠它立即重采 */
let activeStage: HTMLElement | null = null

/**
 * 挂起标志。GSAP Flip 的 absolute 模式会把元素临时设成绝对定位——那是真的改布局，
 * 动画期间采到的尺寸是错的，明细表的数字会乱跳。所以动画期间挂起，结束后重采。
 *
 * 注意这与红线 5 是两回事：红线 5 挡的是 getBoundingClientRect 返回 transform 中间态，
 * 这里挡的是 absolute 模式真的改了布局。两个坑都要堵。
 *
 * 用计数而不是布尔：多段动画可能重叠（比如换行动画还没完就又改了 direction），
 * 布尔会被先结束的那一段提前解除挂起，counter 才能保证「全部结束才恢复」。
 */
let pauseDepth = 0

/**
 * 读取浏览器算出的真实布局。
 *
 * 只用 offset*：它们报告的是布局尺寸与布局位置，不含 transform 的影响。
 * 禁止改用 getBoundingClientRect——M4 接入 GSAP Flip 后它会返回动画中间态，
 * 明细表的数字会在动画过程中乱跳。
 */
function readStage(stage: HTMLElement): MeasuredStage {
  const items: MeasuredItem[] = []

  for (const el of stage.querySelectorAll<HTMLElement>('[data-item-id]')) {
    items.push({
      id: el.dataset.itemId!,
      width: el.offsetWidth,
      height: el.offsetHeight,
      left: el.offsetLeft,
      top: el.offsetTop,
    })
  }

  return { width: stage.offsetWidth, height: stage.offsetHeight, items }
}

/**
 * 把演示区接入观测。由 DemoStage 在 setup 里调用一次，
 * 观测器随该组件的作用域自动回收。
 */
function observeStage(target: MaybeRefOrGetter<HTMLElement | undefined | null>): void {
  const { state } = useFlexState()
  let observer: ResizeObserver | null = null

  function detach(): void {
    observer?.disconnect()
    observer = null
    activeStage = null
  }

  // 盒子会增删，每次都重新登记一遍观测目标，省去追踪哪些元素已经失效
  function attach(stage: HTMLElement): void {
    observer?.disconnect()
    observer?.observe(stage)
    for (const el of stage.querySelectorAll<HTMLElement>('[data-item-id]'))
      observer?.observe(el)
  }

  function sample(stage: HTMLElement): void {
    attach(stage)
    if (pauseDepth > 0)
      return
    measured.value = readStage(stage)
  }

  watch(() => toValue(target), (stage) => {
    detach()

    if (!stage) {
      measured.value = null
      return
    }

    observer = new ResizeObserver(() => {
      if (pauseDepth > 0)
        return
      measured.value = readStage(stage)
    })
    activeStage = stage
    // 换了一个演示区，旧那个没结束的动画留下的挂起就此作废——
    // 不清零的话，一次没跑完的动画会让新演示区永远采不到数
    pauseDepth = 0
    sample(stage)
  }, { immediate: true, flush: 'post' })

  // ResizeObserver 只报尺寸变化。改 justify-content 时盒子只挪位置不变尺寸，
  // 增删盒子还会改变观测目标集合——这两种情况都得靠状态变化兜底。
  watch(state, () => {
    const stage = toValue(target)
    if (stage)
      sample(stage)
  }, { deep: true, flush: 'post' })

  onScopeDispose(detach)
}

function pause(): void {
  pauseDepth += 1
}

function resume(): void {
  // 不做下溢：多余的 resume 也只是把状态确认为「没有挂起」
  pauseDepth = Math.max(0, pauseDepth - 1)
  if (pauseDepth > 0)
    return

  // 挂起期间漏掉的变化要补采一次，不能等下一次状态变化
  if (activeStage)
    measured.value = readStage(activeStage)
}

export function useMeasure() {
  return { measured, observeStage, pause, resume }
}
