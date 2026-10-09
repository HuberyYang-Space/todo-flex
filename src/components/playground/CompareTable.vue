<script setup lang="ts">
defineProps<{ headers: [string, string, string, string] }>()
</script>

<template>
  <!-- table-fixed 让四列按表头均分，不随内容伸缩：两个页签切换时竖线位置不动 -->
  <table class="compare-table w-full border-collapse table-fixed text-xs font-mono">
    <thead>
      <tr>
        <th v-for="header in headers" :key="header" class="font-normal">
          <span class="op-60">{{ header }}</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <slot />
    </tbody>
  </table>
</template>

<style scoped>
/* 行由调用方经插槽传入，单元格样式只能从这里统一下发 */
.compare-table :deep(:is(th, td)) {
  border: 1px solid var(--border);
  padding: 0.25rem 0.5rem;
  text-align: start;
  vertical-align: top;
  overflow-wrap: anywhere;
}
</style>
