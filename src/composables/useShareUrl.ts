import { encode } from '~/core/urlCodec'
import { useFlexState } from './useFlexState'

/** 拖手柄时宽高每帧都变，不防抖 Safari 会因 replaceState 超频直接抛错 */
const WRITE_DELAY = 300

/**
 * 用 `replaceState` 而不是 `pushState`：这是当前状态的镜像而不是一次导航，
 * 否则调十次属性要按十次后退键才出得去。
 */
export function useShareUrl(): () => void {
  const { state } = useFlexState()

  return watchDebounced(
    state,
    () => {
      history.replaceState(null, '', encode(state))
    },
    { deep: true, debounce: WRITE_DELAY },
  )
}
