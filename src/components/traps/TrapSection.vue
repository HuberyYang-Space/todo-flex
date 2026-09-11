<script setup lang="ts">
import type { FlexState, Trap } from '~/core/types'
import Prism from 'prismjs'
import { computed, ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { prefersReducedMotion, useTrapScroll } from '~/composables/useTrapScroll'
import { diffStates, resolveVariant } from '~/core/trapPatch'
import TrapDiff from './TrapDiff.vue'
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

function highlight(code: string): string {
  return Prism.highlight(code, Prism.languages.css, 'css')
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
          <article
            v-for="(item, index) in trap.beats"
            :key="item.title"
            data-testid="trap-beat"
            class="beat flex flex-col gap-3 panel p-4"
            :class="{ 'is-active': beat === index }"
          >
            <h3 class="flex items-center gap-2 text-sm font-bold">
              <span class="text-accent font-mono">{{ index + 1 }}</span>
              {{ item.title }}
            </h3>
            <p class="text-sm leading-relaxed op-80">
              {{ item.body }}
            </p>
            <pre
              v-if="item.code"
              class="overflow-x-auto rounded-2 bg-panel p-2 text-xs leading-relaxed font-mono"
            ><code v-html="highlight(item.code)" /></pre>
            <TrapDiff v-if="index === 1" :diffs="diffs" />
          </article>
        </div>
      </div>

      <!-- 降级形态：三拍全展开，各配一个演示区。不 pin、不劫持滚动 -->
      <div v-else class="flex flex-col gap-8">
        <article
          v-for="(item, index) in trap.beats"
          :key="item.title"
          data-testid="trap-beat"
          class="beat is-active flex flex-col gap-3"
        >
          <h3 class="flex items-center gap-2 text-sm font-bold">
            <span class="text-accent font-mono">{{ index + 1 }}</span>
            {{ item.title }}
          </h3>
          <p class="text-sm leading-relaxed op-80">
            {{ item.body }}
          </p>
          <pre
            v-if="item.code"
            class="overflow-x-auto rounded-2 bg-panel p-2 text-xs leading-relaxed font-mono"
          ><code v-html="highlight(item.code)" /></pre>
          <TrapDiff v-if="index === 1" :diffs="diffs" />
          <!-- 同一条 min-width: auto 规则：flex 容器里的子项默认也不得小于内容宽度，
               窄屏下 720px 的演示区一样会把这层撑开，理由同上一处正常形态的注释。 -->
          <div class="min-w-0 panel p-3">
            <TrapStage :state="stateForBeat(index)" />
          </div>
        </article>
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
 * 卡片才不会把这一屏撑爆。非当前拍要关掉指针事件，否则会挡住底下那张的按钮。
 */
.beats > .beat {
  grid-area: 1 / 1;
}

.beat {
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
  pointer-events: none;
}

.beat.is-active {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .beat {
    transition: none;
  }
}
</style>
