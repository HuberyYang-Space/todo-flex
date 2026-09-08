<script setup lang="ts">
import { MAX_ITEMS, useFlexState } from '~/composables/useFlexState'
import { itemLabel } from '~/core/labels'

const { state, addItem, removeItem, selectItem } = useFlexState()
</script>

<template>
  <section>
    <header class="mb-2 flex items-center justify-between">
      <h2 class="text-sm font-bold">
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

    <ul class="flex flex-col gap-1">
      <li
        v-for="(item, index) in state.items"
        :key="item.id"
        data-testid="item-row"
        class="flex cursor-pointer items-center justify-between border border-bd rounded-1 px-2 py-1 text-xs"
        :class="{ 'border-accent text-accent': state.selectedId === item.id }"
        @click="selectItem(item.id)"
      >
        <span class="font-mono">{{ itemLabel(index) }} · flex: {{ item.grow }} {{ item.shrink }} {{ item.basis }}</span>
        <button
          data-testid="remove-item"
          class="op-60 hover:op-100"
          :disabled="state.items.length <= 1"
          @click.stop="removeItem(item.id)"
        >
          删除
        </button>
      </li>
    </ul>
  </section>
</template>
