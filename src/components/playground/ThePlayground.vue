<script setup lang="ts">
import { useFlexState } from '~/composables/useFlexState'
import { useOverlay } from '~/composables/useOverlay'
import ContainerControls from './ContainerControls.vue'
import DemoStage from './DemoStage.vue'
import InspectorTabs from './InspectorTabs.vue'
import ItemControls from './ItemControls.vue'
import ItemList from './ItemList.vue'

const { state, resetState } = useFlexState()
const { visible: overlayVisible, toggleVisible } = useOverlay()
</script>

<template>
  <!--
    高度链：App 根锁死整页高度 → 这里 flex-1 吃满 header 之外的剩余 → 两列各自内部滚。
    每一级都要写 min-h-0：flex 子项的 min-height 默认是 auto，不肯被压到内容高度以下，
    漏掉任何一级，多出来的高度都会一路顶到 body 上，整页重新开始滚。
    宽度封顶 max-w-480（1920px），比原来的 1440 多出的部分全部落给右侧演示区。
  -->
  <div class="grid mx-auto max-w-480 w-full gap-space p-space lg:grid-cols-[320px_1fr] lg:min-h-0 lg:flex-1">
    <!-- 操作区 -->
    <aside class="flex flex-col gap-space panel p-space lg:min-h-0 lg:overflow-y-auto">
      <ContainerControls />
      <ItemList />
      <ItemControls />
      <button data-testid="reset" class="btn text-xs" @click="resetState()">
        重置为默认状态
      </button>
    </aside>

    <!-- 演示区 + 检视面板 -->
    <main class="flex flex-col gap-space lg:min-h-0">
      <div class="flex flex-col gap-space panel p-space lg:min-h-0 lg:flex-1">
        <div class="flex shrink-0 flex-wrap items-center gap-space text-xs">
          <label class="flex cursor-pointer items-center gap-tight">
            <input
              data-testid="overlay-toggle"
              type="checkbox"
              :checked="overlayVisible"
              @change="toggleVisible()"
            >
            <span class="op-70">叠加层</span>
          </label>
          <span class="op-60">拖拽演示区右下角手柄调整容器尺寸</span>
          <span class="ml-auto font-mono op-70">
            {{ state.container.width }} × {{ state.container.height }}
          </span>
        </div>

        <!--
          内边距加在滚动容器上而不是 .stage 上：.stage 加 padding 会占布局空间，
          诊断层会把那份恒定偏差误报成「有规则介入」（红线 6）。
          这里用的是全局间距 --space（12px），它同时还得容下两样伸出容器的东西：
          右下角的 resize 手柄，以及等距实体块往上伸的顶面（motion.blockDepth = 10px）。
          曾经是 8px，顶面上沿被这一层的 overflow 裁掉 2px——
          stretch 下盒子顶边必然贴着容器上沿，所以那个裁切每次都发生。
          调小 --space 之前先看 ThePlayground.spec.ts 里钉着的那条守卫。
        -->
        <div class="overflow-auto p-space lg:min-h-0 lg:flex-1">
          <DemoStage />
        </div>
      </div>

      <!--
        明细表与 CSS 输出合成一块固定高度（208px）的标签面板。
        固定而不是自适应：行数随盒子增删变化，高度跟着跳的话演示区会被挤得忽大忽小，
        而演示区正是这个站唯一的真实布局来源，它的可视高度不该被下面的表格牵着走。
      -->
      <InspectorTabs class="h-52 shrink-0" />
    </main>
  </div>
</template>
