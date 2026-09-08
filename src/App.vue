<script setup lang="ts">
// 骨架占位：真实页面结构在 spec 定稿后按实现计划逐步替换
</script>

<template>
  <main class="h-full flex flex-col items-center justify-center gap-4 font-mono">
    <h1 class="text-2xl">
      todo-flex
    </h1>
    <p class="op-60">
      看得见的 CSS Flexbox
    </p>
    <button class="btn" @click="toggleDark()">
      {{ isDark ? 'dark' : 'light' }}
    </button>
  </main>
</template>
