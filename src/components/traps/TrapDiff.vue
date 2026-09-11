<script setup lang="ts">
import type { CONTAINER_KEYS, ITEM_KEYS } from '~/core/trapPatch'
import type { PropertyDiff } from '~/core/types'
import { computed } from 'vue'
import { itemLabel } from '~/core/labels'

/**
 * 归因拍的属性差异表：把「到底改了哪一行」摆出来。
 *
 * 数据来自 `diffStates()` 两份完整状态相减，不是手写的——
 * 手写的文案会跟实际渲染悄悄脱节，而这张表恰恰是用来取信于人的。
 */
const props = defineProps<{ diffs: PropertyDiff[] }>()

/** 折叠后的一行：scope/key/from/to 全同、只有 itemIndex 不同的差异合并到一起 */
interface DiffRow {
  rowKey: string
  scopeLabel: string
  key: string
  from: string
  to: string
}

/**
 * 把「三个盒子同一属性发生同样变化」的三条差异折成一行。
 *
 * `diffStates()` 逐条吐出「盒子 A 的 basis 从 auto 变成 0」「盒子 B 的……」是正确的契约——
 * core 不管展示（见该函数的注释）。但盒子一多，同一次改动会被拆成好几条一模一样的行，
 * 反而把「一个简写背后是三个属性」这类教学话稀释掉，所以折叠放在这一层做，
 * `diffStates` 本身不动。
 */
const rows = computed<DiffRow[]>(() => {
  const groups = new Map<string, PropertyDiff[]>()

  for (const diff of props.diffs) {
    const groupKey = `${diff.scope}|${diff.key}|${diff.from}|${diff.to}`
    const group = groups.get(groupKey)
    if (group)
      group.push(diff)
    else
      groups.set(groupKey, [diff])
  }

  return [...groups.entries()].map(([groupKey, diffs]) => ({
    rowKey: groupKey,
    key: diffs[0].key,
    from: diffs[0].from,
    to: diffs[0].to,
    scopeLabel: mergedScopeLabel(diffs),
  }))
})

/**
 * 差异表可能遇到的全部字段名。直接从推导层那两份清单派生——
 * 将来给容器或盒子加字段时，这里漏一条会**编译报错**，
 * 而不是等到界面上露出 `alignSelf` 这种内部字段名才被发现。
 */
type DiffKey = typeof CONTAINER_KEYS[number] | typeof ITEM_KEYS[number]

/** 内部字段名 → 用户认得的 CSS 属性名 */
const KEY_LABELS: Record<DiffKey, string> = {
  display: 'display',
  direction: 'flex-direction',
  wrap: 'flex-wrap',
  justifyContent: 'justify-content',
  alignItems: 'align-items',
  alignContent: 'align-content',
  rowGap: 'row-gap',
  columnGap: 'column-gap',
  width: '容器宽度',
  height: '容器高度',
  grow: 'flex-grow',
  shrink: 'flex-shrink',
  basis: 'flex-basis',
  order: 'order',
  alignSelf: 'align-self',
  size: '内容尺寸',
  minWidthAuto: 'min-width',
  marginAuto: 'margin',
}

/** 带像素单位的字段。只关心展示，不参与任何计算 */
const PX_KEYS = new Set(['width', 'height', 'rowGap', 'columnGap', 'size'])

function keyLabel(key: string): string {
  return KEY_LABELS[key as DiffKey] ?? key
}

/**
 * 值翻译成人话。
 * `minWidthAuto` / `marginAuto` 在状态里是布尔，但用户看到的 CSS 是 `auto` 与 `0`——
 * 直接把 true/false 摆出来，这张表就白做了。
 */
function valueLabel(key: string, raw: string): string {
  if (key === 'minWidthAuto' || key === 'marginAuto')
    return raw === 'true' ? 'auto' : '0'
  if (PX_KEYS.has(key))
    return `${raw}px`
  return raw
}

/** 合并后一行的作用域标签。同一行可能对应多个盒子，用「/」并列列出 */
function mergedScopeLabel(diffs: PropertyDiff[]): string {
  if (diffs[0].scope === 'container')
    return '容器'
  return `盒子 ${diffs.map(diff => itemLabel(diff.itemIndex ?? 0)).join(' / ')}`
}
</script>

<template>
  <ul class="flex flex-col gap-1 text-xs font-mono">
    <li
      v-for="row in rows"
      :key="row.rowKey"
      data-testid="trap-diff-row"
      class="flex flex-wrap items-center gap-2 rounded-2 bg-panel px-2 py-1"
    >
      <span class="op-60">{{ row.scopeLabel }}</span>
      <span class="font-bold">{{ keyLabel(row.key) }}</span>
      <span class="line-through op-60">{{ valueLabel(row.key, row.from) }}</span>
      <span class="op-40">→</span>
      <span class="text-accent font-bold">{{ valueLabel(row.key, row.to) }}</span>
    </li>
  </ul>
</template>
