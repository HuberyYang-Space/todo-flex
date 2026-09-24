<script setup lang="ts">
import type { AxisVector } from '~/core/axis'
import { axisVectors, isRowDirection } from '~/core/axis'
import { itemLabel } from '~/core/labels'
import { computeOverlay } from '~/core/overlay'

const { state, derived } = useFlexState()
const { measured } = useMeasure()
const { visible, hoveredId } = useOverlay()

const ARROW_ORIGIN = 16
const ARROW_LENGTH = 32

/** id 后缀与 OverlayBand.flowAxis / flow 对齐 */
const STRIPE_PATTERNS = [
  { axis: 'x', flow: 'forward' },
  { axis: 'x', flow: 'reverse' },
  { axis: 'y', flow: 'forward' },
  { axis: 'y', flow: 'reverse' },
] as const

const geometry = computed(() =>
  measured.value ? computeOverlay(state, derived.value, measured.value) : null,
)

const vectors = computed(() => axisVectors(state.container))

/** 反向的轴把起点挪到另一头，箭头才不会画出容器 */
function arrow(vector: AxisVector) {
  const x1 = ARROW_ORIGIN + (vector.dx < 0 ? ARROW_LENGTH : 0)
  const y1 = ARROW_ORIGIN + (vector.dy < 0 ? ARROW_LENGTH : 0)
  return { x1, y1, x2: x1 + vector.dx * ARROW_LENGTH, y2: y1 + vector.dy * ARROW_LENGTH }
}

// 色块放不下这行字就不画：文字溢出压到旁边盒子上，会让人误以为标的是那个盒子
const LABEL_FONT_SIZE = 11
const MIN_LABEL_HEIGHT = 18
const LABEL_PADDING = 8

/**
 * 等宽字体下 Latin-1 以内的字符约占 0.61 个字号，之外的占满一个字号。
 * 分界画在 U+00FF 而不是 U+007F：分隔点「·」是 U+00B7，看着像全角、实际按半角渲染。
 * happy-dom 不排版，这个估算没有自动化守卫，改动后要到浏览器里量。
 */
function estimateLabelWidth(text: string): number {
  let width = 0
  for (const char of text)
    width += (char.codePointAt(0) ?? 0) <= 0xFF ? LABEL_FONT_SIZE * 0.61 : LABEL_FONT_SIZE
  return width
}

/** 挂在这一行面积最大的那块色块上，字才有地方放 */
const lineLabels = computed(() => {
  const geo = geometry.value
  if (!geo)
    return []

  return geo.lines.flatMap((line) => {
    const bands = geo.bands.filter(band => band.lineIndex === line.index)
    if (bands.length === 0)
      return []

    const band = bands.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b))
    const text = `剩余 ${round(line.actual)} · 理论 ${line.theoretical === null ? '—' : round(line.theoretical)}`
    if (band.width < estimateLabelWidth(text) + LABEL_PADDING || band.height < MIN_LABEL_HEIGHT)
      return []

    return [{
      key: line.index,
      x: band.x + band.width / 2,
      y: band.y + band.height / 2,
      text,
      mismatch: line.theoretical !== null && Math.abs(line.theoretical - line.actual) > 0.5,
    }]
  })
})

const mainArrow = computed(() => arrow(vectors.value.main))
const crossArrow = computed(() => arrow(vectors.value.cross))

/** 悬停优先于选中 */
const hud = computed(() => {
  const id = hoveredId.value ?? state.selectedId
  const record = measured.value?.items.find(item => item.id === id)
  if (!id || !record)
    return null

  const index = state.items.findIndex(item => item.id === id)
  const theoretical = derived.value.items.find(item => item.id === id)?.finalMainSize ?? null
  const actualMain = isRowDirection(state.container.direction) ? record.width : record.height

  return {
    label: itemLabel(index),
    text: `${round(record.width)} × ${round(record.height)}`,
    theoretical: theoretical === null ? '—' : round(theoretical),
    mismatch: theoretical !== null && Math.abs(theoretical - actualMain) > 0.5,
    x: record.left,
    // 盒子贴着容器顶时翻到盒子内侧，免得被裁掉
    y: record.top < 20 ? record.top + 16 : record.top - 6,
  }
})

function round(value: number): number {
  return Math.round(value * 10) / 10
}
</script>

<template>
  <!-- 色块沉到盒子下面，HUD 单独一层浮在上面：跟着沉下去会被它要标注的盒子挡住 -->
  <template v-if="visible && measured && geometry">
    <svg
      data-testid="overlay"
      class="overlay overlay--under"
      :width="measured.width"
      :height="measured.height"
      :viewBox="`0 0 ${measured.width} ${measured.height}`"
    >
      <defs>
        <!-- 三条线是为了平移无缝：走完一个 8px 周期时，邻位那条正好补上离场那条 -->
        <pattern
          v-for="stripe in STRIPE_PATTERNS"
          :id="`overlay-stripes-${stripe.axis}-${stripe.flow}`"
          :key="`${stripe.axis}-${stripe.flow}`"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          :patternTransform="stripe.axis === 'y' ? 'rotate(90)' : undefined"
        >
          <rect width="8" height="8" fill="var(--accent)" fill-opacity="0.08" />
          <g class="stripe-flow" :class="`stripe-flow--${stripe.flow}`">
            <line
              v-for="x in [-8, 0, 8]"
              :key="x"
              :x1="x"
              y1="0"
              :x2="x"
              y2="8"
              stroke="var(--accent)"
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

      <rect
        v-for="(band, index) in geometry.bands"
        :key="`${band.lineIndex}-${index}`"
        data-testid="overlay-band"
        :data-kind="band.kind"
        :x="band.x"
        :y="band.y"
        :width="band.width"
        :height="band.height"
        :class="band.kind === 'free' ? ['band-free', `band-free--${band.flowAxis ?? 'x'}-${band.flow ?? 'forward'}`] : 'band-overflow'"
      />

      <text
        v-for="label in lineLabels"
        :key="label.key"
        data-testid="overlay-line-label"
        class="line-label"
        :class="{ mismatch: label.mismatch }"
        :x="label.x"
        :y="label.y"
        :font-size="LABEL_FONT_SIZE"
      >{{ label.text }}</text>

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

    </svg>

    <svg
      v-if="hud"
      data-testid="overlay-hud-layer"
      class="overlay overlay--over"
      :width="measured.width"
      :height="measured.height"
      :viewBox="`0 0 ${measured.width} ${measured.height}`"
    >
      <g data-testid="overlay-hud" class="hud">
        <text :x="hud.x + 4" :y="hud.y" :class="{ mismatch: hud.mismatch }">
          {{ hud.label }} {{ hud.text }} · 理论 {{ hud.theoretical }}
        </text>
      </g>
    </svg>
  </template>
</template>

<style scoped>
.overlay {
  position: absolute;
  top: 0;
  left: 0;

  overflow: visible;
  pointer-events: none;
}

.overlay--under {
  z-index: 0;
}

.overlay--over {
  z-index: 2;
}

.band-free--x-forward {
  fill: url(#overlay-stripes-x-forward);
}

.band-free--x-reverse {
  fill: url(#overlay-stripes-x-reverse);
}

.band-free--y-forward {
  fill: url(#overlay-stripes-y-forward);
}

.band-free--y-reverse {
  fill: url(#overlay-stripes-y-reverse);
}

.stripe-flow {
  animation: stripe-flow 2.4s linear infinite;
}

.stripe-flow line {
  stroke-opacity: var(--stripe-op);
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

.line-label {
  fill: color-mix(in srgb, var(--fg) 75%, transparent);
  font-family: var(--font-mono, monospace);
  paint-order: stroke;
  stroke: var(--panel);
  stroke-width: 3px;
  stroke-linejoin: round;
  text-anchor: middle;
  dominant-baseline: middle;
}

.line-label.mismatch {
  fill: var(--accent-2);
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
