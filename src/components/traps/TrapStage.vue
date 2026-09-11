<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { FlexItemState, FlexState } from '~/core/types'
import { computed } from 'vue'
import { isRowDirection } from '~/core/axis'
import { itemLabel } from '~/core/labels'

/**
 * 陷阱专用的精简演示区。
 *
 * 与 DemoStage 的分工：那边是全站唯一的真实布局来源，挂着观测层、Flip 与叠加层，
 * 三者都是单例语义，多开实例必然互相覆盖。这边只管把一份给定的状态排出来给人看，
 * 所以一个都不挂——陷阱区要的是「现象」，不是可被测量的实况。
 *
 * 红线 1 照旧成立：容器样式全部来自状态，位置一律交给浏览器真实排版。
 */
const props = defineProps<{ state: FlexState }>()

const isRow = computed(() => isRowDirection(props.state.container.direction))

const containerStyle = computed<CSSProperties>(() => ({
  display: props.state.container.display,
  flexDirection: props.state.container.direction,
  flexWrap: props.state.container.wrap,
  justifyContent: props.state.container.justifyContent,
  alignItems: props.state.container.alignItems,
  alignContent: props.state.container.alignContent,
  rowGap: `${props.state.container.rowGap}px`,
  columnGap: `${props.state.container.columnGap}px`,
  width: `${props.state.container.width}px`,
  height: `${props.state.container.height}px`,
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
  <!-- 溢出是陷阱一与陷阱三要给人看的现象，所以外层滚动、内层绝不裁剪 -->
  <div class="max-w-full overflow-auto">
    <div
      data-testid="trap-stage"
      class="trap-stage rounded-3"
      :style="containerStyle"
    >
      <div
        v-for="(item, index) in props.state.items"
        :key="item.id"
        data-testid="trap-stage-item"
        :data-item-id="item.id"
        class="trap-stage-item"
        :style="itemStyle(item)"
      >
        <div class="trap-content" :style="contentStyle(item)">
          {{ itemLabel(index) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * 描边一律用 outline，绝不用 border，也不加 padding——两者都占布局空间，
 * 会让盒子的实际尺寸比推导值多出一圈，陷阱里那些精确到个位数的数字就对不上了（红线 6）。
 */
.trap-stage {
  flex-shrink: 0;
  background: color-mix(in srgb, var(--accent) 4%, var(--panel));
  outline: 1px solid color-mix(in srgb, var(--border) 90%, var(--accent));
  outline-offset: -1px;
}

.trap-stage-item {
  display: flex;

  /*
   * 绝不能加 overflow: hidden。自动最小尺寸只在主轴 overflow 为 visible 时生效，
   * 一旦裁剪 min-width:auto 立刻失效，陷阱一就演不出来了（红线 7）。
   * 盒子被压得比内容还窄时，内容溢出正是要给人看的现象。
   */
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  outline: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: -1px;

  /*
   * 扁平方块，不做 Playground 那套等距实体块：
   * 立体块的顶面会画到容器外，在陷阱区这种小尺寸演示里更碍眼，
   * 而这里的主角是「现象」不是质感。
   */
  background: color-mix(in srgb, var(--accent) 30%, var(--panel));

  /* 状态在拍与拍之间离散切换，这道过渡就是「修复」那一下的全部动效 */
  transition:
    width 0.28s ease,
    height 0.28s ease,
    flex-basis 0.28s ease;
}

.trap-content {
  display: flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--fg) 88%, transparent);
  font-family: var(--font-mono, monospace);
  font-size: 13px;
}

@media (prefers-reduced-motion: reduce) {
  .trap-stage-item {
    transition: none;
  }
}
</style>
