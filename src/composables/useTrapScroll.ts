import type { Ref } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { onMounted, onUnmounted, ref } from 'vue'

gsap.registerPlugin(ScrollTrigger)

/** 现象 / 归因 / 修复 */
export const BEAT_COUNT = 3

/** 每个陷阱 pin 住的滚动距离，200% 即约三屏 */
const PIN_DISTANCE = '+=200%'

/** 降级的视口宽度上限（px）。窄屏不做 pin */
const MOBILE_MAX_WIDTH = 767

/**
 * 拍与拍之间的滞回带宽。
 *
 * 不加这个的话，手指停在 1/3 边界附近轻轻一抖，拍号就会在两拍之间疯狂跳——
 * 演示区跟着来回换状态，看着像坏了。只有确实越过「边界 ± 这个值」才换拍。
 */
const HYSTERESIS = 0.04

/**
 * 滚动进度 → 拍号，带滞回。
 *
 * 三拍之间是离散的属性变化（`min-width: auto` → `0` 根本没有中间态），
 * 所以这里只做映射，不做任何连续插值。
 */
export function beatFromProgress(progress: number, current: number): number {
  const clamped = Math.min(Math.max(progress, 0), 1)
  const raw = Math.min(BEAT_COUNT - 1, Math.floor(clamped * BEAT_COUNT))
  if (raw === current)
    return current

  // 往前翻看的是目标拍的下边界，往回退看的是当前拍的下边界
  const boundary = raw > current ? raw / BEAT_COUNT : (raw + 1) / BEAT_COUNT
  const crossed = raw > current
    ? clamped >= boundary + HYSTERESIS
    : clamped <= boundary - HYSTERESIS

  return crossed ? raw : current
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 是否走降级形态。两个条件任一命中即降级，**只维护这一套降级**：
 * - 系统开着「减少动态效果」
 * - 窄屏（iOS Safari 的地址栏伸缩会让 pin 的 vh 抖，是经典坑）
 */
export function shouldDegrade(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return true
  return prefersReducedMotion() || window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches
}

/**
 * 把一个陷阱板块 pin 在视口里，用滚动距离推进三拍。
 *
 * 降级时一个 ScrollTrigger 都不建，拍号停在 0，由调用方改渲染成三拍全展开的静态堆叠。
 */
export function useTrapScroll(el: Ref<HTMLElement | undefined>): {
  beat: Ref<number>
  degraded: Ref<boolean>
} {
  const beat = ref(0)
  // 组件创建时就地判断，不等 onMounted——晚一拍会先渲染一帧默认（降级）形态，
  // 等 ScrollTrigger.create() 建 pin-spacer 时读到的还是这一帧的错误布局高度。
  // shouldDegrade() 本身兼容 SSR/测试环境（无 window 时直接判定降级），无需等挂载。
  const degraded = ref(shouldDegrade())
  let trigger: ScrollTrigger | undefined

  onMounted(() => {
    if (degraded.value || !el.value)
      return

    trigger = ScrollTrigger.create({
      trigger: el.value,
      start: 'top top',
      end: PIN_DISTANCE,
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        beat.value = beatFromProgress(self.progress, beat.value)
      },
    })
  })

  onUnmounted(() => {
    trigger?.kill()
    trigger = undefined
  })

  return { beat, degraded }
}
