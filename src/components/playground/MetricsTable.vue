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

// 文案住在展示层：core/ 只产出 rule 标识与数值
const ruleText: Record<DiagnosticRule, (diagnostic: Diagnostic) => string> = {
  'invalid-basis': () => 'flex-basis 非法（非 0 数值要带单位），浏览器按 auto 处理，导出的 flex 简写会整条失效',
  'runtime-basis': () => 'flex-basis 要到运行期才能确定（calc()、vw、ch 等），理论值无法推导',
  'min-width-auto': () => 'min-width:auto 撑住了内容固有尺寸，收缩到此为止',
  'margin-auto': d => `margin:auto 吃掉了 ${px(d.params.freeSpace)} 剩余空间，justify-content 已失效`,
  'max-size-clamp': () => '尺寸被某个上下限截断了',
}

// 不放进 useFlexState：状态层不该反向依赖观测层
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
      theoretical: derivedById.get(item.id)?.finalMainSize ?? null,
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
  <section data-testid="metrics" class="flex flex-col gap-tight">
    <p class="text-xs op-60">
      理论值来自推导引擎，实际值取自浏览器渲染结果——不一致处即是规则介入的地方
    </p>

    <div>
      <table class="w-full text-xs font-mono">
        <thead class="op-60">
          <tr>
            <th class="py-1 pr-3 text-center font-normal">
              #
            </th>
            <th class="py-1 pr-3 text-center font-normal">
              理论
            </th>
            <th class="py-1 pr-3 text-center font-normal">
              实际
            </th>
            <th class="py-1 text-center font-normal">
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
            <td class="py-1 pr-3 text-center">
              {{ row.label }}
            </td>
            <td data-testid="theoretical" class="py-1 pr-3 text-center">
              {{ row.theoretical === null ? '—' : px(row.theoretical) }}
            </td>
            <td data-testid="actual" class="py-1 pr-3 text-center">
              {{ row.actual === null ? '—' : px(row.actual) }}
            </td>
            <td data-testid="diagnosis" class="py-1 text-center font-sans">
              <span v-if="row.diagnostic?.severity === 'info'" class="text-accent">
                ℹ {{ ruleText[row.diagnostic.rule](row.diagnostic) }}
              </span>
              <span v-else-if="row.diagnostic" class="text-accent2">
                ⚠ {{ ruleText[row.diagnostic.rule](row.diagnostic) }}
              </span>
              <span v-else-if="row.actual === null || row.theoretical === null" class="op-60">—</span>
              <span v-else class="op-60">✓</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
