<script setup lang="ts">
import { useFlexState } from '~/composables/useFlexState'
import { MAX_ITEMS } from '~/core/constants'
import { itemLabel } from '~/core/labels'

const { state, addItem, removeItem, selectItem } = useFlexState()
</script>

<template>
  <section class="flex flex-col gap-space">
    <header class="flex items-center justify-between">
      <h2 class="panel-title">
        <div class="i-carbon-list-boxes" />
        盒子（{{ state.items.length }}/{{ MAX_ITEMS }}）
      </h2>
      <button
        data-testid="add-item"
        class="btn text-xs"
        :disabled="state.items.length >= MAX_ITEMS"
        @click="addItem()"
      >
        新增
      </button>
    </header>

    <ul class="flex flex-col gap-tight">
      <li
        v-for="(item, index) in state.items"
        :key="item.id"
        class="flex items-center justify-between border border-bd rounded-1 text-xs"
        :class="{ 'border-accent text-accent': state.selectedId === item.id }"
      >
        <!-- 内边距写在按钮上而不是 li 上：写在 li 上，整行边框里有四成面积点了没反应 -->
        <button
          data-testid="item-row"
          type="button"
          class="flex-1 cursor-pointer bg-transparent px-2 py-1 text-left color-inherit font-mono"
          :aria-pressed="state.selectedId === item.id"
          @click="selectItem(item.id)"
        >
          {{ itemLabel(index) }} · flex: {{ item.grow }} {{ item.shrink }} {{ item.basis }}
        </button>
        <button
          data-testid="remove-item"
          type="button"
          class="px-2 py-1 op-60 disabled:cursor-not-allowed disabled:op-30 hover:op-100"
          :disabled="state.items.length <= 1"
          :aria-label="`删除盒子 ${itemLabel(index)}`"
          @click="removeItem(item.id)"
        >
          删除
        </button>
      </li>
    </ul>
  </section>
</template>
