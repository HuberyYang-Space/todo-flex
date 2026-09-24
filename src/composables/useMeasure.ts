import type { MaybeRefOrGetter } from 'vue'
import type { MeasuredItem, MeasuredStage } from '~/core/types'

const measured = shallowRef<MeasuredStage | null>(null)

let activeStage: HTMLElement | null = null

/**
 * GSAP Flip 的 absolute 模式会把盒子临时设成绝对定位——那是真的改了布局，
 * 动画期间采到的尺寸是错的，所以挂起、结束后重采。
 *
 * 用计数而不是布尔：多段动画可能重叠，布尔会被先结束的那一段提前解除挂起。
 */
let pauseDepth = 0

/**
 * 尺寸读计算样式的小数值：offsetWidth 会取整，差出的 0.5px 正好撞上诊断的容差。
 * 位置只能读整数的 offset*——没有不受 transform 影响的小数读法
 */
function sizeOf(el: HTMLElement): { width: number, height: number } {
  const style = getComputedStyle(el)
  return { width: Number.parseFloat(style.width), height: Number.parseFloat(style.height) }
}

/** 计算样式与 offset* 都不含 transform 的影响。禁止改用 getBoundingClientRect：它会返回 Flip 动画的中间态 */
function readStage(stage: HTMLElement): MeasuredStage {
  const items: MeasuredItem[] = []

  for (const el of stage.querySelectorAll<HTMLElement>('[data-item-id]'))
    items.push({ id: el.dataset.itemId!, ...sizeOf(el), left: el.offsetLeft, top: el.offsetTop })

  return { ...sizeOf(stage), items }
}

/** 由 DemoStage 在 setup 里调用一次，观测器随该组件的作用域自动回收 */
function observeStage(target: MaybeRefOrGetter<HTMLElement | undefined | null>): void {
  const { state } = useFlexState()
  let observer: ResizeObserver | null = null

  function detach(): void {
    observer?.disconnect()
    observer = null
    activeStage = null
  }

  // 盒子会增删，每次重新登记全部观测目标，省去追踪哪些已失效
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
    // 旧演示区没跑完的动画留下的挂起就此作废，不清零的话新演示区永远采不到数
    pauseDepth = 0
    sample(stage)
  }, { immediate: true, flush: 'post' })

  // ResizeObserver 只报尺寸变化：改 justify-content 只挪位置，增删盒子会改变观测目标，都得靠状态变化兜底
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
  pauseDepth = Math.max(0, pauseDepth - 1)
  if (pauseDepth > 0)
    return

  // 补采挂起期间漏掉的变化，不能等下一次状态变化
  if (activeStage)
    measured.value = readStage(activeStage)
}

export function useMeasure() {
  return { measured, observeStage, pause, resume }
}
