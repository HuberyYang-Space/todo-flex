import { ref } from 'vue'

/**
 * 3D 视图开关。与 useOverlay 同定位：属于 UI 偏好，刻意不进 FlexState——
 * M6 的 URL 短码只该携带布局状态。
 *
 * 关掉它是给截图与教学场景兜底：倾角与厚度归零，回到纯平面。
 */
const is3D = ref(true)

function toggle3D(): void {
  is3D.value = !is3D.value
}

export function useStageView() {
  return { is3D, toggle3D }
}
