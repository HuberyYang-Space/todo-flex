<script setup lang="ts">
import Prism from 'prismjs'
import { computed, ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'

// css 是 Prism 核心自带的语言，无需额外 import 语法包
const { css } = useFlexState()
const copied = ref(false)

const highlighted = computed(() => Prism.highlight(css.value, Prism.languages.css, 'css'))

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(css.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <section class="panel p-3">
    <header class="mb-2 flex items-center justify-between">
      <h2 class="text-sm font-bold">
        CSS
      </h2>
      <button data-testid="copy-css" class="btn text-xs" @click="copy()">
        {{ copied ? '已复制' : '复制' }}
      </button>
    </header>

    <pre
      data-testid="css-code"
      class="overflow-x-auto text-xs leading-relaxed font-mono"
    ><code v-html="highlighted" /></pre>
  </section>
</template>
