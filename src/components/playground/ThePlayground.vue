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
  <!--
    高度链：App 根锁死整页高度 → 这里 flex-1 吃满 header 之外的剩余 → 三列各自内部滚。
    每一级都要写 min-h-0：flex 子项的 min-height 默认是 auto，不肯被压到内容高度以下，
    漏掉任何一级，多出来的高度都会一路顶到 body 上，整页重新开始滚。
    宽度封顶 max-w-480（1920px）。两侧 320px 固定、中间演示区吃掉全部剩余：
    演示区是唯一的真实布局来源，加宽它才有意义；左右两栏的内容宽度是确定的，不随窗口变。

    中间列必须写成 minmax(0, 1fr)，不能图省事写 1fr——
    `1fr` 等价于 `minmax(auto, 1fr)`，那个 auto 下限是这一列的 min-content，
    而演示区滚动层的 min-content 是 784px（.stage 固定 720px 加两侧各 32px 的 overhang，
    它自己的 overflow-auto 只挡得住自己溢出，挡不住 min-content 往上冒）。
    于是窗口一窄，三列合计宽度压不下来，右侧 CSS 栏被顶出视口，
    lg:overflow-hidden 再一裁——整栏消失，而且横向滚不到。
    main 的 lg:min-w-0 是同一件事的另一半：轨道让开了，grid 项自己也得允许被压。
  -->
  <div class="grid mx-auto max-w-480 w-full gap-space p-space lg:grid-cols-[320px_minmax(0,1fr)_320px] lg:min-h-0 lg:flex-1">
    <!-- 操作区 -->
    <aside class="flex flex-col gap-space panel p-space lg:min-h-0 lg:overflow-y-auto">
      <ContainerControls />
      <ItemList />
      <ItemControls />
      <button data-testid="reset" class="btn text-xs" @click="resetState()">
        重置为默认状态
      </button>
    </aside>

    <!-- 演示区 + 明细 -->
    <main class="flex flex-col gap-space lg:min-h-0 lg:min-w-0">
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

        <!--
          这层不写内边距。演示区四周的留白全部由 .stage-wrapper 的 --overhang
          （motion.stageOverhang = 32px）承担——那份余量本来就是按「悬停时块体伸出多少」
          算出来的，足够兜住顶面、抬升和放大，这里再叠一份 p-space 只是把演示区
          往右下推、白白缩掉可视范围，防裁切的能力一点不增加。
          留白也不能改挂到 .stage 上：.stage 加 padding 会占布局空间，
          诊断层会把那份恒定偏差误报成「有规则介入」（红线 6）。
        -->
        <div class="overflow-auto lg:min-h-0 lg:flex-1">
          <DemoStage />
        </div>
      </div>

      <!--
        明细表固定 208px 高而不是自适应：行数随盒子增删变化，高度跟着跳的话
        演示区会被挤得忽大忽小，而演示区正是这个站唯一的真实布局来源，
        它的可视高度不该被下面的表格牵着走。
      -->
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

    <!-- CSS 输出自带面板外壳（标题 + 复制按钮 + 内部滚动） -->
    <CssOutput class="lg:min-h-0" />
  </div>
</template>
