import type { MaybeRefOrGetter } from 'vue'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { nextTick, ref, toValue, watch } from 'vue'
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
      // absolute 模式会把元素临时设成绝对定位，那是真的改布局——
      // 观测层必须先挂起，否则明细表的数字会在动画过程中乱跳
      pause()

      Flip.from(snapshot, {
        duration: reducedMotion() ? 0 : motion.layoutDuration,
        ease: motion.layoutEase,
        stagger: reducedMotion() ? 0 : motion.layoutStagger,
        absolute: true,
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
