<script setup lang="ts">
import { useFlexState } from '~/composables/useFlexState'
import ContainerControls from './ContainerControls.vue'
import CssOutput from './CssOutput.vue'
import DemoStage from './DemoStage.vue'
import ItemControls from './ItemControls.vue'
import ItemList from './ItemList.vue'
import MetricsTable from './MetricsTable.vue'

const { state, resetState } = useFlexState()

function setWidth(event: Event): void {
  state.container.width = Number((event.target as HTMLInputElement).value)
}

function setHeight(event: Event): void {
  state.container.height = Number((event.target as HTMLInputElement).value)
}
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
          <label class="flex items-center gap-2">
            <span class="op-70">容器宽</span>
            <input
              data-testid="stage-width"
              type="range"
              min="200"
              max="1200"
              step="10"
              :value="state.container.width"
              @input="setWidth"
            >
            <span class="w-12 font-mono">{{ state.container.width }}px</span>
          </label>
          <label class="flex items-center gap-2">
            <span class="op-70">容器高</span>
            <input
              data-testid="stage-height"
              type="range"
              min="120"
              max="600"
              step="10"
              :value="state.container.height"
              @input="setHeight"
            >
            <span class="w-12 font-mono">{{ state.container.height }}px</span>
          </label>
        </div>

        <div class="overflow-auto">
          <DemoStage />
        </div>
      </div>

      <MetricsTable />

      <CssOutput />
    </main>
  </div>
</template>
