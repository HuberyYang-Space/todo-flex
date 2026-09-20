<script setup lang="ts">
import ThePlayground from '~/components/playground/ThePlayground.vue'

// 布局状态持续写回地址栏，随时可以复制链接把当前画面分享出去
useShareUrl()
</script>

<template>
  <!--
    宽屏下整页锁死不滚（lg:h-full + lg:overflow-hidden）：调属性要滚的是左边的操作区，
    演示区必须一直钉在视野里，用户不该为了改一个属性把它滚出去。
    窄屏不锁——两栏塌成一栏后一屏放不下，锁死等于把下半页永久切掉。
  -->
  <div class="min-h-full flex flex-col font-sans lg:h-full lg:overflow-hidden">
    <header class="mx-auto max-w-480 w-full flex shrink-0 items-center justify-between p-4">
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
