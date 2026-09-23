<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { useFlip } from '~/composables/useFlip'
import { containerProperties, numberProp } from '~/data/flexProperties'

const { state } = useFlexState()
const { setScrubbing } = useFlip()

const widthProp = numberProp(containerProperties, 'width')
const heightProp = numberProp(containerProperties, 'height')

/** 位移量直接加在按下时的尺寸上，不逐帧累加，避免累积误差 */
const origin = ref<{ x: number, y: number, width: number, height: number } | null>(null)

function clamp(value: number, { min, max }: { min: number, max: number }): number {
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
  // 不手动补 focus 的话，焦点留在上一个控件上，拖完再按方向键会改掉那个属性
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).focus()
}

// 挂在 window 上：鼠标甩出手柄之后拖拽仍要跟手
useEventListener(window, 'pointermove', (event: PointerEvent) => {
  const from = origin.value
  if (!from)
    return

  state.container.width = clamp(from.width + event.clientX - from.x, widthProp)
  state.container.height = clamp(from.height + event.clientY - from.y, heightProp)
})

useEventListener(window, 'pointerup', () => {
  origin.value = null
  setScrubbing(false)
})
</script>

<template>
  <button
    data-testid="stage-resizer"
    type="button"
    tabindex="-1"
    class="resizer"
    :aria-label="`拖拽调整演示区尺寸，当前 ${state.container.width} × ${state.container.height} 像素；键盘请用容器属性里的 width、height 滑块`"
    @pointerdown="onPointerdown"
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
