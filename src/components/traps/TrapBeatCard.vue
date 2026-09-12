<script setup lang="ts">
import type { PropertyDiff, TrapBeat } from '~/core/types'
import Prism from 'prismjs'
import { computed } from 'vue'
import TrapDiff from './TrapDiff.vue'

/**
 * 单张拍卡片：标号 + 标题 + 正文 + 可选代码块，归因那一拍额外带差异表。
 *
 * 抽出来是因为 TrapSection 的正常形态与降级形态都要渲染它，
 * 两套模板里逐字复制过一遍，改文案结构时极易只改一处。
 * 两种形态的差别只剩下「当前拍怎么算」和「卡片里要不要塞演示区」，
 * 前者用 active 传，后者用默认插槽。
 */
const props = defineProps<{
  beat: TrapBeat
  /** 从 0 开始的拍号，卡片左上角的序号显示 index + 1 */
  index: number
  /** 是否为当前拍：控制淡入淡出与指针事件 */
  active: boolean
  diffs: PropertyDiff[]
}>()

/** 恰好第二拍是归因拍，差异表只挂在它身上 */
const isAttributionBeat = computed(() => props.index === 1)

function highlight(code: string): string {
  return Prism.highlight(code, Prism.languages.css, 'css')
}
</script>

<template>
  <article
    data-testid="trap-beat"
    class="beat flex flex-col gap-3"
    :class="{ 'is-active': active }"
  >
    <h3 class="flex items-center gap-2 text-sm font-bold">
      <span class="text-accent font-mono">{{ index + 1 }}</span>
      {{ beat.title }}
    </h3>
    <p class="text-sm leading-relaxed op-80">
      {{ beat.body }}
    </p>
    <pre
      v-if="beat.code"
      class="overflow-x-auto rounded-2 bg-panel p-2 text-xs leading-relaxed font-mono"
    ><code v-html="highlight(beat.code)" /></pre>
    <TrapDiff v-if="isAttributionBeat" :diffs="diffs" />
    <slot />
  </article>
</template>

<style scoped>
.beat {
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
  pointer-events: none;
}

/* 非当前拍要关掉指针事件，否则正常形态下三张卡片叠在一起时会挡住底下那张的按钮 */
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
