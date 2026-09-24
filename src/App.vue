<script setup lang="ts">
useShareUrl()
</script>

<template>
  <!-- 只在宽屏锁死整页：窄屏塌成一栏后一屏放不下，锁死等于把下半页切掉 -->
  <div class="min-h-full flex flex-col font-sans lg:h-full lg:overflow-hidden">
    <!-- 只给上内边距：下方留白由 Playground 的 p-space 承担，两边都写会叠成两份 -->
    <header class="mx-auto max-w-480 w-full flex shrink-0 items-center justify-between px-space pt-space">
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
        <!-- icon 画的是「点下去会变成什么」：按钮的语义是动作 -->
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
