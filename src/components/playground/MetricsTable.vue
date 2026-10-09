<script setup lang="ts">
import { measuredMainSize } from '~/core/axis'
import { itemLabel, px } from '~/core/labels'

const { state, derived } = useFlexState()
const { measured } = useMeasure()
const { byId } = useDiagnostics()

const rows = computed(() => {
  const derivedById = new Map(derived.value.items.map(item => [item.id, item]))
  const measuredById = new Map((measured.value?.items ?? []).map(item => [item.id, item]))

  return state.items.map((item, index) => {
    const record = measuredById.get(item.id)

    return {
      id: item.id,
      label: itemLabel(index),
      theoretical: derivedById.get(item.id)?.finalMainSize ?? null,
      // 观测尚未产生时保持 null，不用 0 冒充
      actual: record ? measuredMainSize(record, state.container.direction) : null,
      diagnostic: byId.value.get(item.id) ?? null,
    }
  })
})
</script>

<template>
  <section data-testid="metrics" class="flex flex-col gap-tight">
    <p class="text-xs op-60">
      理论值来自推导引擎，实际值来自浏览器渲染结果，不一致处即是规则介入的地方
    </p>

    <div>
      <table class="w-full text-xs font-mono">
        <thead class="op-60">
          <tr>
            <th class="whitespace-nowrap py-1 pr-3 text-start font-normal">
              #
            </th>
            <th class="whitespace-nowrap py-1 pr-3 text-center font-normal">
              理论
            </th>
            <th class="whitespace-nowrap py-1 pr-3 text-center font-normal">
              实际
            </th>
            <th class="whitespace-nowrap py-1 text-left font-normal">
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
            <td class="py-1 pr-3 text-start">
              {{ row.label }}
            </td>
            <td data-testid="theoretical" class="py-1 pr-3 text-center">
              {{ row.theoretical === null ? '—' : px(row.theoretical) }}
            </td>
            <td data-testid="actual" class="py-1 pr-3 text-center">
              {{ row.actual === null ? '—' : px(row.actual) }}
            </td>
            <td data-testid="diagnosis" class="py-1 text-left font-sans">
              <DiagnosisText v-if="row.diagnostic" :diagnostic="row.diagnostic" />
              <span v-else-if="row.actual === null || row.theoretical === null" class="op-60">—</span>
              <span v-else class="op-60">✓</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
