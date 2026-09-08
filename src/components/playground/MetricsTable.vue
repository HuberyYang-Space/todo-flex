<script setup lang="ts">
import type { Diagnostic, DiagnosticRule } from '~/core/types'
import { computed } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { useMeasure } from '~/composables/useMeasure'
import { isRowDirection } from '~/core/axis'
import { diagnose } from '~/core/diagnostics'
import { itemLabel } from '~/core/labels'

const { state, derived } = useFlexState()
const { measured } = useMeasure()

// i18n 要到 M6 才落地，规则文案先放在组件里，core/ 保持零文案
const ruleText: Record<DiagnosticRule, (diagnostic: Diagnostic) => string> = {
  'min-width-auto': () => 'min-width:auto 撑住了内容固有尺寸，收缩到此为止',
  'margin-auto': d => `margin:auto 吃掉了 ${px(d.params.freeSpace)} 剩余空间，justify-content 已失效`,
  'max-size-clamp': () => '尺寸被某个上下限截断了',
}

// 诊断在这里算而不是放进 useFlexState：状态层不该反向依赖观测层
const diagnostics = computed(() =>
  measured.value ? diagnose(state, derived.value, measured.value) : [],
)

const rows = computed(() => {
  const derivedById = new Map(derived.value.items.map(item => [item.id, item]))
  const measuredById = new Map((measured.value?.items ?? []).map(item => [item.id, item]))
  const diagnosticById = new Map(diagnostics.value.map(item => [item.itemId, item]))
  const isRow = isRowDirection(state.container.direction)

  return state.items.map((item, index) => {
    const record = measuredById.get(item.id)

    return {
      id: item.id,
      label: itemLabel(index),
      theoretical: derivedById.get(item.id)?.finalMainSize ?? 0,
      // 观测尚未产生时保持 null，不用 0 冒充
      actual: record ? (isRow ? record.width : record.height) : null,
      diagnostic: diagnosticById.get(item.id) ?? null,
    }
  })
})

function px(value: number): string {
  return `${Math.round(value * 10) / 10}px`
}
</script>

<template>
  <section data-testid="metrics" class="panel p-3">
    <header class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-sm font-bold">
        理论 vs 实际
      </h2>
      <p class="text-xs op-60">
        理论值来自推导引擎，实际值取自浏览器渲染结果——不一致处即是规则介入的地方
      </p>
    </header>

    <div class="overflow-x-auto">
      <table class="w-full text-xs font-mono">
        <thead class="op-60">
          <tr>
            <th class="py-1 pr-3 text-left font-normal">
              #
            </th>
            <th class="py-1 pr-3 text-right font-normal">
              理论
            </th>
            <th class="py-1 pr-3 text-right font-normal">
              实际
            </th>
            <th class="py-1 text-left font-normal">
              诊断
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            data-testid="metrics-row"
            :data-metrics-id="row.id"
            class="border-t border-bd"
          >
            <td class="py-1 pr-3">
              {{ row.label }}
            </td>
            <td data-testid="theoretical" class="py-1 pr-3 text-right">
              {{ px(row.theoretical) }}
            </td>
            <td data-testid="actual" class="py-1 pr-3 text-right">
              {{ row.actual === null ? '—' : px(row.actual) }}
            </td>
            <td data-testid="diagnosis" class="py-1 font-sans">
              <span v-if="row.actual === null" class="op-40">—</span>
              <span v-else-if="!row.diagnostic" class="op-60">✓</span>
              <span v-else-if="row.diagnostic.severity === 'info'" class="text-accent">
                ℹ {{ ruleText[row.diagnostic.rule](row.diagnostic) }}
              </span>
              <span v-else class="text-accent2">
                ⚠ {{ ruleText[row.diagnostic.rule](row.diagnostic) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
