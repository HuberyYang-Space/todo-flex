<script setup lang="ts">
defineProps<{ headers: [string, string, string, string] }>()
</script>

<template>
  <!-- table-fixed 让四列按表头均分，不随内容伸缩：两个页签切换时竖线位置不动 -->
  <!-- 不用 border-collapse：collapse 下边框归表格统一画，吸顶的表头只带走背景，竖线和上下两条横线留在原地跟着表体滚走 -->
  <table class="compare-table w-full border-separate border-spacing-0 table-fixed text-xs font-mono">
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
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 0.25rem 0.5rem;
  text-align: start;
  vertical-align: top;
  overflow-wrap: anywhere;
}

/* 分离模型下相邻单元格的边框不再合并，每格只画右、下两边，外框的左、上两边单独补 */
.compare-table :deep(:is(th, td):first-child) {
  border-left: 1px solid var(--border);
}

.compare-table th {
  border-top: 1px solid var(--border);
  position: sticky;
  top: 0;
  /* 单元格的 op-* 会建层叠上下文，不抬一层的话表体文字滚上来会盖住表头 */
  z-index: 1;
  background: color-mix(in srgb, var(--fg) 7%, var(--panel));
}
</style>
