<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { FlexItemState } from '~/core/types'
import { computed } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { isRowDirection } from '~/core/axis'

const { state, selectItem } = useFlexState()

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

function label(index: number): string {
  return String.fromCharCode(65 + index)
}
</script>

<template>
  <div
    data-testid="stage"
    class="relative overflow-hidden panel"
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
    >
      <div class="content" :style="contentStyle(item)">
        {{ label(index) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-item {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.stage-item:focus-visible,
.stage-item.is-selected {
  border-color: var(--accent-2);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-2) 45%, transparent);
  outline: none;
}

.content {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono, monospace);
}
</style>
