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
      上内边距也走 --space，和下方那份同源——两边各写各的数，
      总有一天会被单独调走一个，标题就又不对称了。
    -->
    <header class="mx-auto max-w-480 w-full flex shrink-0 items-center justify-between px-space pt-space">
      <!-- 主副标题同一行，基线对齐而不是居中对齐：两者字号差一截，居中会让副标题看着往上飘 -->
      <div class="flex items-baseline gap-space">
        <h1 class="text-lg font-bold font-mono">
          todo-flex
        </h1>
        <p class="text-xs op-60">
          看得见的 CSS Flexbox
        </p>
      </div>

      <div class="flex items-center gap-tight">
        <a
          data-testid="repo-link"
          class="icon-btn"
          href="https://github.com/HuberyYang-Space/todo-flex"
          target="_blank"
          rel="noopener noreferrer"
          title="在 GitHub 上查看源码"
          aria-label="在 GitHub 上查看源码"
        >
          <div class="i-carbon-logo-github" />
        </a>
        <!--
          icon 画的是「点下去会变成什么」而不是「现在是什么」：按钮的语义是动作。
          纯 icon 按钮对读屏器是哑的，title 与 aria-label 不能省。
        -->
        <button
          data-testid="theme-toggle"
          class="icon-btn"
          :title="isDark ? '切换到亮色' : '切换到暗色'"
          :aria-label="isDark ? '切换到亮色' : '切换到暗色'"
          @click="toggleDark()"
        >
          <div :class="isDark ? 'i-carbon-sun' : 'i-carbon-moon'" />
        </button>
      </div>
    </header>

    <ThePlayground />
  </div>
</template>
