<script setup lang="ts">
import type { Diagnostic } from '~/core/types'

const props = defineProps<{ diagnostic: Diagnostic }>()
const { textOf } = useDiagnostics()

// 连字符是断行机会：窄列里 min-width:auto 会被拆成「min-」与「width:auto」两行。
// 用 inline-block 而非 nowrap：放得下时整体挪到下一行，比单元格还宽时才在内部折行，nowrap 会直接溢出单元格
const CSS_NAME = /([a-z]+(?:-[a-z]+)+(?::[a-z]+)?)/

const segments = computed(() =>
  textOf(props.diagnostic).split(CSS_NAME).map((part, index) => ({ text: part, unbreakable: index % 2 === 1 })),
)
</script>

<template>
  <span :class="props.diagnostic.severity === 'info' ? 'text-accent' : 'text-accent2'">
    {{ props.diagnostic.severity === 'info' ? 'ℹ' : '⚠' }}
    <template v-for="(segment, index) in segments" :key="index">
      <span v-if="segment.unbreakable" class="inline-block max-w-full">{{ segment.text }}</span>
      <template v-else>{{ segment.text }}</template>
    </template>
  </span>
</template>
