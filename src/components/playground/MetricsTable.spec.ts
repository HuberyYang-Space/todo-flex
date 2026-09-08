import type { MeasuredStage } from '~/core/types'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import { useMeasure } from '~/composables/useMeasure'
import MetricsTable from './MetricsTable.vue'

/** 默认状态：容器 720、三个盒子 basis auto、内容尺寸 80，grow 为 0，所以理论尺寸都是 80 */
function measureAll(widths: number[]): MeasuredStage {
  const { state } = useFlexState()
  return {
    width: state.container.width,
    height: state.container.height,
    items: state.items.map((item, index) => ({
      id: item.id,
      width: widths[index],
      height: state.container.height,
      left: 0,
      top: 0,
    })),
  }
}

function rows(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid="metrics-row"]')
}

describe('metricsTable', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useMeasure().measured.value = null
  })

  it('每个盒子渲染一行，标签与演示区一致', () => {
    const wrapper = mount(MetricsTable)

    expect(rows(wrapper)).toHaveLength(3)
    expect(rows(wrapper)[0].text()).toContain('A')
    expect(rows(wrapper)[2].text()).toContain('C')
  })

  it('展示推导出的理论主轴尺寸', () => {
    const wrapper = mount(MetricsTable)

    expect(rows(wrapper)[0].get('[data-testid="theoretical"]').text()).toBe('80px')
  })

  it('还没有观测结果时实际列留空位，不报错也不假装有值', () => {
    const wrapper = mount(MetricsTable)

    expect(rows(wrapper)[0].get('[data-testid="actual"]').text()).toBe('—')
    expect(rows(wrapper)[0].get('[data-testid="diagnosis"]').text()).toBe('—')
  })

  it('理论与实际一致时标记为通过', async () => {
    useMeasure().measured.value = measureAll([80, 80, 80])
    const wrapper = mount(MetricsTable)
    await wrapper.vm.$nextTick()

    expect(rows(wrapper)[0].get('[data-testid="actual"]').text()).toBe('80px')
    expect(rows(wrapper)[0].get('[data-testid="diagnosis"]').text()).toContain('✓')
  })

  it('min-width:auto 撑住下限时，那一行给出中文解释', async () => {
    const { state } = useFlexState()
    // 容器 300、两项 basis 各 300：理论上应各缩到 144（含 12px gap），
    // 但 A 的内容固有尺寸是 240，min-width:auto 不让它继续缩
    state.container.width = 300
    state.items = state.items.slice(0, 2)
    for (const item of state.items)
      item.basis = '300px'
    state.items[0].size = 240

    useMeasure().measured.value = measureAll([240, 144])
    const wrapper = mount(MetricsTable)
    await wrapper.vm.$nextTick()

    const diagnosis = rows(wrapper)[0].get('[data-testid="diagnosis"]').text()
    expect(diagnosis).toContain('min-width')
    expect(diagnosis).not.toContain('✓')
  })

  it('margin:auto 吃掉剩余空间时给出提示，而不是报成尺寸偏差', async () => {
    // 默认态：容器 720、三个盒子各 80、两道 12px 间隙 → 剩余 456
    useFlexState().state.items[0].marginAuto = true
    useMeasure().measured.value = measureAll([80, 80, 80])

    const wrapper = mount(MetricsTable)
    await wrapper.vm.$nextTick()

    const diagnosis = rows(wrapper)[0].get('[data-testid="diagnosis"]').text()
    expect(diagnosis).toContain('margin:auto')
    expect(diagnosis).toContain('456px')
    expect(diagnosis).not.toContain('⚠')
  })

  it('增删盒子后行数同步', async () => {
    const wrapper = mount(MetricsTable)

    useFlexState().addItem()
    await wrapper.vm.$nextTick()

    expect(rows(wrapper)).toHaveLength(4)
  })
})
