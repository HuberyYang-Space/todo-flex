import { describe, expect, it } from 'vitest'
import { useStageView } from './useStageView'

describe('useStageView', () => {
  it('默认开启 3D 视图', () => {
    expect(useStageView().is3D.value).toBe(true)
  })

  it('是模块级单例，两次调用拿到同一份状态', () => {
    const first = useStageView()
    const second = useStageView()

    first.toggle3D()
    expect(second.is3D.value).toBe(false)

    second.toggle3D()
    expect(first.is3D.value).toBe(true)
  })
})
