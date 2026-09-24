/** 纯 UI 偏好，刻意不放进 FlexState：分享链接只该携带布局状态 */
const visible = ref(true)

const hoveredId = ref<string | null>(null)

function setHovered(id: string | null): void {
  hoveredId.value = id
}

function toggleVisible(): void {
  visible.value = !visible.value
}

export function useOverlay() {
  return { visible, hoveredId, setHovered, toggleVisible }
}
