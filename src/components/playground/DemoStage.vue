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

// 演示区是全站唯一的真实布局来源，挂上观测层供明细表读取实际尺寸
const stageEl = ref<HTMLElement>()
useMeasure().observeStage(stageEl)
useFlip().observeFlip(stageEl)

/*
 * 状态 → CSS 的映射统一在 core/styleMap，与陷阱区的 TrapStage 共用同一份。
 * 容器样式全部来自状态，交给浏览器真实排版——不做任何位置计算（红线 1）。
 * 这里只做一层取值 + 类型收口：core 不 import vue，返回的是自己的 StyleDecls（红线 2）。
 */
const containerStyle = computed(() => mapContainer(state.container) as CSSProperties)

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

/*
 * 内层：看得见的那块实体。形变与质感都在这里，位移由外层的 Flip 负责。
 *
 * 这是「等距实体块」：顶面与右侧面是两个伪元素画的二维平行四边形（见下方注释），
 * 正面就是 .stage-box 本身。三个面共用左上光源——顶面最亮、正面居中、右侧面最暗。
 * 圆角必须小（3px）：平行四边形的面接不上大圆角，会在拐角处露出缺口。
 * 渐变、box-shadow 与绝对定位的伪元素都不占布局空间，红线 6 不受影响。
 */
.stage-box {
  display: flex;
  position: relative;
  flex: 1 1 auto;
  align-items: center;
  align-self: stretch;
  justify-content: center;

  /*
   * 实际厚度 = 组件下发的 --d 乘以状态倍率。
   * 用乘不用加：gap 收窄时 --d 已经只剩 3px，悬停再加固定值会直接顶到邻居。
   */
  --d-k: 1;
  --depth: calc(var(--d, 10px) * var(--d-k));

  /*
   * 块体的体色。顶面与右侧面都从它派生（加白 / 加黑），而不是各自去跟 accent 调色——
   * 后者的明暗序会随主题翻车：亮色主题下 --panel 本身接近白，正面被它拉亮到 0.79，
   * 反而比「accent 混 white」的顶面（0.67）还亮，左上光源就读不出来了。
   * 从同一个体色加白/加黑，两个主题下顺序都必然成立。
   */
  --face: color-mix(in srgb, var(--accent) 34%, var(--panel));

  border-radius: 3px;
  outline: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: -1px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--accent) 40%, var(--panel)) 0%,
    color-mix(in srgb, var(--accent) 28%, var(--panel)) 100%
  );

  /*
   * 接触阴影 + 分层投影。第一层又紧又暗的那道才是接触阴影，
   * 物体贴不贴地全看它；后面几层模糊值倍增（1→2→4→8→16），模拟环境光的衰减。
   * 只用一层大模糊阴影的话，读起来是「物体的模糊剪影」而不是「落在台面上的影子」。
   */
  box-shadow:
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

/*
 * 顶面与右侧面是二维平行四边形，不是用 rotateX 旋进屏幕的立体面——
 * 后者垂直于视线，投影高度只剩「厚度 × sin(倾角)」，小倾角下根本读不出体积，
 * 这正是上一轮 3D 方案失败的直接原因，不要退回去。
 *
 * 两个面各自 skew 45°，在方块右上角咬合成一个封闭的块体轮廓。
 * 伪元素绝对定位、不参与布局，也不接收指针事件，所以既不碰红线 6，也不挡点击。
 */
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

/* 顶面：向上挪一个厚度，再 skew 成平行四边形。受光最足，往白里调 */
.stage-box::before {
  top: 0;
  right: 0;
  left: 0;
  height: var(--depth);
  transform: translateY(calc(-1 * var(--depth))) skewX(-45deg);
  transform-origin: bottom left;
  background: color-mix(in srgb, white 45%, var(--face));
}

/* 右侧面：向右挪一个厚度，skew 方向与顶面在右上角咬合。背光，往黑里调 */
.stage-box::after {
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--depth);
  transform: translateX(var(--depth)) skewY(-45deg);
  transform-origin: top left;
  background: color-mix(in srgb, black 40%, var(--face));
}

/*
 * 悬停与选中用独立的 translate / scale 属性，不用 transform——
 * 挤压拉伸的动画写在 transform 上，两者分开才不会互相覆盖。
 */
/* 悬停：块体被抬起来，厚度随之加大、接触阴影拉开变虚 */
.stage-item:hover .stage-box,
.stage-item:focus-visible .stage-box {
  --d-k: var(--d-hover-k, 1.3);

  translate: 0 calc(-1 * var(--lift, 6px));
  scale: var(--lift-scale, 1.03);
  outline-color: color-mix(in srgb, var(--accent) 85%, transparent);
  box-shadow:
    0 2px 2px color-mix(in srgb, black 30%, transparent),
    0 4px 4px color-mix(in srgb, black 24%, transparent),
    0 8px 8px color-mix(in srgb, black 18%, transparent),
    0 16px 16px color-mix(in srgb, black 14%, transparent),
    0 32px 32px color-mix(in srgb, black 10%, transparent);
}

/* 按下：块体被压回台面，厚度几乎收没，接触阴影收紧 */
.stage-item:active .stage-box {
  --d-k: var(--d-active-k, 0.35);

  translate: 0 2px;
  scale: 1;
  box-shadow:
    0 1px 1px color-mix(in srgb, black 34%, transparent),
    0 2px 2px color-mix(in srgb, black 22%, transparent),
    0 4px 4px color-mix(in srgb, black 14%, transparent);
}

/* 选中：只换体色，顶面与右侧面从 --face 派生，明暗关系自动保持一致 */
.stage-item.is-selected .stage-box {
  --face: color-mix(in srgb, var(--accent-2) 34%, var(--panel));

  outline-color: var(--accent-2);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--accent-2) 40%, var(--panel)) 0%,
    color-mix(in srgb, var(--accent-2) 28%, var(--panel)) 100%
  );
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
