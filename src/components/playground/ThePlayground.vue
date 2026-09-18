<script setup lang="ts">
import { useFlexState } from '~/composables/useFlexState'
import { useOverlay } from '~/composables/useOverlay'
import ContainerControls from './ContainerControls.vue'
import CssOutput from './CssOutput.vue'
import DemoStage from './DemoStage.vue'
import ItemControls from './ItemControls.vue'
import ItemList from './ItemList.vue'
import MetricsTable from './MetricsTable.vue'

const { state, resetState } = useFlexState()
const { visible: overlayVisible, toggleVisible } = useOverlay()
</script>

<template>
  <div class="grid mx-auto max-w-360 w-full gap-4 p-4 lg:grid-cols-[320px_1fr]">
    <!-- 操作区 -->
    <aside class="h-fit flex flex-col gap-5 panel p-3">
      <ContainerControls />
      <ItemList />
      <ItemControls />
      <button data-testid="reset" class="btn text-xs" @click="resetState()">
        重置为默认状态
      </button>
    </aside>

    <!-- 演示区 + CSS 输出 -->
    <main class="flex flex-col gap-4">
      <div class="panel p-3">
        <div class="mb-3 flex flex-wrap items-center gap-4 text-xs">
          <label class="flex cursor-pointer items-center gap-2">
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
          取 p-3 (12px) 而不是更小，是因为这里要同时容下两样伸出容器的东西：
          右下角的 resize 手柄，以及等距实体块往上伸的顶面（motion.blockDepth = 10px）。
          曾经是 p-2 (8px)，顶面上沿被这一层的 overflow 裁掉 2px——
          stretch 下盒子顶边必然贴着容器上沿，所以那个裁切每次都发生。
        -->
        <div class="overflow-auto p-3">
          <DemoStage />
        </div>
      </div>

      <MetricsTable />

      <CssOutput />
    </main>
  </div>
</template>
