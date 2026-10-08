<script setup lang="ts">
import type { ExplainStep } from '~/core/types'
import { isRowDirection } from '~/core/axis'
import { explainItem } from '~/core/explain'
import { formatNumber, itemLabel, px } from '~/core/labels'

const { state, derived, selectedItem } = useFlexState()
const { measured } = useMeasure()
const { byId } = useDiagnostics()

interface Row { label: string, formula: string, substitution: string, result: string }

const n = (value: number): string => formatNumber(value)
const factor = (value: number): string => formatNumber(value, 2)
const sum = (terms: number[]): string => terms.map(n).join(' + ')
const boxOf = (id: string): string => `盒子 ${itemLabel(state.items.findIndex(item => item.id === id))}`
// gap 为 0 时不写：满屏的「+ 0」只会干扰
const accumulate = (terms: number[], gap: number): string => terms.map(n).join(gap > 0 ? ` + ${n(gap)} + ` : ' + ')

function basisText(step: Extract<ExplainStep, { kind: 'basis' }>): Pick<Row, 'formula' | 'substitution'> {
  switch (step.form) {
    case 'content': return { formula: `${step.raw} 取内容尺寸`, substitution: `内容尺寸 ${n(step.value)}` }
    case 'length': return { formula: '长度直接取值', substitution: step.raw }
    case 'percent': return { formula: '百分比 × 容器主轴', substitution: `${n(step.value)}% × ${n(step.factor)}` }
    case 'font': return { formula: `${step.unit} × 根字号`, substitution: `${n(step.value)} × ${n(step.factor)}` }
    case 'unit': return { formula: `1${step.unit} = ${n(step.factor)}px`, substitution: `${n(step.value)} × ${n(step.factor)}` }
  }
}

function rowOf(step: ExplainStep): Row {
  switch (step.kind) {
    case 'basis':
      return { label: 'basis', ...basisText(step), result: px(step.result) }
    case 'basis-runtime':
      return { label: 'basis', formula: '要到运行期才能确定（calc()、vw、ch 等）', substitution: step.raw, result: '—' }
    case 'unresolvable':
      return {
        label: '无法推导',
        formula: step.blockers.length > 0
          ? `${step.blockers.map(boxOf).join('、')} 的 basis 要到运行期才能确定`
          : '这个盒子的 basis 要到运行期才能确定',
        substitution: '整个容器的理论值都给不出',
        result: '—',
      }
    case 'line': {
      const used = step.terms.reduce((total, term) => total + term, 0) + (step.terms.length - 1) * step.gap
      const substitution = step.terms.length === 1 && used > step.limit
        ? `${n(used)} > ${n(step.limit)}，独占一行`
        : step.next === null
          ? `${accumulate(step.terms, step.gap)} = ${n(used)} ≤ ${n(step.limit)}`
          : `${accumulate([...step.terms, step.next], step.gap)} = ${n(used + step.gap + step.next)} > ${n(step.limit)}`
      return { label: '分行', formula: '按 order 累加 basis 与 gap，超出容器主轴就换行', substitution, result: `第 ${step.lineNumber} 行（共 ${step.lineCount} 行）` }
    }
    case 'free': {
      const gaps = step.terms.length - 1
      const used = gaps === 0 ? n(step.terms[0]) : `(${sum(step.terms)})`
      return {
        label: '本行剩余',
        formula: '容器主轴 − Σbasis − (n − 1) × gap',
        substitution: `${n(step.container)} − ${used}${gaps > 0 ? ` − ${gaps} × ${n(step.gap)}` : ''}`,
        result: step.result < 0 ? `${px(step.result)}（溢出）` : px(step.result),
      }
    }
    case 'balanced':
      return { label: '分配', formula: '剩余为 0，不伸不缩', substitution: '', result: px(0) }
    case 'grow':
      if (step.totalGrow === 0)
        return { label: 'grow 分配', formula: 'Σgrow = 0，不伸展', substitution: '', result: px(0) }
      return step.totalGrow < 1
        ? {
            label: 'grow 分配',
            formula: 'grow ÷ Σgrow × (剩余 × Σgrow)：Σgrow < 1 时只分出这个比例',
            substitution: `${factor(step.grow)} ÷ ${factor(step.totalGrow)} × (${n(step.free)} × ${factor(step.totalGrow)})`,
            result: px(step.result),
          }
        : { label: 'grow 分配', formula: 'grow ÷ Σgrow × 剩余', substitution: `${factor(step.grow)} ÷ ${factor(step.totalGrow)} × ${n(step.free)}`, result: px(step.result) }
    case 'shrink-weight':
      return { label: '收缩权重', formula: 'shrink × basis', substitution: `${factor(step.shrink)} × ${n(step.basis)}`, result: n(step.result) }
    case 'freeze':
      return {
        label: `冻结第 ${step.round} 轮`,
        formula: '分摊后压到 0 以下的盒子冻结在 0，溢出在其余盒子间重新分摊',
        substitution: step.frozen.map(record => `${boxOf(record.id)} 应让 ${n(record.share)}，basis 只有 ${n(record.basis)}`).join('；'),
        result: `溢出剩 ${px(step.remaining)}`,
      }
    case 'shrink-total':
      return { label: '权重和', formula: 'Σ(shrink × basis)，只计未冻结的盒子', substitution: sum(step.terms), result: n(step.result) }
    case 'shrink-share': {
      const scaled = step.factorSum < 1
      return {
        label: 'shrink 分摊',
        formula: scaled ? '权重 ÷ 权重和 × max(剩余溢出, 初始溢出 × Σshrink)：Σshrink < 1 时只分摊这个比例' : '权重 ÷ 权重和 × 溢出',
        substitution: `${n(step.weight)} ÷ ${n(step.weightSum)} × ${scaled ? `max(${n(step.overflow)}, ${n(step.initialOverflow)} × ${factor(step.factorSum)})` : n(step.overflow)}`,
        result: px(step.result),
      }
    }
    case 'no-shrink':
      return { label: 'shrink 分摊', formula: 'Σ(shrink × basis) = 0，不收缩，溢出留在行上', substitution: '', result: px(0) }
    case 'final':
      return {
        label: '理论最终',
        formula: 'basis + 分配',
        substitution: step.delta < 0 ? `${n(step.basis)} − ${n(-step.delta)}` : `${n(step.basis)} + ${n(step.delta)}`,
        result: px(step.result),
      }
  }
}

const rows = computed(() => selectedItem.value ? explainItem(state, derived.value, selectedItem.value.id).map(rowOf) : [])

const theoretical = computed(() => derived.value.items.find(item => item.id === selectedItem.value?.id)?.finalMainSize ?? null)

// 观测尚未产生时保持 null，不用 0 冒充
const actual = computed(() => {
  const record = measured.value?.items.find(item => item.id === selectedItem.value?.id)
  return record ? (isRowDirection(state.container.direction) ? record.width : record.height) : null
})

const diagnostic = computed(() => selectedItem.value ? byId.value.get(selectedItem.value.id) ?? null : null)
</script>

<template>
  <div data-testid="derivation">
    <p v-if="!selectedItem" data-testid="derivation-empty" class="text-xs op-60">
      点击演示区里的任意盒子，看它的尺寸是怎么算出来的
    </p>

    <table v-else class="w-full text-xs font-mono">
      <thead class="op-60">
        <tr>
          <th class="whitespace-nowrap py-1 pr-3 text-left font-normal">
            步骤
          </th>
          <th class="py-1 pr-3 text-left font-normal">
            公式
          </th>
          <th class="py-1 pr-3 text-left font-normal">
            代入
          </th>
          <th class="whitespace-nowrap py-1 text-right font-normal">
            结果
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index" data-testid="derivation-row" class="border-t border-bd">
          <td data-testid="step-label" class="whitespace-nowrap py-1 pr-3 font-sans">
            {{ row.label }}
          </td>
          <td data-testid="step-formula" class="py-1 pr-3 font-sans op-70">
            {{ row.formula }}
          </td>
          <td data-testid="step-substitution" class="py-1 pr-3">
            {{ row.substitution }}
          </td>
          <td data-testid="step-result" class="whitespace-nowrap py-1 text-right">
            {{ row.result }}
          </td>
        </tr>
        <tr data-testid="derivation-actual" class="border-t border-bd">
          <td class="whitespace-nowrap py-1 pr-3 font-sans">
            实际
          </td>
          <td class="py-1 pr-3 font-sans op-70">
            浏览器排版
          </td>
          <td class="py-1 pr-3" />
          <td class="whitespace-nowrap py-1 text-right">
            {{ actual === null ? '—' : px(actual) }}<template v-if="!diagnostic && actual !== null && theoretical !== null">
              ✓
            </template>
          </td>
        </tr>
        <tr v-if="diagnostic" data-testid="derivation-diagnosis">
          <td colspan="4" class="py-1 font-sans">
            <DiagnosisText :diagnostic="diagnostic" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
