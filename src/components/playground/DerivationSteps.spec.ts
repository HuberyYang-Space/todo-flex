import type { FlexItemState, MeasuredStage } from '~/core/types'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultItem } from '~/core/defaults'
import DerivationSteps from './DerivationSteps.vue'

function setItems(specs: Partial<FlexItemState>[]): void {
  const { state } = useFlexState()
  state.items = specs.map((spec, index) => ({ ...createDefaultItem(`item-${index + 1}`), ...spec }))
}

function measureAll(widths: number[]): MeasuredStage {
  const { state } = useFlexState()
  return {
    width: state.container.width,
    height: state.container.height,
    items: state.items.map((item, index) => ({ id: item.id, width: widths[index], height: state.container.height, left: 0, top: 0 })),
  }
}

function table(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid="derivation-row"]').map(row => ({
    label: row.get('[data-testid="step-label"]').text(),
    substitution: row.get('[data-testid="step-substitution"]').text(),
    result: row.get('[data-testid="step-result"]').text(),
  }))
}

/** 默认容器 720、gap 12：A 30% = 216，剩余 720 − 516 − 24 = 180，A 与 B 各分一半 */
function growScenario(): void {
  setItems([{ basis: '30%', grow: 1 }, { basis: '150px', grow: 1 }, { basis: '150px' }])
  useFlexState().selectItem('item-1')
}

describe('derivationSteps', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useMeasure().measured.value = null
  })

  it('没有选中盒子时提示怎么用', () => {
    const wrapper = mount(DerivationSteps)
    expect(wrapper.get('[data-testid="derivation-empty"]').text()).toContain('点击演示区里的任意盒子')
  })

  it('伸展场景逐行给出代入与结果', () => {
    growScenario()
    const wrapper = mount(DerivationSteps)

    expect(table(wrapper)).toEqual([
      { label: 'basis', substitution: '30% × 720', result: '216px' },
      { label: '本行剩余', substitution: '720 − (216 + 150 + 150) − 2 × 12', result: '180px' },
      { label: 'grow 分配', substitution: '1 ÷ 2 × 180', result: '90px' },
      { label: '理论最终', substitution: '216 + 90', result: '306px' },
    ])
  })

  it('收缩有冻结时，冻结那一轮点名盒子并给出剩下的溢出', () => {
    const { state } = useFlexState()
    state.container.width = 110
    state.container.columnGap = 0
    setItems([{ basis: '10px', shrink: 10 }, { basis: '300px' }])
    useFlexState().selectItem('item-1')
    const wrapper = mount(DerivationSteps)

    expect(table(wrapper)).toContainEqual({ label: '冻结第 1 轮', substitution: '盒子 A 应让 −50，basis 只有 10', result: '溢出剩 −190px' })
    expect(table(wrapper).at(-1)).toEqual({ label: '理论最终', substitution: '10 − 10', result: '0px' })
  })

  it('别的盒子的 basis 要到运行期才能确定时，点名它并停下', () => {
    setItems([{ basis: '100px' }, { basis: '10vw' }])
    useFlexState().selectItem('item-1')
    const wrapper = mount(DerivationSteps)

    expect(wrapper.text()).toContain('盒子 B 的 basis 要到运行期才能确定')
    expect(wrapper.text()).not.toContain('理论最终')
  })

  it('还没有观测结果时实际行留空位，不打勾', () => {
    growScenario()
    const wrapper = mount(DerivationSteps)

    expect(wrapper.get('[data-testid="derivation-actual"]').text()).toContain('—')
    expect(wrapper.get('[data-testid="derivation-actual"]').text()).not.toContain('✓')
  })

  it('理论与实际一致时打勾', async () => {
    growScenario()
    useMeasure().measured.value = measureAll([306, 240, 150])
    const wrapper = mount(DerivationSteps)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="derivation-actual"]').text()).toContain('306px ✓')
    expect(wrapper.find('[data-testid="derivation-diagnosis"]').exists()).toBe(false)
  })

  it('对不上时在末行下方写出诊断', async () => {
    const { state } = useFlexState()
    state.container.width = 300
    setItems([{ basis: '300px', size: 240 }, { basis: '300px' }])
    useFlexState().selectItem('item-1')
    useMeasure().measured.value = measureAll([240, 144])
    const wrapper = mount(DerivationSteps)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="derivation-actual"]').text()).not.toContain('✓')
    expect(wrapper.get('[data-testid="derivation-diagnosis"]').text()).toContain('min-width:auto')
  })

  it('停在推导页时改属性，表格跟着变', async () => {
    growScenario()
    const wrapper = mount(DerivationSteps)
    useFlexState().state.items[2].grow = 1
    await wrapper.vm.$nextTick()

    expect(table(wrapper)).toContainEqual({ label: 'grow 分配', substitution: '1 ÷ 3 × 180', result: '60px' })
  })

  it('选中的盒子被删掉后回到空状态', async () => {
    growScenario()
    const wrapper = mount(DerivationSteps)
    useFlexState().removeItem('item-1')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="derivation-empty"]').exists()).toBe(true)
  })
})
