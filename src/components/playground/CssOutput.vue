<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import { computed, ref, shallowRef, watchEffect } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { itemProperties } from '~/data/flexProperties'
import { highlightCss } from '~/visual/highlight'

const { css } = useFlexState()

const demoOnlyNames = itemProperties.filter(prop => prop.demoOnly).map(prop => `「${prop.cssName}」`).join('、')

// 不用 VueUse 的 useClipboard：它退回 execCommand 后不看返回值，一律报「已复制」，假成功比明说失败更糟
const copyStatus = ref<'idle' | 'copied' | 'failed'>('idle')
const { start: resetCopyStatus } = useTimeoutFn(() => (copyStatus.value = 'idle'), 1500, { immediate: false })

const copyLabel = computed(() => ({
  idle: '复制 CSS',
  copied: '已复制',
  failed: '复制失败，请手动选中复制',
})[copyStatus.value])

const copyIcon = computed(() => ({
  idle: 'i-carbon-copy',
  copied: 'i-carbon-checkmark',
  failed: 'i-carbon-warning',
})[copyStatus.value])

const highlighted = shallowRef('')

watchEffect(async () => {
  const source = css.value
  try {
    const html = await highlightCss(source)
    // 高亮期间状态可能又变了，过期结果丢弃，免得把旧 CSS 盖回去
    if (source === css.value)
      highlighted.value = html
  }
  catch {
    // shiki 分包加载失败时退回纯文本
    highlighted.value = ''
  }
})

async function copy(): Promise<void> {
  try {
    // 非安全上下文里 navigator.clipboard 是 undefined，同步抛出也落进 catch
    await navigator.clipboard.writeText(css.value)
    copyStatus.value = 'copied'
  }
  catch {
    copyStatus.value = 'failed'
  }
  resetCopyStatus()
}
</script>

<template>
  <section class="flex flex-col gap-space overflow-hidden panel p-space">
    <header class="flex shrink-0 items-center gap-space">
      <h2 class="panel-title">
        <div class="i-carbon-code" />
        CSS
      </h2>
      <button
        data-testid="copy-css"
        class="ml-auto icon-btn"
        type="button"
        :title="copyLabel"
        :aria-label="copyLabel"
        @click="copy()"
      >
        <div :class="copyIcon" />
      </button>
    </header>

    <p v-if="demoOnlyNames" data-testid="css-note" class="shrink-0 text-xs op-60">
      {{ demoOnlyNames }}只用于演示区，不是 CSS 属性，不会导出
    </p>

    <!-- min-h-0 不能漏，否则长 CSS 会把整块面板顶破 -->
    <div class="min-h-0 flex-1 overflow-auto">
      <!-- basis 可由用户与分享链接任意填写，这里的安全性系于 shiki 对文本的转义，由 CssOutput.spec 钉住 -->
      <div v-if="highlighted" data-testid="css-code" class="css-code" v-html="highlighted" />
      <pre v-else data-testid="css-code" class="css-code"><code>{{ css }}</code></pre>
    </div>
  </section>
</template>

<style scoped>
.css-code,
.css-code :deep(pre) {
  margin: 0;
  font-size: 12px;
  line-height: 1.625;
}
</style>
