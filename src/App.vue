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
    <!--
      只给上内边距不给下内边距：下方留白由 Playground 的 p-space 承担，
      两边都写的话标题下面会叠成两份间距，看起来就是「标题上下不一样宽」。
    -->
    <header class="mx-auto max-w-480 w-full flex shrink-0 items-center justify-between px-space pt-space">
      <div>
        <h1 class="text-lg font-bold font-mono">
          todo-flex
        </h1>
        <p class="text-xs op-60">
          看得见的 CSS Flexbox
        </p>
      </div>
      <!--
        icon 画的是「点下去会变成什么」而不是「现在是什么」：按钮的语义是动作。
        纯 icon 按钮对读屏器是哑的，title 与 aria-label 不能省。
      -->
      <button
        data-testid="theme-toggle"
        class="flex btn items-center text-xs"
        :title="isDark ? '切换到亮色' : '切换到暗色'"
        :aria-label="isDark ? '切换到亮色' : '切换到暗色'"
        @click="toggleDark()"
      >
        <div :class="isDark ? 'i-carbon-sun' : 'i-carbon-moon'" />
      </button>
    </header>

    <ThePlayground />
  </div>
</template>
