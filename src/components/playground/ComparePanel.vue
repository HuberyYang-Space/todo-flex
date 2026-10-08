<script setup lang="ts">
import { itemLabel } from '~/core/labels'

const { state } = useFlexState()

type TabKey = 'metrics' | 'derivation'
const active = ref<TabKey>('metrics')

const tabs = computed<{ key: TabKey, label: string }[]>(() => {
  const index = state.items.findIndex(item => item.id === state.selectedId)
  return [
    { key: 'metrics', label: '明细表' },
    { key: 'derivation', label: index === -1 ? '推导过程' : `推导过程 · 盒子 ${itemLabel(index)}` },
  ]
})

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End'])

/** WAI-ARIA tabs：方向键移动即切换，焦点跟着走 */
function onKeydown(event: KeyboardEvent): void {
  if (!NAV_KEYS.has(event.key))
    return
  event.preventDefault()
  const keys = tabs.value.map(tab => tab.key)
  const current = keys.indexOf(active.value)
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? keys.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length
  active.value = keys[next]
  document.getElementById(`compare-tab-${keys[next]}`)?.focus()
}
</script>

<template>
  <!-- 固定高度：行数随盒子增删变化，自适应会把上面的演示区挤得忽大忽小 -->
  <section data-testid="compare-panel" class="h-52 flex shrink-0 flex-col gap-space overflow-hidden panel p-space">
    <div class="flex shrink-0 flex-wrap items-center gap-space">
      <h2 class="panel-title">
        <div class="i-carbon-compare" />
        理论 vs 实际
      </h2>
      <div role="tablist" aria-label="理论 vs 实际" class="flex gap-tight text-xs" @keydown="onKeydown">
        <button
          v-for="tab in tabs"
          :id="`compare-tab-${tab.key}`"
          :key="tab.key"
          :data-testid="`tab-${tab.key}`"
          type="button"
          role="tab"
          :aria-selected="active === tab.key"
          :aria-controls="`compare-panel-${tab.key}`"
          :tabindex="active === tab.key ? 0 : -1"
          class="cursor-pointer border-b-2 border-transparent px-1 py-0.5 op-60 transition-colors aria-selected:border-accent aria-selected:text-accent aria-selected:op-100 hover:op-100"
          @click="active = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div
      v-for="tab in tabs"
      v-show="active === tab.key"
      :id="`compare-panel-${tab.key}`"
      :key="tab.key"
      role="tabpanel"
      :aria-labelledby="`compare-tab-${tab.key}`"
      tabindex="0"
      class="min-h-0 flex-1 overflow-auto"
    >
      <MetricsTable v-if="tab.key === 'metrics'" />
      <DerivationSteps v-else />
    </div>
  </section>
</template>
