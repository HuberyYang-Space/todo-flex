<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { STAGE_LIMITS } from '~/core/defaults'

const { state } = useFlexState()

/** 按下时记住起点与当时的尺寸，位移量直接加在起始尺寸上，避免累积误差 */
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
  // 指针捕获让快速拖出手柄范围时事件不丢；happy-dom 里没有这个方法，可选链兜住
  ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
  event.preventDefault()
}

// 监听挂在 window 上而不是手柄上：鼠标甩出手柄之后拖拽仍要跟手
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
})

// 方向键微调是这个手柄的键盘等价物——它替掉了原来两个可聚焦的 range 滑块
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
/*
 * 手柄贴在演示区右下角外沿，落在 wrapper 上而不是 .stage 里——
 * .stage 是真实 flex 容器，塞进去会变成一个盒子。
 */
.resizer {
  position: absolute;
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
