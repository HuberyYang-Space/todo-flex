<script setup lang="ts">
import ThePlayground from '~/components/playground/ThePlayground.vue'

// 布局状态持续写回地址栏，随时可以复制链接把当前画面分享出去
useShareUrl()
</script>

<template>
  <div class="min-h-full font-sans">
    <header class="mx-auto max-w-360 w-full flex items-center justify-between p-4">
      <div>
        <h1 class="text-lg font-bold font-mono">
          todo-flex
        </h1>
        <p class="text-xs op-60">
          看得见的 CSS Flexbox
        </p>
      </div>
      <button class="btn text-xs" @click="toggleDark()">
        {{ isDark ? '暗色' : '亮色' }}
      </button>
    </header>

    <ThePlayground />
  </div>
</template>
