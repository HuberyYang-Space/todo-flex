<script setup lang="ts">
import type { AxisVector } from '~/core/axis'
import { computed } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { useMeasure } from '~/composables/useMeasure'
import { useOverlay } from '~/composables/useOverlay'
import { axisVectors, isRowDirection } from '~/core/axis'
import { itemLabel } from '~/core/labels'
import { computeOverlay } from '~/core/overlay'

const { state, derived } = useFlexState()
const { measured } = useMeasure()
const { visible, hoveredId } = useOverlay()

/** 箭头画在容器左上角，长度固定，不随容器缩放 */
const ARROW_ORIGIN = 16
const ARROW_LENGTH = 32

/** 斜纹 pattern 按流向各生成一份，id 后缀与 OverlayBand.flow 对齐 */
const FLOWS = ['forward', 'reverse'] as const

const geometry = computed(() =>
  measured.value ? computeOverlay(state, derived.value, measured.value) : null,
)

const vectors = computed(() => axisVectors(state.container))

/** 反向的轴要把起点挪到另一头，箭头才不会画到容器外面去 */
function arrow(vector: AxisVector) {
  const x1 = ARROW_ORIGIN + (vector.dx < 0 ? ARROW_LENGTH : 0)
  const y1 = ARROW_ORIGIN + (vector.dy < 0 ? ARROW_LENGTH : 0)
  return { x1, y1, x2: x1 + vector.dx * ARROW_LENGTH, y2: y1 + vector.dy * ARROW_LENGTH }
}

const mainArrow = computed(() => arrow(vectors.value.main))
const crossArrow = computed(() => arrow(vectors.value.cross))

/** 悬停优先于选中：鼠标正指着谁，就先说谁 */
const hud = computed(() => {
  const id = hoveredId.value ?? state.selectedId
  const record = measured.value?.items.find(item => item.id === id)
  if (!id || !record)
    return null

  const index = state.items.findIndex(item => item.id === id)
  const theoretical = derived.value.items.find(item => item.id === id)?.finalMainSize ?? 0
  const actualMain = isRowDirection(state.container.direction) ? record.width : record.height

  return {
    label: itemLabel(index),
    text: `${round(record.width)} × ${round(record.height)}`,
    theoretical: round(theoretical),
    // 与明细表同一个判据：差得过半个像素才算有规则介入
    mismatch: Math.abs(theoretical - actualMain) > 0.5,
    x: record.left,
    // 盒子贴着容器顶时，HUD 翻到盒子内侧，免得被容器边裁掉
    y: record.top < 20 ? record.top + 16 : record.top - 6,
  }
})

function round(value: number): number {
  return Math.round(value * 10) / 10
}
</script>

<template>
  <svg
    v-if="visible && measured && geometry"
    data-testid="overlay"
    class="overlay"
    :width="measured.width"
    :height="measured.height"
    :viewBox="`0 0 ${measured.width} ${measured.height}`"
  >
    <defs>
      <!--
        剩余空间用斜纹填充：与实心色块拉开区别，一眼看出「这里没有盒子」。
        两个方向各一份，斜纹朝「这块空间一旦被分配会流向谁」的方向动。
        三条线是为了平移时无缝：走完一个周期（8px）时，邻位那条正好补上离场那条的位置。
      -->
      <pattern
        v-for="flow in FLOWS"
        :id="`overlay-stripes-${flow}`"
        :key="flow"
        width="8"
        height="8"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="8" height="8" fill="var(--accent)" fill-opacity="0.08" />
        <g class="stripe-flow" :class="`stripe-flow--${flow}`">
          <line
            v-for="x in [-8, 0, 8]"
            :key="x"
            :x1="x"
            y1="0"
            :x2="x"
            y2="8"
            stroke="var(--accent)"
            stroke-opacity="0.35"
            stroke-width="3"
          />
        </g>
      </pattern>
      <marker
        id="overlay-arrow-main"
        viewBox="0 0 8 8"
        refX="7"
        refY="4"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)" />
      </marker>
      <marker
        id="overlay-arrow-cross"
        viewBox="0 0 8 8"
        refX="7"
        refY="4"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent-2)" />
      </marker>
    </defs>

    <!-- 剩余空间与溢出 -->
    <rect
      v-for="(band, index) in geometry.bands"
      :key="`${band.lineIndex}-${index}`"
      data-testid="overlay-band"
      :data-kind="band.kind"
      :x="band.x"
      :y="band.y"
      :width="band.width"
      :height="band.height"
      :class="band.kind === 'free' ? ['band-free', `band-free--${band.flow ?? 'forward'}`] : 'band-overflow'"
    />

    <!-- 轴向箭头 -->
    <g class="axis">
      <line
        data-testid="overlay-axis-main"
        v-bind="mainArrow"
        stroke="var(--accent)"
        stroke-width="2"
        marker-end="url(#overlay-arrow-main)"
      />
      <line
        data-testid="overlay-axis-cross"
        v-bind="crossArrow"
        stroke="var(--accent-2)"
        stroke-width="2"
        stroke-dasharray="4 3"
        marker-end="url(#overlay-arrow-cross)"
      />
    </g>

    <!-- 尺寸 HUD -->
    <g v-if="hud" data-testid="overlay-hud" class="hud">
      <text :x="hud.x + 4" :y="hud.y" :class="{ mismatch: hud.mismatch }">
        {{ hud.label }} {{ hud.text }} · 理论 {{ hud.theoretical }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.overlay {
  position: absolute;
  top: 0;
  left: 0;

  /*
   * 两条都不能少：
   * pointer-events 不关掉，叠加层会把盒子的点击全吃掉；
   * SVG 根元素默认 overflow: hidden，溢出标记画在容器外会被裁掉。
   */
  overflow: visible;
  pointer-events: none;
}

.band-free--forward {
  fill: url(#overlay-stripes-forward);
}

.band-free--reverse {
  fill: url(#overlay-stripes-reverse);
}

/*
 * 平移一个完整周期（8px）就回到同一个相位，循环起来看不出接缝。
 *
 * 只做一个方向的位移就够了：45° 斜纹只能表达垂直于自身的运动分量（理发店转灯错觉），
 * 「向右」与「向下」在这条斜纹上本来就是同一个平移。方向感由色块自己的长宽比给出——
 * row 布局下色块宽扁，读作横向流；column 下高瘦，读作纵向流。所以两份 pattern 足够，不必做四份。
 */
.stripe-flow {
  animation: stripe-flow 2.4s linear infinite;
}

.stripe-flow--reverse {
  animation-direction: reverse;
}

@keyframes stripe-flow {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(8px);
  }
}

/*
 * main.css 的通配兜底已经能把它按住，这里再显式关一次：
 * 这是全站唯一一个无限循环的装饰动画，不该只靠一条 `*` 规则活着。
 */
@media (prefers-reduced-motion: reduce) {
  .stripe-flow {
    animation: none;
  }
}

.band-overflow {
  fill: color-mix(in srgb, var(--accent-2) 22%, transparent);
  stroke: var(--accent-2);
  stroke-dasharray: 4 3;
  stroke-width: 1;
}

.hud text {
  fill: var(--fg);
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  paint-order: stroke;
  stroke: var(--panel);
  stroke-width: 3px;
  stroke-linejoin: round;
}

.hud text.mismatch {
  fill: var(--accent-2);
}
</style>
