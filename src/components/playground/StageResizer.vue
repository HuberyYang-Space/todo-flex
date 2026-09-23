<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { useFlip } from '~/composables/useFlip'
import { STAGE_LIMITS } from '~/core/defaults'

const { state } = useFlexState()
const { setScrubbing } = useFlip()

/** 位移量直接加在按下时的尺寸上，不逐帧累加，避免累积误差 */
const origin = ref<{ x: number, y: number, width: number, height: number } | null>(null)

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max)
}

function onPointerdown(event: PointerEvent): void {
  origin.value = {
    x: event.clientX,
    y: event.clientY,
    width: state.container.width,
    height: state.container.height,
  }
  setScrubbing(true)
  // happy-dom 里没有 setPointerCapture，可选链兜住
  ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)

  // preventDefault 挡住拖拽时的文本选中，也连带挡掉了默认的焦点转移，
  // 不手动补 focus 的话，点完手柄再按方向键改的是上一个焦点元素
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).focus()
}

// 挂在 window 上：鼠标甩出手柄之后拖拽仍要跟手
useEventListener(window, 'pointermove', (event: PointerEvent) => {
  const from = origin.value
  if (!from)
    return

  state.container.width = clamp(
    from.width + event.clientX - from.x,
    STAGE_LIMITS.minWidth,
    STAGE_LIMITS.maxWidth,
  )
  state.container.height = clamp(
    from.height + event.clientY - from.y,
    STAGE_LIMITS.minHeight,
    STAGE_LIMITS.maxHeight,
  )
})

useEventListener(window, 'pointerup', () => {
  origin.value = null
  setScrubbing(false)
})

function onKeydown(event: KeyboardEvent): void {
  const step = event.shiftKey ? 10 : 1
  const moves: Record<string, [number, number]> = {
    ArrowRight: [step, 0],
    ArrowLeft: [-step, 0],
    ArrowDown: [0, step],
    ArrowUp: [0, -step],
  }

  const move = moves[event.key]
  if (!move)
    return

  state.container.width = clamp(state.container.width + move[0], STAGE_LIMITS.minWidth, STAGE_LIMITS.maxWidth)
  state.container.height = clamp(state.container.height + move[1], STAGE_LIMITS.minHeight, STAGE_LIMITS.maxHeight)
  event.preventDefault()
}
</script>

<template>
  <button
    data-testid="stage-resizer"
    type="button"
    class="resizer"
    :aria-label="`调整演示区尺寸，当前 ${state.container.width} × ${state.container.height} 像素；方向键微调，按住 Shift 一次 10 像素`"
    @pointerdown="onPointerdown"
    @keydown="onKeydown"
  />
</template>

<style scoped>
.resizer {
  position: absolute;
  z-index: 2;
  right: -6px;
  bottom: -6px;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: linear-gradient(
    135deg,
    transparent 0 45%,
    var(--accent) 45% 55%,
    transparent 55% 70%,
    var(--accent) 70% 80%,
    transparent 80%
  );
  cursor: nwse-resize;
  touch-action: none;
}

.resizer:hover,
.resizer:focus-visible {
  outline: 2px solid var(--accent-2);
  outline-offset: 2px;
}
</style>
