import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { useMeasure } from '~/composables/useMeasure'
import { useStageView } from '~/composables/useStageView'
import { motion } from '~/visual/motion'
import DemoStage from './DemoStage.vue'

describe('demoStage', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('按状态渲染出对应数量的盒子', () => {
    const wrapper = mount(DemoStage)
    expect(wrapper.findAll('[data-testid="stage-item"]')).toHaveLength(3)
  })

  it('容器样式直接来自状态，保证是真实 CSS 渲染', () => {
    const { state } = useFlexState()
    state.container.direction = 'column'
    state.container.justifyContent = 'space-between'
    const wrapper = mount(DemoStage)
    const style = wrapper.get('[data-testid="stage"]').attributes('style')!
    expect(style).toContain('flex-direction: column')
    expect(style).toContain('justify-content: space-between')
  })

  it('盒子样式写出 flex 三个分量', () => {
    const { state } = useFlexState()
    state.items[0].grow = 2
    state.items[0].basis = '120px'
    const wrapper = mount(DemoStage)
    const style = wrapper.findAll('[data-testid="stage-item"]')[0].attributes('style')!
    expect(style).toContain('flex-grow: 2')
    expect(style).toContain('flex-basis: 120px')
  })

  it('关闭 min-width:auto 时写入 min-width: 0px', () => {
    const { state } = useFlexState()
    state.items[0].minWidthAuto = false
    const wrapper = mount(DemoStage)
    expect(wrapper.findAll('[data-testid="stage-item"]')[0].attributes('style')).toContain('min-width: 0px')
  })

  it('点击盒子会选中它', async () => {
    const wrapper = mount(DemoStage)
    await wrapper.findAll('[data-testid="stage-item"]')[1].trigger('click')
    expect(useFlexState().state.selectedId).toBe('item-2')
  })

  it('选中的盒子带 is-selected 标记', async () => {
    const wrapper = mount(DemoStage)
    useFlexState().selectItem('item-3')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-testid="stage-item"]')[2].classes()).toContain('is-selected')
  })

  it('回车键与点击等价，保证键盘可达', async () => {
    const wrapper = mount(DemoStage)
    await wrapper.findAll('[data-testid="stage-item"]')[0].trigger('keydown.enter')
    expect(useFlexState().state.selectedId).toBe('item-1')
  })

  it('把归一化厚度换算成 CSS 变量写到盒子上', async () => {
    const { state } = useFlexState()
    state.items[0].grow = 1
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const el = wrapper.findAll('[data-testid="stage-item"]')[0].element as HTMLElement
    // 720 - 240 - 24 = 456 全给第一个盒子；期望值从 token 推导，调参不该改测试
    const expected = `${Math.round(456 / 720 * motion.maxDepth * 10) / 10}px`
    expect(el.style.getPropertyValue('--elev')).toBe(expected)
    expect(el.style.getPropertyValue('--thickness')).toBe(expected)
  })

  it('shrink 让出空间时抬升为负、厚度仍为正', async () => {
    const { state } = useFlexState()
    state.container.width = 200
    for (const item of state.items)
      item.minWidthAuto = false
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const el = wrapper.findAll('[data-testid="stage-item"]')[0].element as HTMLElement
    expect(el.style.getPropertyValue('--elev').startsWith('-')).toBe(true)
    expect(el.style.getPropertyValue('--thickness').startsWith('-')).toBe(false)
  })

  it('3D 视图下场景带俯视倾角', () => {
    const wrapper = mount(DemoStage)
    expect(wrapper.get('[data-testid="scene"]').attributes('style')).toContain(`rotateX(${motion.tiltDeg}deg)`)
  })

  it('平面视图下倾角与厚度一起归零', async () => {
    const { state } = useFlexState()
    state.items[0].grow = 1
    const wrapper = mount(DemoStage)
    useStageView().toggle3D()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="scene"]').attributes('style')).toContain('rotateX(0deg)')
    const el = wrapper.findAll('[data-testid="stage-item"]')[0].element as HTMLElement
    expect(el.style.getPropertyValue('--elev')).toBe('0px')

    useStageView().toggle3D()
  })

  it('挂载后把演示区接入观测层', async () => {
    useMeasure().measured.value = null

    mount(DemoStage, { attachTo: document.body })
    await nextTick()

    // happy-dom 不排版，数字全是 0；这里验证的是接线，不是尺寸
    const ids = useMeasure().measured.value?.items.map(item => item.id)
    expect(ids).toEqual(['item-1', 'item-2', 'item-3'])
  })
})
