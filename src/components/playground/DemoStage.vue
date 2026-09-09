<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { FlexItemState } from '~/core/types'
import { computed, ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { useFlip } from '~/composables/useFlip'
import { useMeasure } from '~/composables/useMeasure'
import { useOverlay } from '~/composables/useOverlay'
import { isRowDirection } from '~/core/axis'
import { itemLabel } from '~/core/labels'
import { motion } from '~/visual/motion'
import OverlayLayer from './OverlayLayer.vue'
import StageResizer from './StageResizer.vue'

const { state, selectItem } = useFlexState()
const { setHovered } = useOverlay()

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

// 悬停手感的参数下发给 CSS——CSS 读不到 TS 常量，只能这样保住 motion.ts 的唯一权威
const stageVars = computed<CSSProperties>(() => ({
  '--lift': `${motion.liftHeight}px`,
  '--lift-scale': `${motion.liftScale}`,
  '--lift-duration': `${motion.liftDuration}s`,
  '--d-hover-k': `${motion.blockDepthHover}`,
  '--d-active-k': `${motion.blockDepthActive}`,
} as CSSProperties))

/**
 * 顶面往上伸、右侧面往右伸，各占一个厚度。间距不够时必须收，
 * 否则相邻方块的面会压在一起——两个方向的间距都要看：
 * 顶面吃的是行间距，右侧面吃的是列间距，取更小的那一个才两边都安全。
 * 留 2px 余量，免得面和邻居严丝合缝地贴上去。
 */
const blockDepth = computed(() => {
  const gap = Math.min(state.container.rowGap, state.container.columnGap)

  return Math.max(motion.blockDepthMin, Math.min(motion.blockDepth, gap - 2))
})

// 厚度写在 .stage-box 上而不是靠继承：伪元素要拿它算面的尺寸，就近给最不容易出错
const boxStyle = computed<CSSProperties>(() => ({
  '--d': `${blockDepth.value}px`,
} as CSSProperties))

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
  }
}

// 内容占位块撑出 min-content 尺寸，这样 min-width:auto 的下限才有真实来源
function contentStyle(item: FlexItemState): CSSProperties {
  return isRow.value ? { width: `${item.size}px` } : { height: `${item.size}px` }
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
        :style="itemStyle(item)"
        @click="selectItem(item.id)"
        @keydown.enter="selectItem(item.id)"
        @mouseenter="setHovered(item.id)"
        @mouseleave="setHovered(null)"
        @focus="setHovered(item.id)"
        @blur="setHovered(null)"
      >
        <!--
          内外两层各司其职：外层是真 flex item，位移交给 GSAP Flip；
          内层只做形变（挤压拉伸、悬停放大）。两边不抢同一个 transform，
          水滴那股弹性才不会被位移动画覆盖掉。
        -->
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
/*
 * 演示区的描边一律用 outline，绝不用 border。
 *
 * border 会占据布局空间：容器少 2px 可用宽度、每个盒子实际尺寸比推导值多 2px，
 * 诊断层会把这个恒定偏差误报成「有规则介入」。而 emitCss 输出的 CSS 里并没有 border，
 * 演示区一旦加了输出 CSS 之外的布局影响，「复制这段 CSS 即可复现」就不成立了。
 * 同理：这两个选择器都不得添加 padding。
 *
 * box-shadow 不占布局空间，所以质感全靠它和渐变来做。
 */
.stage {
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

  /*
   * 绝不能加 overflow: hidden。
   * CSS 规范规定「自动最小尺寸」只在主轴 overflow 为 visible 时生效，
   * 一旦裁剪，min-width:auto 立即失效——本站的头号陷阱就演示不出来了。
   * 盒子被压到比内容还窄时，内容溢出正是要给用户看的现象。
   */
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* 内层：看得见的那块板子。形变与质感都在这里，位移由外层的 Flip 负责 */
/*
 * 内层：看得见的那块板子。形变与质感都在这里，位移由外层的 Flip 负责。
 *
 * 立体感全靠光影，不用 3D 变换——一块实心材料在顶光下的样子：
 * 顶面受光最亮、体色向下渐暗、底部有一圈硬边当作块体的侧壁、
 * 侧壁之下再落一层柔和投影。四层叠起来眼睛就会读成「有厚度的东西」。
 * box-shadow 与渐变都不占布局空间，红线 6 不受影响。
 */
.stage-box {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  align-self: stretch;
  justify-content: center;

  /* 块体的侧壁厚度，悬停/按下时会变，做出被抬起与被压下的手感 */
  --edge: 7px;

  border-radius: 12px;
  outline: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
  outline-offset: -1px;
  background:
    /* 左上角的高光斑，给平面一点球面感 */
    radial-gradient(120% 80% at 18% 8%, color-mix(in srgb, white 22%, transparent) 0%, transparent 55%),
    /* 体色：顶面受光最亮，向下逐渐沉入暗部 */
    linear-gradient(
        180deg,
        color-mix(in srgb, var(--accent) 62%, var(--panel)) 0%,
        color-mix(in srgb, var(--accent) 34%, var(--panel)) 38%,
        color-mix(in srgb, var(--accent) 16%, var(--panel)) 82%,
        color-mix(in srgb, var(--accent) 24%, black) 100%
      );
  box-shadow:
    /* 顶面高光：一条亮线加一层向下弥散的光 */
    inset 0 1px 0 color-mix(in srgb, white 45%, transparent),
    inset 0 6px 12px -8px color-mix(in srgb, white 35%, transparent),
    /* 底部内收的暗部，让体色在接近侧壁处沉下去 */ inset 0 -8px 14px -8px color-mix(in srgb, black 45%, transparent),
    /* 侧壁：实心硬边，这一层是「厚度」的主要来源 */ 0 var(--edge) 0 -1px color-mix(in srgb, var(--accent) 22%, black),
    /* 落在台面上的投影 */ 0 calc(var(--edge) + 6px) 16px -6px color-mix(in srgb, black 55%, transparent);
  transition:
    outline-color var(--lift-duration, 0.28s) ease,
    box-shadow var(--lift-duration, 0.28s) ease,
    translate var(--lift-duration, 0.28s) cubic-bezier(0.34, 1.56, 0.64, 1),
    scale var(--lift-duration, 0.28s) cubic-bezier(0.34, 1.56, 0.64, 1);
}

/*
 * 悬停与选中用独立的 translate / scale 属性，不用 transform——
 * 挤压拉伸的动画写在 transform 上，两者分开才不会互相覆盖。
 */
/* 悬停：块体被抬起来，侧壁随之变厚、投影拉远变虚 */
.stage-item:hover .stage-box,
.stage-item:focus-visible .stage-box {
  --edge: 11px;

  translate: 0 calc(-1 * var(--lift, 6px));
  scale: var(--lift-scale, 1.03);
  outline-color: color-mix(in srgb, var(--accent) 85%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 55%, transparent),
    inset 0 6px 12px -8px color-mix(in srgb, white 45%, transparent),
    inset 0 -8px 14px -8px color-mix(in srgb, black 45%, transparent),
    0 var(--edge) 0 -1px color-mix(in srgb, var(--accent) 22%, black),
    0 calc(var(--edge) + 12px) 26px -6px color-mix(in srgb, black 60%, transparent);
}

/* 按下：块体被压到台面上，侧壁几乎消失 */
.stage-item:active .stage-box {
  --edge: 2px;

  translate: 0 2px;
  scale: 1;
}

.stage-item.is-selected .stage-box {
  outline-color: var(--accent-2);
  background:
    radial-gradient(120% 80% at 18% 8%, color-mix(in srgb, white 26%, transparent) 0%, transparent 55%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--accent-2) 62%, var(--panel)) 0%,
      color-mix(in srgb, var(--accent-2) 34%, var(--panel)) 38%,
      color-mix(in srgb, var(--accent-2) 16%, var(--panel)) 82%,
      color-mix(in srgb, var(--accent-2) 24%, black) 100%
    );
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 50%, transparent),
    inset 0 6px 12px -8px color-mix(in srgb, white 40%, transparent),
    inset 0 -8px 14px -8px color-mix(in srgb, black 45%, transparent),
    0 var(--edge) 0 -1px color-mix(in srgb, var(--accent-2) 22%, black),
    0 calc(var(--edge) + 10px) 22px -6px color-mix(in srgb, var(--accent-2) 45%, transparent);
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
