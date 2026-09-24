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

  it('理论值无法静态推导时，理论列留空，只在起因那一行说明，其余不冒充通过', async () => {
    useFlexState().state.items[0].basis = 'calc(10% + 1px)'
    useMeasure().measured.value = measureAll([73, 80, 80])

    const wrapper = mount(MetricsTable)
    await wrapper.vm.$nextTick()
    const [culprit, bystander] = rows(wrapper)

    expect(culprit.get('[data-testid="theoretical"]').text()).toBe('—')
    expect(culprit.get('[data-testid="diagnosis"]').text()).toContain('ℹ')
    expect(culprit.get('[data-testid="diagnosis"]').text()).toContain('运行')
    expect(bystander.get('[data-testid="theoretical"]').text()).toBe('—')
    expect(bystander.get('[data-testid="diagnosis"]').text()).toBe('—')
  })

  // 真实 Chrome：A 的内容 150 被 min-width:auto 兜住后 C 被挤到下一行，B、C 的尺寸都是跟着换行重新分出来的
  async function mountWithShiftedLineBreak() {
    const { state } = useFlexState()
    Object.assign(state.container, { width: 300, wrap: 'wrap', columnGap: 0, rowGap: 0 })
    for (const item of state.items)
      Object.assign(item, { basis: '100px', grow: 1, size: 20 })
    state.items[0].size = 150
    useMeasure().measured.value = {
      width: 300,
      height: 200,
      items: [
        { id: 'item-1', left: 0, top: 0, width: 150, height: 100 },
        { id: 'item-2', left: 150, top: 0, width: 150, height: 100 },
        { id: 'item-3', left: 0, top: 100, width: 300, height: 100 },
      ],
    }

    const wrapper = mount(MetricsTable)
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('换行位置与推导不同时，说清是换行变了，不误报成尺寸被截断', async () => {
    const wrapper = await mountWithShiftedLineBreak()
    const texts = rows(wrapper).map(row => row.get('[data-testid="diagnosis"]').text())

    expect(texts[0]).toContain('撑到了内容尺寸')
    expect(texts[1]).toContain('换行位置与推导不同')
    expect(texts[2]).toContain('换行位置与推导不同')
    expect(texts.join('')).not.toContain('截断')
  })

  // 连字符是断行机会：窄列里 min-width:auto 会被拆成「min-」与「width:auto」两行
  it('诊断文案里的 CSS 属性名整体不断行', async () => {
    const wrapper = await mountWithShiftedLineBreak()
    const unbreakable = rows(wrapper)[1].get('[data-testid="diagnosis"]').findAll('.whitespace-nowrap').map(span => span.text())

    expect(unbreakable).toEqual(['min-width:auto'])
  })

  it('增删盒子后行数同步', async () => {
    const wrapper = mount(MetricsTable)

    useFlexState().addItem()
    await wrapper.vm.$nextTick()

    expect(rows(wrapper)).toHaveLength(4)
  })
})
