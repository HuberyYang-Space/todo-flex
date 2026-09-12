<script setup lang="ts">
import type { FlexState, Trap } from '~/core/types'
import { computed, ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { prefersReducedMotion, useTrapScroll } from '~/composables/useTrapScroll'
import { diffStates, resolveVariant } from '~/core/trapPatch'
import TrapBeatCard from './TrapBeatCard.vue'
import TrapStage from './TrapStage.vue'

const props = defineProps<{ trap: Trap }>()

const sectionEl = ref<HTMLElement>()
const { beat, degraded } = useTrapScroll(sectionEl)
const { loadState } = useFlexState()

const beforeState = computed(() => resolveVariant(props.trap, 'before'))
const afterState = computed(() => resolveVariant(props.trap, 'after'))
const diffs = computed(() => diffStates(beforeState.value, afterState.value))

/**
 * 前两拍一律停在现象态。
 * 归因是在解释眼前这个现象，一边解释一边把现象换掉，话就说不通了。
 */
const stageState = computed(() => (beat.value < 2 ? beforeState.value : afterState.value))

/** 降级时每一拍各配一个演示区：前两拍现象、最后一拍修复 */
function stateForBeat(index: number): FlexState {
  return index < 2 ? beforeState.value : afterState.value
}

/**
 * 载入 Playground 复现。
 *
 * 直接改全局状态，不写地址栏——状态源只在模块加载那一刻读一次 location.search，
 * 之后没人监听它。地址栏会由 useShareUrl 在 300ms 后自动跟上。
 */
function reproduce(which: 'before' | 'after'): void {
  loadState(which === 'before' ? beforeState.value : afterState.value)
  document.getElementById('playground')?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  })
}
</script>

<template>
  <section
    ref="sectionEl"
    data-testid="trap-section"
    class="trap-section w-full"
    :class="degraded ? 'py-12' : 'h-screen flex items-center'"
  >
    <div class="mx-auto max-w-360 w-full flex flex-col gap-6 p-4">
      <header class="flex flex-col gap-1">
        <h2 class="text-xl font-bold">
          {{ trap.title }}
        </h2>
        <p class="text-sm op-70">
          {{ trap.hook }}
        </p>
      </header>

      <!-- 正常形态：一个演示区随拍切状态，三张卡片叠在同一格里淡入淡出 -->
      <div v-if="!degraded" class="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <!--
          左栏必须显式写 min-w-0。grid 轨道 1fr 的最小尺寸默认是 auto（不得小于内容），
          720px 的演示区会把轨道从可用宽顶开、连带撑破页面，TrapStage 里的 overflow-auto
          就永远没东西可裁——这正是本站陷阱一讲的那条规则，站点自己也得守。
        -->
        <div class="min-w-0 panel p-3">
          <TrapStage :state="stageState" />
        </div>

        <div class="beats grid">
          <TrapBeatCard
            v-for="(item, index) in trap.beats"
            :key="item.title"
            class="panel p-4"
            :beat="item"
            :index="index"
            :active="beat === index"
            :diffs="diffs"
          />
        </div>
      </div>

      <!-- 降级形态：三拍全展开，各配一个演示区。不 pin、不劫持滚动 -->
      <div v-else class="flex flex-col gap-8">
        <!-- 降级形态每一拍都是展开的，所以 active 恒为真 -->
        <TrapBeatCard
          v-for="(item, index) in trap.beats"
          :key="item.title"
          :beat="item"
          :index="index"
          :active="true"
          :diffs="diffs"
        >
          <!-- 同一条 min-width: auto 规则：flex 容器里的子项默认也不得小于内容宽度，
               窄屏下 720px 的演示区一样会把这层撑开，理由同上一处正常形态的注释。 -->
          <div class="min-w-0 panel p-3">
            <TrapStage :state="stateForBeat(index)" />
          </div>
        </TrapBeatCard>
      </div>

      <footer class="flex flex-wrap gap-2">
        <button data-testid="trap-load-before" class="btn text-xs" @click="reproduce('before')">
          载入现象到 Playground
        </button>
        <button data-testid="trap-load-after" class="btn text-xs" @click="reproduce('after')">
          载入修复到 Playground
        </button>
      </footer>
    </div>
  </section>
</template>

<style scoped>
/*
 * 三张卡片叠在同一个网格单元里：pin 住的是一屏，三拍轮流占据同一块地方，
 * 卡片才不会把这一屏撑爆。淡入淡出与指针事件归 TrapBeatCard 自己管。
 *
 * 选择器能命中子组件，是因为 Vue 会把父组件的 scope id 一并打在子组件根节点上；
 * 堆叠是「三拍挤在一格里」这个父级布局决定的，所以留在这边而不是搬进子组件。
 */
.beats > .beat {
  grid-area: 1 / 1;
}
</style>
