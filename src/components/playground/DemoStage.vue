<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { FlexItemState } from '~/core/types'
import { computed, ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { useFlip } from '~/composables/useFlip'
import { useMeasure } from '~/composables/useMeasure'
import { useOverlay } from '~/composables/useOverlay'
import { useStageView } from '~/composables/useStageView'
import { isRowDirection, mainAxisSize } from '~/core/axis'
import { computeDepths } from '~/core/depth'
import { itemLabel } from '~/core/labels'
import { motion } from '~/visual/motion'
import OverlayLayer from './OverlayLayer.vue'
import StageResizer from './StageResizer.vue'

const { state, derived, selectItem } = useFlexState()
const { setHovered } = useOverlay()
const { is3D } = useStageView()

// 演示区是全站唯一的真实布局来源，挂上观测层供明细表读取实际尺寸
const stageEl = ref<HTMLElement>()
useMeasure().observeStage(stageEl)
useFlip().observeFlip(stageEl)

const isRow = computed(() => isRowDirection(state.container.direction))

// 容器样式全部来自状态，交给浏览器真实排版——不做任何位置计算
const containerStyle = computed<CSSProperties>(() => ({
  display: state.container.display,
  flexDirection: state.container.direction,
  flexWrap: state.container.wrap,
  justifyContent: state.container.justifyContent,
  alignItems: state.container.alignItems,
  alignContent: state.container.alignContent,
  rowGap: `${state.container.rowGap}px`,
  columnGap: `${state.container.columnGap}px`,
  width: `${state.container.width}px`,
  height: `${state.container.height}px`,
}))

// 厚度按容器主轴尺寸归一化，再乘以视觉上限换算成像素
const depths = computed(() => computeDepths(derived.value, mainAxisSize(state.container)))

const sceneStyle = computed<CSSProperties>(() => ({
  'perspective': `${motion.perspective}px`,
  'transform': `rotateX(${is3D.value ? motion.tiltDeg : 0}deg)`,
  // 抬起的高度与时长下发给 CSS——CSS 读不到 TS 常量，只能这样保住 motion.ts 的唯一权威
  '--lift': `${motion.liftHeight}px`,
  '--lift-duration': `${motion.liftDuration}s`,
} as CSSProperties))

/**
 * 厚度写成两个变量：--elev 带符号（凹陷时为负），--thickness 取绝对值。
 * 面的高度不能为负，而 CSS 的 abs() 支持度还不稳，与其赌它不如在这里算好两份。
 */
function depthStyle(item: FlexItemState): CSSProperties {
  const depth = is3D.value ? (depths.value.get(item.id) ?? 0) : 0
  const elevation = Math.round(depth * motion.maxDepth * 10) / 10

  return {
    '--elev': `${elevation}px`,
    '--thickness': `${Math.abs(elevation)}px`,
  } as CSSProperties
}

function itemStyle(item: FlexItemState): CSSProperties {
  return {
    flexGrow: item.grow,
    flexShrink: item.shrink,
    flexBasis: item.basis,
    order: item.order,
    alignSelf: item.alignSelf,
    // 关掉自动最小尺寸时，要关的是主轴方向上的那一个
    ...(item.minWidthAuto ? {} : { [isRow.value ? 'minWidth' : 'minHeight']: '0px' }),
    ...(item.marginAuto ? { margin: 'auto' } : {}),
    ...depthStyle(item),
  }
}

// 内容占位块撑出 min-content 尺寸，这样 min-width:auto 的下限才有真实来源
function contentStyle(item: FlexItemState): CSSProperties {
  return isRow.value ? { width: `${item.size}px` } : { height: `${item.size}px` }
}
</script>

<template>
  <!--
    wrapper 存在的唯一理由：.stage 是真实 flex 容器，
    任何塞进去的子元素都会变成第 N+1 个 flex item 污染演示，
    所以叠加层只能作为兄弟节点绝对定位盖上去。
  -->
  <div class="stage-wrapper relative w-fit">
    <div data-testid="scene" class="scene" :style="sceneStyle">
      <div
        ref="stageEl"
        data-testid="stage"
        class="stage relative rounded-2 bg-panel"
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
          :style="itemStyle(item)"
          @click="selectItem(item.id)"
          @keydown.enter="selectItem(item.id)"
          @mouseenter="setHovered(item.id)"
          @mouseleave="setHovered(null)"
          @focus="setHovered(item.id)"
          @blur="setHovered(null)"
        >
          <div class="content" :style="contentStyle(item)">
            {{ itemLabel(index) }}
          </div>
        </div>
      </div>

      <OverlayLayer />
      <StageResizer />
    </div>
  </div>
</template>

<style scoped>
/*
 * 演示区的描边一律用 outline，绝不用 border。
 *
 * border 会占据布局空间：容器少 2px 可用宽度、每个盒子实际尺寸比推导值多 2px，
 * 诊断层会把这个恒定偏差误报成「有规则介入」。而 emitCss 输出的 CSS 里并没有 border，
 * 演示区一旦加了输出 CSS 之外的布局影响，「复制这段 CSS 即可复现」就不成立了。
 * 同理：这两个选择器都不得添加 padding。
 */
.scene {
  transform-style: preserve-3d;
  transition: transform 0.4s ease;
}

.stage {
  outline: 1px solid var(--border);
  outline-offset: -1px;

  /*
   * 绝不能加 overflow: hidden。
   * CSS Transforms 规范里 overflow 非 visible 是 grouping property，会把本元素的
   * transform-style 强制变成 flat——.scene 的 perspective 就传不到方块上，
   * 方块会各自为政、没有共同灭点，3D 直接塌掉。
   * 顺带一提，裁掉溢出本来也与红线 7 的意图相悖：盒子被压得比内容还窄时，
   * 内容溢出正是要给用户看的现象。
   */
}

.stage-item {
  display: flex;
  align-items: center;
  justify-content: center;

  /*
   * 绝不能加 overflow: hidden。
   * CSS 规范规定「自动最小尺寸」只在主轴 overflow 为 visible 时生效，
   * 一旦裁剪，min-width:auto 立即失效——本站的头号陷阱就演示不出来了。
   * 盒子被压到比内容还窄时，内容溢出正是要给用户看的现象。
   */
  cursor: pointer;
  border-radius: 6px;
  outline: 1px solid var(--accent);
  outline-offset: -1px;
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);

  /* 厚度由 --elev 抬起，立体面挂在伪元素上 */
  transform-style: preserve-3d;
  transform: translateZ(var(--elev, 0px));
  transition:
    outline-color 0.2s ease,
    box-shadow 0.2s ease,
    transform var(--lift-duration, 0.2s) ease;
}

/*
 * 明暗一律加在面（伪元素）上，绝不能加在 .stage-item 自己身上——
 * filter 与 opacity < 1 同样是 grouping property，会把它的立体面压平。
 */

/* 顶面：从盒子上沿向后翻起，进深等于厚度 */
.stage-item::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: var(--thickness, 0);
  transform-origin: top;
  transform: rotateX(90deg);
  border-radius: 6px 6px 0 0;
  background-color: color-mix(in srgb, var(--accent) 26%, var(--panel));
  filter: brightness(1.18);
}

/* 侧面：从盒子右沿向后翻起 */
.stage-item::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--thickness, 0);
  transform-origin: right;
  transform: rotateY(90deg);
  border-radius: 0 6px 6px 0;
  background-color: color-mix(in srgb, var(--accent) 26%, var(--panel));
  filter: brightness(0.7);
}

/* 悬停与选中时整块抬起并投下阴影 */
.stage-item:hover,
.stage-item.is-selected {
  transform: translateZ(calc(var(--elev, 0px) + var(--lift, 18px)));
  box-shadow: 0 18px 28px -12px color-mix(in srgb, var(--accent) 55%, transparent);
}

.stage-item:focus-visible,
.stage-item.is-selected {
  outline-color: var(--accent-2);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-2) 45%, transparent);
}

.content {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono, monospace);
}
</style>
