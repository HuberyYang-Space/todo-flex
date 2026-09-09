import { describe, expect, it } from 'vitest'
import { useOverlay } from './useOverlay'

describe('useOverlay', () => {
  it('叠加层默认开着', () => {
    expect(useOverlay().visible.value).toBe(true)
  })

  it('是模块级单例，两次调用拿到同一份状态', () => {
    const first = useOverlay()
    const second = useOverlay()

    first.toggleVisible()
    expect(second.visible.value).toBe(false)

    second.toggleVisible()
    expect(first.visible.value).toBe(true)
  })

  it('记录当前悬停的盒子，移开时清空', () => {
    const { hoveredId, setHovered } = useOverlay()

    setHovered('item-2')
    expect(hoveredId.value).toBe('item-2')

    setHovered(null)
    expect(hoveredId.value).toBeNull()
  })
})
