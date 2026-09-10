import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useFlexState } from './useFlexState'
import { useShareUrl } from './useShareUrl'

describe('useShareUrl', () => {
  let stop: (() => void) | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    useFlexState().resetState()
  })

  afterEach(() => {
    stop?.()
    stop = undefined
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /** 改一次状态，然后把防抖窗口走完 */
  async function change(mutate: () => void) {
    mutate()
    await nextTick()
    await vi.advanceTimersByTimeAsync(500)
  }

  it('状态变化后把短码写进地址栏', async () => {
    const replace = vi.spyOn(globalThis.history, 'replaceState')
    stop = useShareUrl()

    await change(() => {
      useFlexState().state.container.direction = 'column'
    })

    expect(replace).toHaveBeenCalledWith(null, '', expect.stringContaining('flex.column.'))
  })

  it('用 replaceState 写入，不往 history 里塞记录', async () => {
    const push = vi.spyOn(globalThis.history, 'pushState')
    vi.spyOn(globalThis.history, 'replaceState')
    stop = useShareUrl()

    await change(() => {
      useFlexState().state.container.rowGap = 24
    })

    expect(push).not.toHaveBeenCalled()
  })

  it('连续改动只写一次，拖拽容器时不会把地址栏刷爆', async () => {
    const replace = vi.spyOn(globalThis.history, 'replaceState')
    stop = useShareUrl()

    // 模拟拖拽手柄：一串高频的宽度变化
    for (const width of [300, 360, 420, 480, 540]) {
      useFlexState().state.container.width = width
      await nextTick()
    }
    await vi.advanceTimersByTimeAsync(500)

    expect(replace).toHaveBeenCalledOnce()
    expect(replace).toHaveBeenCalledWith(null, '', expect.stringContaining('.540.'))
  })

  it('停掉之后不再写地址栏', async () => {
    const replace = vi.spyOn(globalThis.history, 'replaceState')
    stop = useShareUrl()
    stop()
    stop = undefined

    await change(() => {
      useFlexState().state.container.direction = 'column'
    })

    expect(replace).not.toHaveBeenCalled()
  })
})
