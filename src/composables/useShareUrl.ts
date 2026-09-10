import { encode } from '~/core/urlCodec'
import { useFlexState } from './useFlexState'

/**
 * 写回地址栏的防抖窗口（ms）。
 * 拖拽演示区手柄时宽高每帧都在变，不防抖就是每帧一次 replaceState——
 * 部分浏览器对它有频率限制（Safari 超量直接抛错），而且毫无意义。
 */
const WRITE_DELAY = 300

/**
 * 把布局状态持续写回地址栏，让当前画面随时可以复制链接分享出去。
 *
 * 一律用 `replaceState`：这是「当前状态的镜像」而不是一次导航，
 * 用 pushState 的话调属性调十次、后退键就要按十次才出得去。
 *
 * 返回停止函数。在组件 setup 里调用时 watch 会跟着组件作用域自动回收，
 * 这个返回值是给测试和将来可能的手动关闭用的。
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
