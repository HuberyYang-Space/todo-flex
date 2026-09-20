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

  it('同时渲染操作区、演示区与 CSS 输出', async () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.find('[data-testid="stage"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('容器属性')
    expect(wrapper.text()).toContain('盒子属性')

    // CSS 输出挪进了检视面板的第二个标签，默认不渲染
    await wrapper.get('[data-testid="inspector-tab-css"]').trigger('click')
    expect(wrapper.find('[data-testid="css-code"]').exists()).toBe(true)
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

  /*
   * 这条守卫钉的是「整页不滚动，只有操作区和检视面板内部滚」这个布局前提。
   *
   * flex 子项的 min-height 默认是 auto——内容多高它就多高，不肯被父容器压缩。
   * 所以从锁死滚动的那一层到真正该滚的那一层之间，中间每一级都得写 min-h-0，
   * 漏掉任何一级，多出来的高度就会一路顶到 body 上，整页重新开始滚，
   * 用户为了调属性又得把演示区滚出视野——这次改版要消灭的正是这件事。
   *
   * 与上面那条同理，只能读源码断言：UnoCSS 是原子类，happy-dom 里不生成真实样式值。
   */
  it('整页不滚动的滚动链一层不缺', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf-8')
    const playground = readFileSync(resolve(process.cwd(), 'src/components/playground/ThePlayground.vue'), 'utf-8')

    /*
     * 每一条都带 lg: 前缀，是有意的：窄屏两栏塌成一栏，一屏根本放不下，
     * 高度锁死只会把内容永久切掉，所以窄屏必须退回普通文档流滚动。
     */
    const appRoot = /<div class="([^"]*)"[^>]*>\s*<header/.exec(app)
    expect(appRoot, '没找到 App.vue 的根容器').toBeTruthy()
    expect(appRoot![1], 'App 根容器要占满视口高度').toMatch(/(?:^|\s)lg:h-full(?:\s|$)/)
    expect(appRoot![1], '宽屏下整页不得滚动').toMatch(/(?:^|\s)lg:overflow-hidden(?:\s|$)/)

    const pgRoot = /<div class="([^"]*)"[^>]*>\s*<!-- 操作区 -->/.exec(playground)
    expect(pgRoot, '没找到 ThePlayground 的根容器').toBeTruthy()
    expect(pgRoot![1], 'Playground 要吃满 header 之外的剩余高度').toMatch(/(?:^|\s)lg:flex-1(?:\s|$)/)
    expect(pgRoot![1], 'Playground 根容器缺 min-h-0，高度会顶破父级').toMatch(/(?:^|\s)lg:min-h-0(?:\s|$)/)

    const aside = /<aside class="([^"]*)"/.exec(playground)
    expect(aside, '没找到操作区 aside').toBeTruthy()
    expect(aside![1], '操作区必须自己滚，而不是把页面撑长').toMatch(/(?:^|\s)lg:overflow-y-auto(?:\s|$)/)
    expect(aside![1], '操作区缺 min-h-0，滚动条会跑到外层去').toMatch(/(?:^|\s)lg:min-h-0(?:\s|$)/)

    const main = /<main class="([^"]*)"/.exec(playground)
    expect(main, '没找到右侧 main').toBeTruthy()
    expect(main![1], '右列缺 min-h-0，演示区就压不下来').toMatch(/(?:^|\s)lg:min-h-0(?:\s|$)/)

    const stagePanel = /<div class="([^"]*\bpanel\b[^"]*)"/.exec(playground)
    expect(stagePanel, '没找到演示区面板').toBeTruthy()
    expect(stagePanel![1], '演示区面板要吃满右列的剩余高度').toMatch(/(?:^|\s)lg:flex-1(?:\s|$)/)
    expect(stagePanel![1], '演示区面板缺 min-h-0，里面的滚动容器就压不下来').toMatch(/(?:^|\s)lg:min-h-0(?:\s|$)/)

    const scroller = /<div class="([^"]*overflow-auto[^"]*)">\s*<DemoStage\s*\/>/.exec(playground)!
    expect(scroller[1], '演示区滚动容器要吃满面板的剩余高度').toMatch(/(?:^|\s)lg:flex-1(?:\s|$)/)
    expect(scroller[1], '演示区滚动容器缺 min-h-0，超高的演示区会把面板顶破').toMatch(/(?:^|\s)lg:min-h-0(?:\s|$)/)
  })
})
