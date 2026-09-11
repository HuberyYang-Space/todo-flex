<script setup lang="ts">
import type { CONTAINER_KEYS, ITEM_KEYS } from '~/core/trapPatch'
import type { PropertyDiff } from '~/core/types'
import { itemLabel } from '~/core/labels'

/**
 * 归因拍的属性差异表：把「到底改了哪一行」摆出来。
 *
 * 数据来自 `diffStates()` 两份完整状态相减，不是手写的——
 * 手写的文案会跟实际渲染悄悄脱节，而这张表恰恰是用来取信于人的。
 */
defineProps<{ diffs: PropertyDiff[] }>()

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

function scopeLabel(diff: PropertyDiff): string {
  return diff.scope === 'container' ? '容器' : `盒子 ${itemLabel(diff.itemIndex ?? 0)}`
}
</script>

<template>
  <ul class="flex flex-col gap-1 text-xs font-mono">
    <li
      v-for="diff in diffs"
      :key="`${diff.scope}-${diff.itemIndex ?? ''}-${diff.key}`"
      data-testid="trap-diff-row"
      class="flex flex-wrap items-center gap-2 rounded-2 bg-panel px-2 py-1"
    >
      <span class="op-60">{{ scopeLabel(diff) }}</span>
      <span class="font-bold">{{ keyLabel(diff.key) }}</span>
      <span class="line-through op-60">{{ valueLabel(diff.key, diff.from) }}</span>
      <span class="op-40">→</span>
      <span class="text-accent font-bold">{{ valueLabel(diff.key, diff.to) }}</span>
    </li>
  </ul>
</template>
