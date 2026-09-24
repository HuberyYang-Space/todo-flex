import type { MaybeRefOrGetter } from 'vue'
import type { Direction } from '~/core/types'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { isRowDirection } from '~/core/axis'
import { motion } from '~/visual/motion'

gsap.registerPlugin(Flip)

/** 连续拖拽期间跳过 Flip 直接跟手：手已经到了、方块还在追，反而拖泥带水 */
const scrubbing = ref(false)

function setScrubbing(value: boolean): void {
  scrubbing.value = value
}

// 不能只靠控件自己的 @pointerup：拖到控件外面松手时事件不落回控件，
// scrubbing 会永久卡在 true，之后所有动画都被静默抑制
if (typeof window !== 'undefined') {
  const release = (): void => setScrubbing(false)
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
}

/**
 * 挤压拉伸：起步时沿主轴拉长、垂直方向变窄，再弹回原形。
 * 形变打在内层 .stage-box 上，与 Flip 写在外层的位移各用各的 transform，互不覆盖。
 */
function squash(items: ArrayLike<HTMLElement>, direction: Direction): void {
  const boxes = Array.from(items)
    .map(el => el.querySelector<HTMLElement>('.stage-box'))
    .filter((box): box is HTMLElement => box !== null)
  if (boxes.length === 0)
    return

  const along = 1 + motion.squashAmount
  const across = 1 - motion.squashAmount * 0.6
  const isRow = isRowDirection(direction)

  gsap.fromTo(
    boxes,
    { scaleX: isRow ? along : across, scaleY: isRow ? across : along },
    {
      scaleX: 1,
      scaleY: 1,
      duration: motion.squashDuration,
      ease: motion.squashEase,
      stagger: motion.layoutStagger,
      // 收尾抹掉痕迹，免得和 CSS 的悬停缩放打架
      clearProps: 'scaleX,scaleY,transform',
    },
  )
}

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * 由 DemoStage 在 setup 里调用一次。
 * flush 'pre' 让回调跑在 DOM 更新之前，Flip.getState() 拍到的是旧位置；nextTick 之后已是新布局，Flip.from() 补上过渡。
 */
function observeFlip(target: MaybeRefOrGetter<HTMLElement | undefined | null>): void {
  const { state } = useFlexState()
  const { pause, resume } = useMeasure()

  watch(state, () => {
    const stage = toValue(target)
    if (!stage || scrubbing.value)
      return

    const items = stage.querySelectorAll<HTMLElement>('[data-item-id]')
    if (items.length === 0)
      return

    const snapshot = Flip.getState(items)

    nextTick(() => {
      pause()

      if (!reducedMotion())
        squash(items, state.container.direction)

      Flip.from(snapshot, {
        duration: reducedMotion() ? 0 : motion.layoutDuration,
        ease: motion.layoutEase,
        stagger: reducedMotion() ? 0 : motion.layoutStagger,
        // absolute 会把盒子临时移出 flex 布局，只有跨行迁移才必须靠它画出正确轨迹
        absolute: state.container.wrap !== 'nowrap',
        // 中断也要恢复，否则观测层永久卡在挂起状态
        onComplete: resume,
        onInterrupt: resume,
      })
    })
  }, { deep: true, flush: 'pre' })
}

export function useFlip() {
  return { scrubbing, setScrubbing, observeFlip }
}
