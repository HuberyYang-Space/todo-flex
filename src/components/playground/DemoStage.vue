<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { FlexItemState } from '~/core/types'
import { computed, ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { useFlip } from '~/composables/useFlip'
import { useMeasure } from '~/composables/useMeasure'
import { useOverlay } from '~/composables/useOverlay'
import { itemLabel } from '~/core/labels'
import { containerStyle as mapContainer, contentStyle as mapContent, itemStyle as mapItem } from '~/core/styleMap'
import { motion } from '~/visual/motion'
import OverlayLayer from './OverlayLayer.vue'
import StageResizer from './StageResizer.vue'

const { state, selectItem } = useFlexState()
const { setHovered } = useOverlay()

const stageEl = ref<HTMLElement>()
useMeasure().observeStage(stageEl)
useFlip().observeFlip(stageEl)

const containerStyle = computed(() => mapContainer(state.container) as CSSProperties)

// CSS 读不到 TS 常量，下发成自定义属性才能保住 motion.ts 的唯一权威
const stageVars = computed<CSSProperties>(() => ({
  '--lift': `${motion.liftHeight}px`,
  '--lift-scale': `${motion.liftScale}`,
  '--lift-duration': `${motion.liftDuration}s`,
  '--d-hover-k': `${motion.blockDepthHover}`,
  '--d-active-k': `${motion.blockDepthActive}`,
  '--overhang': `${motion.stageOverhang}px`,
} as CSSProperties))

/**
 * 顶面吃行间距、右侧面吃列间距，厚度取两者较小值才不会压到邻居；留 2px 免得严丝合缝贴上去。
 */
const blockDepth = computed(() => {
  const gap = Math.min(state.container.rowGap, state.container.columnGap)

  return Math.max(motion.blockDepthMin, Math.min(motion.blockDepth, gap - 2))
})

const boxStyle = computed<CSSProperties>(() => ({
  '--d': `${blockDepth.value}px`,
} as CSSProperties))

function itemStyle(item: FlexItemState): CSSProperties {
  return mapItem(item, state.container.direction) as CSSProperties
}

function contentStyle(item: FlexItemState): CSSProperties {
  return mapContent(item, state.container.direction) as CSSProperties
}
</script>

<template>
  <div class="stage-wrapper relative w-fit" :style="stageVars">
    <div
      ref="stageEl"
      data-testid="stage"
      class="stage relative rounded-3"
      :style="containerStyle"
    >
      <div
        v-for="(item, index) in state.items"
        :key="item.id"
        data-testid="stage-item"
        :data-item-id="item.id"
        class="stage-item"
        :class="{ 'is-selected': state.selectedId === item.id }"
        tabindex="0"
        role="button"
        :aria-label="`盒子 ${itemLabel(index)}`"
        :aria-pressed="state.selectedId === item.id"
        :style="itemStyle(item)"
        @click="selectItem(item.id)"
        @keydown.enter="selectItem(item.id)"
        @keydown.space.prevent="selectItem(item.id)"
        @mouseenter="setHovered(item.id)"
        @mouseleave="setHovered(null)"
        @focus="setHovered(item.id)"
        @blur="setHovered(null)"
      >
        <!-- 外层是真 flex item，位移交给 Flip；内层只做形变。两边不抢同一个 transform -->
        <div class="stage-box" :style="boxStyle">
          <div class="content" :style="contentStyle(item)">
            {{ itemLabel(index) }}
          </div>
        </div>
      </div>
    </div>

    <OverlayLayer />
    <StageResizer />
  </div>
</template>

<style scoped>
.stage-wrapper {
  margin: var(--overhang);
}

.stage {
  font-size: 1rem;
  background: radial-gradient(
    120% 120% at 50% 0%,
    color-mix(in srgb, var(--accent) 7%, var(--panel)) 0%,
    var(--panel) 60%
  );
  outline: 1px solid color-mix(in srgb, var(--border) 90%, var(--accent));
  outline-offset: -1px;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    inset 0 0 40px color-mix(in srgb, var(--accent) 5%, transparent),
    0 24px 48px -24px color-mix(in srgb, var(--accent) 30%, transparent);
}

.stage-item {
  display: flex;

  z-index: 1;

  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.stage-box {
  display: flex;
  position: relative;
  flex: 1 1 auto;
  align-items: center;
  align-self: stretch;
  justify-content: center;

  --d-k: 1;
  --depth: calc(var(--d, 10px) * var(--d-k));

  --face: color-mix(in srgb, var(--accent) 34%, var(--panel));

  border-radius: 3px;
  outline: 1px solid color-mix(in srgb, var(--accent) var(--stage-line-k), transparent);
  outline-offset: -1px;

  background: linear-gradient(
    180deg,
    color-mix(in srgb, white 8%, var(--face)) 0%,
    color-mix(in srgb, black 6%, var(--face)) 100%
  );

  box-shadow:
    inset 0 -1px 0 color-mix(in srgb, black 45%, transparent),
    0 1px 1px color-mix(in srgb, black 34%, transparent),
    0 2px 2px color-mix(in srgb, black 26%, transparent),
    0 4px 4px color-mix(in srgb, black 20%, transparent),
    0 8px 8px color-mix(in srgb, black 14%, transparent),
    0 16px 16px color-mix(in srgb, black 10%, transparent);
  transition:
    outline-color var(--lift-duration, 0.28s) ease,
    background var(--lift-duration, 0.28s) ease,
    box-shadow var(--lift-duration, 0.28s) ease,
    translate var(--lift-duration, 0.28s) cubic-bezier(0.34, 1.56, 0.64, 1),
    scale var(--lift-duration, 0.28s) cubic-bezier(0.34, 1.56, 0.64, 1);
}

.stage-box::before,
.stage-box::after {
  content: '';
  position: absolute;
  transition:
    width var(--lift-duration, 0.28s) ease,
    height var(--lift-duration, 0.28s) ease,
    background var(--lift-duration, 0.28s) ease,
    transform var(--lift-duration, 0.28s) cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
}

.stage-box::before {
  top: 0;
  right: 0;
  left: 0;
  height: var(--depth);
  transform: translateY(calc(-1 * var(--depth))) skewX(-45deg);
  transform-origin: bottom left;
  background: color-mix(in srgb, white 45%, var(--face));
}

.stage-box::after {
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--depth);
  transform: translateX(var(--depth)) skewY(-45deg);
  transform-origin: top left;
  background: color-mix(in srgb, black 40%, var(--face));
}

.stage-item:hover .stage-box,
.stage-item:focus-visible .stage-box {
  --d-k: var(--d-hover-k, 1.3);

  translate: 0 calc(-1 * var(--lift, 6px));
  scale: var(--lift-scale, 1.03);
  outline-color: color-mix(in srgb, var(--accent) var(--stage-line-hover-k), transparent);
  box-shadow:
    0 2px 2px color-mix(in srgb, black 30%, transparent),
    0 4px 4px color-mix(in srgb, black 24%, transparent),
    0 8px 8px color-mix(in srgb, black 18%, transparent),
    0 16px 16px color-mix(in srgb, black 14%, transparent),
    0 32px 32px color-mix(in srgb, black 10%, transparent);
}

.stage-item:active .stage-box {
  --d-k: var(--d-active-k, 0.35);

  translate: 0 2px;
  scale: 1;
  box-shadow:
    0 1px 1px color-mix(in srgb, black 34%, transparent),
    0 2px 2px color-mix(in srgb, black 22%, transparent),
    0 4px 4px color-mix(in srgb, black 14%, transparent);
}

.stage-item.is-selected .stage-box {
  --face: color-mix(in srgb, var(--accent-2) 34%, var(--panel));

  outline-color: var(--accent-2);
}

.content {
  display: flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--fg) 88%, transparent);
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  letter-spacing: 0.04em;
  text-shadow: 0 1px 2px color-mix(in srgb, black 25%, transparent);
}
</style>
