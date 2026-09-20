<script setup lang="ts">
import { ref } from 'vue'
import CssOutput from './CssOutput.vue'
import MetricsTable from './MetricsTable.vue'

type TabKey = 'metrics' | 'css'

const tabs: { key: TabKey, label: string }[] = [
  { key: 'metrics', label: '理论 vs 实际' },
  { key: 'css', label: 'CSS' },
]

/*
 * 默认停在明细而不是 CSS：「理论值与实际值并排校验」是本站区别于其他 flex playground
 * 的地方，调属性时它应该一直在视线里；复制 CSS 是次要动作，多一次点击可以接受。
 */
const active = ref<TabKey>('metrics')
</script>

<template>
  <section data-testid="inspector" class="flex flex-col overflow-hidden panel">
    <!-- 标签条的左内边距与下方内容区一致，第一个标签的左沿才和表格对得齐 -->
    <div role="tablist" class="flex shrink-0 items-stretch gap-space border-b border-bd px-space">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :data-testid="`inspector-tab-${tab.key}`"
        role="tab"
        type="button"
        :aria-selected="active === tab.key"
        class="tab-btn"
        :class="{ 'is-active': active === tab.key }"
        @click="active = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!--
      这层是整块面板里唯一滚的地方。它必须同时有 flex-1 和 min-h-0：
      flex 子项的 min-height 默认是 auto，不肯被压到内容高度以下，
      少了 min-h-0 这层就会把面板顶高，滚动条一路冒到 body 上，整页不滚动的前提当场作废。
    -->
    <div class="min-h-0 flex-1 overflow-auto p-space">
      <MetricsTable v-if="active === 'metrics'" />
      <CssOutput v-else />
    </div>
  </section>
</template>

<style scoped>
.tab-btn {
  /* 左右不留内边距：靠 tablist 的 px-space 定左沿，标签之间靠 gap 拉开 */
  padding: 6px 0;
  border-bottom: 2px solid transparent;
  color: color-mix(in srgb, var(--fg) 60%, transparent);
  font-size: 12px;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease;
}

.tab-btn:hover {
  color: var(--fg);
}

.tab-btn.is-active {
  border-bottom-color: var(--accent);
  color: var(--fg);
  font-weight: 700;
}
</style>
