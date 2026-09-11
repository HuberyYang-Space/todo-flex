import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createDefaultState } from '~/core/defaults'
import TrapStage from './TrapStage.vue'

describe('trapStage', () => {
  it('按状态里的盒子数量渲染', () => {
    const state = createDefaultState()

    const wrapper = mount(TrapStage, { props: { state } })

    expect(wrapper.findAll('[data-testid="trap-stage-item"]')).toHaveLength(3)
  })

  it('容器样式来自状态，不做任何位置计算', () => {
    const state = createDefaultState()
    state.container.direction = 'column'
    state.container.justifyContent = 'space-between'
    state.container.width = 480

    const wrapper = mount(TrapStage, { props: { state } })
    const style = wrapper.get('[data-testid="trap-stage"]').attributes('style')

    expect(style).toContain('flex-direction: column')
    expect(style).toContain('justify-content: space-between')
    expect(style).toContain('width: 480px')
  })

  it('盒子样式带上 flex 三件套与 order', () => {
    const state = createDefaultState()
    state.items[0].grow = 2
    state.items[0].shrink = 0
    state.items[0].basis = '120px'
    state.items[0].order = 3

    const wrapper = mount(TrapStage, { props: { state } })
    const style = wrapper.findAll('[data-testid="trap-stage-item"]')[0].attributes('style')

    expect(style).toContain('flex-grow: 2')
    expect(style).toContain('flex-shrink: 0')
    expect(style).toContain('flex-basis: 120px')
    expect(style).toContain('order: 3')
  })

  it('关掉自动最小尺寸时，写的是主轴方向上的那一个', () => {
    const state = createDefaultState()
    state.items[0].minWidthAuto = false

    const row = mount(TrapStage, { props: { state } })
    expect(row.findAll('[data-testid="trap-stage-item"]')[0].attributes('style')).toContain('min-width: 0px')

    state.container.direction = 'column'
    const column = mount(TrapStage, { props: { state } })
    expect(column.findAll('[data-testid="trap-stage-item"]')[0].attributes('style')).toContain('min-height: 0px')
  })

  it('开着 margin: auto 的盒子写上 margin', () => {
    const state = createDefaultState()
    state.items[1].marginAuto = true

    const wrapper = mount(TrapStage, { props: { state } })

    expect(wrapper.findAll('[data-testid="trap-stage-item"]')[1].attributes('style')).toContain('margin: auto')
    expect(wrapper.findAll('[data-testid="trap-stage-item"]')[0].attributes('style')).not.toContain('margin: auto')
  })

  it('内容占位块撑出主轴方向上的内容尺寸', () => {
    const state = createDefaultState()
    state.items[0].size = 320

    const wrapper = mount(TrapStage, { props: { state } })

    expect(wrapper.findAll('.trap-content')[0].attributes('style')).toContain('width: 320px')
  })

  it('盒子标签与 Playground 用同一套命名', () => {
    const wrapper = mount(TrapStage, { props: { state: createDefaultState() } })

    expect(wrapper.findAll('[data-testid="trap-stage-item"]').map(item => item.text())).toEqual(['A', 'B', 'C'])
  })

  it('props 变化时跟着重新渲染', async () => {
    const wrapper = mount(TrapStage, { props: { state: createDefaultState() } })
    const next = createDefaultState()
    next.container.justifyContent = 'center'

    await wrapper.setProps({ state: next })

    expect(wrapper.get('[data-testid="trap-stage"]').attributes('style')).toContain('justify-content: center')
  })
})
