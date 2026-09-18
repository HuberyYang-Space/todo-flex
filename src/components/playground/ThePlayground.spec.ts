import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import { useFlip } from '~/composables/useFlip'
import { useOverlay } from '~/composables/useOverlay'
import { motion } from '~/visual/motion'
import ThePlayground from './ThePlayground.vue'

describe('thePlayground', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('同时渲染操作区、演示区与 CSS 输出', () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.find('[data-testid="stage"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="css-code"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('容器属性')
    expect(wrapper.text()).toContain('盒子属性')
  })

  it('明细区随演示区一起呈现，每个盒子一行', () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.find('[data-testid="metrics"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="metrics-row"]')).toHaveLength(3)
  })

  it('拖拽手柄的键盘微调改变演示区尺寸', async () => {
    const wrapper = mount(ThePlayground)
    await wrapper.get('[data-testid="stage-resizer"]').trigger('keydown', { key: 'ArrowRight', shiftKey: true })

    expect(useFlexState().state.container.width).toBe(730)
    expect(wrapper.get('[data-testid="stage"]').attributes('style')).toContain('width: 730px')
  })

  it('叠加层开关能收起整层', async () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.find('[data-testid="overlay-toggle"]').exists()).toBe(true)

    await wrapper.get('[data-testid="overlay-toggle"]').trigger('change')
    expect(useOverlay().visible.value).toBe(false)

    // 单例状态跨用例共享，改回去免得影响后面的用例
    useOverlay().toggleVisible()
  })

  it('在演示区选中盒子后，属性面板切换到该盒子', async () => {
    const wrapper = mount(ThePlayground)
    await wrapper.findAll('[data-testid="stage-item"]')[1].trigger('click')
    expect(wrapper.get('[data-testid="item-title"]').text()).toContain('item-2')
    expect(wrapper.find('[data-testid="item-empty"]').exists()).toBe(false)
  })

  it('拖动手柄期间抑制动画，松手后恢复', async () => {
    const wrapper = mount(ThePlayground)

    await wrapper.get('[data-testid="stage-resizer"]').trigger('pointerdown', { clientX: 0, clientY: 0 })
    expect(useFlip().scrubbing.value).toBe(true)

    window.dispatchEvent(new Event('pointerup'))
    await wrapper.vm.$nextTick()
    expect(useFlip().scrubbing.value).toBe(false)
  })

  it('重置按钮恢复默认状态', async () => {
    const { state } = useFlexState()
    state.container.direction = 'column'
    const wrapper = mount(ThePlayground)
    await wrapper.get('[data-testid="reset"]').trigger('click')
    expect(state.container.direction).toBe('row')
  })

  /*
   * 这条守卫钉的是「滚动容器的内边距必须容得下伸出去的顶面」。
   *
   * 起因是浏览器实测：顶面往上伸 10px，而滚动容器只有 p-2（8px），
   * 顶面上沿 2px 被裁掉。align-items 默认 stretch，盒子顶边必然贴着容器上沿，
   * 所以这个裁切每次都发生，不是边界情况。
   *
   * 只能读源码断言：padding 是 UnoCSS 的原子类，happy-dom 里不会生成真实样式值，
   * 挂载后量 computed style 恒为 0，测不出来。
   */
  it('演示区滚动容器的内边距容得下伸出去的顶面', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/playground/ThePlayground.vue'), 'utf-8')
    const scroller = /<div class="([^"]*overflow-auto[^"]*)">\s*<DemoStage\s*\/>/.exec(src)
    expect(scroller, '没找到包着 DemoStage 的滚动容器').toBeTruthy()

    const pad = /(?:^|\s)p-(\d+)(?:\s|$)/.exec(scroller![1])
    expect(pad, `滚动容器缺少 p-* 内边距：${scroller![1]}`).toBeTruthy()

    // UnoCSS 默认 spacing 基数 4px（实测 p-2 === 8px）
    expect(Number(pad![1]) * 4).toBeGreaterThanOrEqual(motion.blockDepth)
  })
})
