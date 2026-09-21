<script setup lang="ts">
import { ref, shallowRef, watchEffect } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { highlightCss } from '~/visual/highlight'

const { css } = useFlexState()
const copied = ref(false)

/*
 * 高亮是异步的（shiki 的语法与主题要先加载），所以首帧先渲染未高亮的纯文本，
 * 拿到结果再替换。反过来先留空的话，代码块会在首屏闪一下再出现。
 */
const highlighted = shallowRef('')

watchEffect(async () => {
  const source = css.value
  const html = await highlightCss(source)
  // 高亮期间状态可能又变了，过期结果直接丢弃，免得把旧 CSS 盖回去
  if (source === css.value)
    highlighted.value = html
})

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(css.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
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
        :title="copied ? '已复制' : '复制 CSS'"
        :aria-label="copied ? '已复制' : '复制 CSS'"
        @click="copy()"
      >
        <div :class="copied ? 'i-carbon-checkmark' : 'i-carbon-copy'" />
      </button>
    </header>

    <!-- 这层是面板里唯一滚的地方，min-h-0 不能漏，否则长 CSS 会把整块面板顶破 -->
    <div class="min-h-0 flex-1 overflow-auto">
      <!-- v-html 的内容是 shiki 对本站自己生成的 CSS 的高亮结果，不经过任何外部输入 -->
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
