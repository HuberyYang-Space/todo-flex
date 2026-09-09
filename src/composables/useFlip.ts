import type { MaybeRefOrGetter } from 'vue'
import type { Direction } from '~/core/types'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { nextTick, ref, toValue, watch } from 'vue'
import { isRowDirection } from '~/core/axis'
import { motion } from '~/visual/motion'
import { useFlexState } from './useFlexState'
import { useMeasure } from './useMeasure'

gsap.registerPlugin(Flip)

/**
 * 连续拖拽标志。拖 gap 滑块、拖 resize 手柄时手已经到了、方块还在追，
 * 播动画反而拖泥带水，所以拖拽期间一律跳过 Flip、直接跟手。
 */
const scrubbing = ref(false)

function setScrubbing(value: boolean): void {
  scrubbing.value = value
}

/*
 * 全局兜底：只要指针抬起或被取消，拖拽就算结束。
 *
 * 不能只靠控件自己的 @pointerup——在滑块上按下、拖到滑块外面松手时，事件不会落回滑块，
 * scrubbing 会永久卡在 true，之后所有动画都被静默抑制。这种清理不该指望每个调用方都记得。
 */
if (typeof window !== 'undefined') {
  const release = (): void => setScrubbing(false)
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
}

/**
 * 挤压拉伸：盒子起步时沿主轴拉长、垂直方向变窄，再弹回原形。
 *
 * 这是水滴与果冻手感的来源——真实世界里有质量的东西加速时会变形，
 * 只做位移的动画看着总像纸片在滑。形变打在内层 .stage-box 上，
 * 与 Flip 写在外层的位移各用各的 transform，互不覆盖。
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
      // 形变是一次性的装饰，收尾必须把痕迹抹干净，免得和 CSS 的悬停缩放打架
      clearProps: 'scaleX,scaleY,transform',
    },
  )
}

/** 尊重系统的减弱动效偏好：时长归零，布局照变，只是不再有过渡 */
function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * 把演示区接入 Flip 编排。由 DemoStage 在 setup 里调用一次。
 *
 * 时序按设计文档 §7 定死的写法：flush 'pre' 保证 watch 回调跑在 DOM 更新之前，
 * 此时 Flip.getState() 拍到的是旧位置；nextTick 之后 DOM 已是新布局，Flip.from() 补上过渡。
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
      // 动画期间 DOM 一直在变，挂起采样避免无谓的抖动，动画收尾时再采一次准的
      pause()

      if (!reducedMotion())
        squash(items, state.container.direction)

      Flip.from(snapshot, {
        duration: reducedMotion() ? 0 : motion.layoutDuration,
        ease: motion.layoutEase,
        stagger: reducedMotion() ? 0 : motion.layoutStagger,
        /*
         * 只有换行场景才开 absolute，按设计文档 §6.2 的原意。
         *
         * 这个模式会把盒子临时设成 position: absolute——那是真的改布局，
         * 期间它们不再是 flex item。只有跨行迁移必须靠它才能画出正确的轨迹；
         * 单行内的重排用不着，代价却照付。
         */
        absolute: state.container.wrap !== 'nowrap',
        // 中断也要恢复，否则观测层会永久卡在挂起状态
        onComplete: resume,
        onInterrupt: resume,
      })
    })
  }, { deep: true, flush: 'pre' })
}

export function useFlip() {
  return { scrubbing, setScrubbing, observeFlip }
}
