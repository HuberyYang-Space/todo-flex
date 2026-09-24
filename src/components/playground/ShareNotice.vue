<script setup lang="ts">
import type { ShareIssue } from '~/core/urlCodec'

const { shareIssue, dismissShareIssue } = useFlexState()

const reasonText: Record<ShareIssue, string> = {
  version: '这条分享链接来自无法识别的版本',
  missing: '这条分享链接缺少参数',
  content: '这条分享链接里有无法解析的值',
}
</script>

<template>
  <div
    v-if="shareIssue"
    data-testid="share-notice"
    role="status"
    class="flex shrink-0 items-center gap-tight border border-accent2 rounded-1 px-2 py-1 text-xs"
  >
    <div class="i-carbon-warning-alt shrink-0 text-accent2" />
    <span class="flex-1">{{ reasonText[shareIssue] }}，已显示默认状态</span>
    <button
      data-testid="share-notice-close"
      type="button"
      class="icon-btn"
      aria-label="关闭提示"
      title="关闭提示"
      @click="dismissShareIssue()"
    >
      <div class="i-carbon-close" />
    </button>
  </div>
</template>
