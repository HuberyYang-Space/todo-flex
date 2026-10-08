import type { MeasuredStage } from '~/core/types'
import { beforeEach, describe, expect, it } from 'vitest'

function measureAll(widths: number[]): MeasuredStage {
  const { state } = useFlexState()
  return {
    width: state.container.width,
    height: state.container.height,
    items: state.items.map((item, index) => ({ id: item.id, width: widths[index], height: state.container.height, left: 0, top: 0 })),
  }
}

describe('useDiagnostics', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useMeasure().measured.value = null
  })

  it('明细表与推导页拿到的是同一份计算结果', () => {
    expect(useDiagnostics().byId).toBe(useDiagnostics().byId)
  })

  it('还没有观测结果时没有诊断', () => {
    expect(useDiagnostics().byId.value.size).toBe(0)
  })

  it('按盒子 id 取诊断，并给出中文文案', () => {
    const { state } = useFlexState()
    state.container.width = 300
    state.items = state.items.slice(0, 2)
    for (const item of state.items)
      item.basis = '300px'
    state.items[0].size = 240
    useMeasure().measured.value = measureAll([240, 144])

    const { byId, textOf } = useDiagnostics()
    const diagnostic = byId.value.get(state.items[0].id)!
    expect(diagnostic.rule).toBe('min-width-auto')
    expect(textOf(diagnostic)).toContain('min-width:auto')
  })
})
