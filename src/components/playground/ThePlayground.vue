<script setup lang="ts">
const { state, resetState } = useFlexState()
const { visible: overlayVisible, toggleVisible } = useOverlay()

// 只看焦点不看选中：从左侧列表选中时焦点在列表按钮上，按 Delete 不会删
const activeElement = useActiveElement()
const deletable = computed(() => activeElement.value?.dataset.itemId !== undefined && state.items.length > 1)
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
        重 置
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
          <!--
            两段文案叠在同一格、只切 visibility：占位宽度恒取较长那段。直接换文字的话，这一行 flex-wrap，
            长短一变折行就变，点一下盒子演示区就跳 24px
          -->
          <span data-testid="stage-hint" class="grid op-60">
            <span class="[grid-area:1/1]" :class="{ invisible: deletable }">拖拽右下角手柄调整容器尺寸</span>
            <span class="[grid-area:1/1]" :class="{ invisible: !deletable }">按 Delete 键删除盒子</span>
          </span>
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

      <ComparePanel />
    </main>

    <CssOutput class="lg:min-h-0" />
  </div>
</template>
