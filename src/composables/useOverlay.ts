import { ref } from 'vue'

/**
 * 叠加层的显隐是纯 UI 偏好，刻意不放进 FlexState——
 * M6 的 URL 短码只该携带布局状态，分享出去的链接不必带上「对方要不要看色块」。
 */
const visible = ref(true)

/** 当前鼠标悬停的盒子，决定尺寸 HUD 显示在谁头上 */
const hoveredId = ref<string | null>(null)

function setHovered(id: string | null): void {
  hoveredId.value = id
}

function toggleVisible(): void {
  visible.value = !visible.value
}

/** 全站唯一的叠加层 UI 状态 */
export function useOverlay() {
  return { visible, hoveredId, setHovered, toggleVisible }
}
