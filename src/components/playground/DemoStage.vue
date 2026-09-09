<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { FlexItemState } from '~/core/types'
import { computed, ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { useMeasure } from '~/composables/useMeasure'
import { useOverlay } from '~/composables/useOverlay'
import { isRowDirection } from '~/core/axis'
import { itemLabel } from '~/core/labels'
import OverlayLayer from './OverlayLayer.vue'
import StageResizer from './StageResizer.vue'

const { state, selectItem } = useFlexState()
const { setHovered } = useOverlay()

// 演示区是全站唯一的真实布局来源，挂上观测层供明细表读取实际尺寸
const stageEl = ref<HTMLElement>()
useMeasure().observeStage(stageEl)

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
  <!--
    wrapper 存在的唯一理由：.stage 是真实 flex 容器，
    任何塞进去的子元素都会变成第 N+1 个 flex item 污染演示，
    所以叠加层只能作为兄弟节点绝对定位盖上去。
  -->
  <div class="stage-wrapper relative w-fit">
    <div
      ref="stageEl"
      data-testid="stage"
      class="stage relative overflow-hidden rounded-2 bg-panel"
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
.stage {
  outline: 1px solid var(--border);
  outline-offset: -1px;
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
  transition:
    outline-color 0.2s ease,
    box-shadow 0.2s ease;
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
