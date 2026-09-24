<script setup lang="ts">
const { state, resetState } = useFlexState()
const { visible: overlayVisible, toggleVisible } = useOverlay()
</script>

<template>
  <!--
    高度链每一级都要 min-h-0：flex / grid 子项的最小尺寸默认是 auto，漏一级整页就重新开始滚。
    中间列必须是 minmax(0, 1fr) 而不是 1fr：1fr 的下限是 min-content（演示区 784px），
    窗口一窄右侧 CSS 栏会被顶出视口再被 overflow-hidden 裁掉；main 的 lg:min-w-0 是同一件事的另一半。
  -->
  <div class="grid mx-auto max-w-480 w-full gap-space p-space lg:grid-cols-[320px_minmax(0,1fr)_320px] lg:min-h-0 lg:flex-1">
    <aside class="flex flex-col gap-space panel p-space lg:min-h-0 lg:overflow-y-auto">
      <ContainerControls />
      <ItemList />
      <ItemControls />
      <button data-testid="reset" class="btn text-xs" @click="resetState()">
        重置为默认状态
      </button>
    </aside>

    <main class="min-w-0 flex flex-col gap-space lg:min-h-0">
      <div class="flex flex-col gap-space panel p-space lg:min-h-0 lg:flex-1">
        <div class="flex shrink-0 flex-wrap items-center gap-space text-xs">
          <h2 class="panel-title">
            <div class="i-carbon-screen" />
            演示区
          </h2>
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

        <ShareNotice />

        <!-- 不写内边距：留白全由 .stage-wrapper 的 --overhang 承担，再叠一份只会白缩可视范围 -->
        <div class="overflow-auto lg:min-h-0 lg:flex-1">
          <DemoStage />
        </div>
      </div>

      <!-- 固定高度：行数随盒子增删变化，自适应会把上面的演示区挤得忽大忽小 -->
      <section class="h-52 flex shrink-0 flex-col gap-space overflow-hidden panel p-space">
        <h2 class="panel-title shrink-0">
          <div class="i-carbon-compare" />
          理论 vs 实际
        </h2>
        <div class="min-h-0 flex-1 overflow-auto">
          <MetricsTable />
        </div>
      </section>
    </main>

    <CssOutput class="lg:min-h-0" />
  </div>
</template>
