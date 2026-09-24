import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { readSfcStyle } from '~/test/sfcStyle'
import { motion } from '~/visual/motion'
import DemoStage from './DemoStage.vue'

describe('demoStage', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  // align-items 默认 stretch，盒子顶边贴着容器上沿，余量不够时每次悬停都会被外层滚动容器切掉顶面
  it('悬停时伸出去的量有足够余量兜住', () => {
    const 悬停时伸出 = motion.blockDepth * motion.blockDepthHover + motion.liftHeight
    expect(motion.stageOverhang).toBeGreaterThanOrEqual(悬停时伸出)
  })

  it('余量以 --overhang 下发给演示区外层，CSS 才拿得到这个数', () => {
    const wrapper = mount(DemoStage)
    expect(wrapper.get('.stage-wrapper').attributes('style')).toContain(`--overhang: ${motion.stageOverhang}px`)
  })

  it('盒子对辅助技术暴露为可按下的按钮，空格键与回车一样能选中', async () => {
    const wrapper = mount(DemoStage)
    const items = wrapper.findAll('[data-testid="stage-item"]')

    for (const item of items) {
      expect(item.attributes('role')).toBe('button')
      expect(item.attributes('aria-label')).toBeTruthy()
    }

    await items[1].trigger('keydown', { key: ' ' })
    expect(useFlexState().state.selectedId).toBe('item-2')
    expect(items[1].attributes('aria-pressed')).toBe('true')
    expect(items[0].attributes('aria-pressed')).toBe('false')
  })

  // 推导引擎只拿到根字号：演示区把字号钉在 1rem、盒子自己不改，em 才与 rem 同值
  it('演示区的 em 与 rem 同值', () => {
    const stage = readSfcStyle('src/components/playground/DemoStage.vue')

    expect(stage.decl('.stage', 'font-size')).toBe('1rem')
    expect(() => stage.decl('.stage-item', 'font-size')).toThrow()
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

  it('挂载后把演示区接入观测层', async () => {
    useMeasure().measured.value = null

    mount(DemoStage, { attachTo: document.body })
    await nextTick()

    // happy-dom 不排版，数字全是 0；这里验证的是接线，不是尺寸
    const ids = useMeasure().measured.value?.items.map(item => item.id)
    expect(ids).toEqual(['item-1', 'item-2', 'item-3'])
  })

  it('厚度默认取上限', async () => {
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const box = wrapper.get('[data-testid="stage-item"] .stage-box').element as HTMLElement
    expect(box.style.getPropertyValue('--d')).toBe(`${motion.blockDepth}px`)
  })

  it('gap 收窄时厚度跟着收，避免侧面压到邻居', async () => {
    const { state } = useFlexState()
    state.container.columnGap = 6
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const box = wrapper.get('[data-testid="stage-item"] .stage-box').element as HTMLElement
    expect(box.style.getPropertyValue('--d')).toBe('4px')
  })

  it('gap 为 0 时厚度收到下限而不是消失', async () => {
    const { state } = useFlexState()
    state.container.columnGap = 0
    state.container.rowGap = 0
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const box = wrapper.get('[data-testid="stage-item"] .stage-box').element as HTMLElement
    expect(box.style.getPropertyValue('--d')).toBe(`${motion.blockDepthMin}px`)
  })

  it('column 方向改看 rowGap，因为顶面是往上伸的', async () => {
    const { state } = useFlexState()
    state.container.direction = 'column'
    state.container.rowGap = 6
    state.container.columnGap = 40
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const box = wrapper.get('[data-testid="stage-item"] .stage-box').element as HTMLElement
    expect(box.style.getPropertyValue('--d')).toBe('4px')
  })
})
