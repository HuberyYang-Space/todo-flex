import { readdirSync, readFileSync } from 'node:fs'
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

  it('操作区、演示区、明细、CSS 四块同屏常驻，不用先点一下才出来', () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.find('[data-testid="stage"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('容器属性')
    expect(wrapper.text()).toContain('盒子属性')

    // CSS 从原来的标签页挪到了独立的右栏，和明细表同时可见
    expect(wrapper.find('[data-testid="css-code"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="metrics"]').exists()).toBe(true)
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

    expect(scroller![1], `滚动容器要走全局间距 p-space：${scroller![1]}`).toMatch(/(?:^|\s)p-space(?:\s|$)/)

    // p-space 解析成 var(--space)，所以真正要守的阈值在 main.css 那个变量上
    const css = readFileSync(resolve(process.cwd(), 'src/styles/main.css'), 'utf-8')
    const space = /--space:\s*(\d+)px/.exec(css)
    expect(space, 'main.css 里没有 --space').toBeTruthy()
    expect(Number(space![1])).toBeGreaterThanOrEqual(motion.blockDepth)
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
    const appRoot = /<div class="([^"]*)"[^>]*>\s*(?:<!--[\s\S]*?-->\s*)?<header/.exec(app)
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

    /*
     * 第三列（CSS）的链条独立于中列，断在哪一级都是整页重新开始滚：
     * 栏本身要能被压到行高以下，栏里的滚动区还得自己吃满剩余高度。
     */
    const cssColumn = /<CssOutput class="([^"]*)"/.exec(playground)
    expect(cssColumn, '没找到右侧 CSS 栏').toBeTruthy()
    expect(cssColumn![1], 'CSS 栏缺 min-h-0，长 CSS 会把整行顶高').toMatch(/(?:^|\s)lg:min-h-0(?:\s|$)/)

    const cssOutput = readFileSync(resolve(process.cwd(), 'src/components/playground/CssOutput.vue'), 'utf-8')
    const cssScroller = /<div class="([^"]*overflow-auto[^"]*)">/.exec(cssOutput)
    expect(cssScroller, '没找到 CSS 面板里的滚动容器').toBeTruthy()
    expect(cssScroller![1], 'CSS 滚动容器要吃满面板的剩余高度').toMatch(/(?:^|\s)lg:flex-1(?:\s|$)/)
    expect(cssScroller![1], 'CSS 滚动容器缺 min-h-0，滚动条会跑到外层去').toMatch(/(?:^|\s)lg:min-h-0(?:\s|$)/)

    /*
     * 这两个类必须带 lg: 前缀，不带就是一个实际踩到的缺陷：窄屏下面板高度由内容决定，
     * 此时 `flex: 1 1 0%` 配上显式 min-height: 0，这层的假设主尺寸算出来是 0，
     * 外层 overflow-hidden 再一裁——整个代码块在窄屏上凭空消失，而宽屏下一切正常。
     * 上面两条 toMatch 只认得「有没有」，认不出「带不带前缀」，所以这里单独钉死。
     */
    expect(
      cssScroller![1],
      `CSS 滚动容器的 flex-1 / min-h-0 不带 lg: 前缀，窄屏下代码块会塌成 0 高度：${cssScroller![1]}`,
    ).not.toMatch(/(?:^|\s)(?:flex-1|min-h-0)(?:\s|$)/)
  })

  /*
   * 这条守卫钉的是「全站只有两档间距」。
   *
   * 统一之前模块间距有四档（16 / 16 / 12 / 20），而且 margin 与 gap 混用：
   * 字段各自带 margin-bottom，外层再叠一层 gap，边界处就是两份间距相加，
   * 于是「分节之间」看起来远宽于「字段之间」——那不是设计意图，是叠加的副产物。
   * 一旦有人再写回一个硬编码的 gap-4 / mb-2，这份对齐立刻又散掉，而且散得很不显眼。
   *
   * 只查竖向节奏用得上的那几个属性：gap / mb / mt / space-y / p。
   * px-* 与 py-* 是控件自己的内边距（列表行、文本框），不参与模块之间的节奏，不在此列。
   */
  it('模块间距只走 --space / --space-tight，没有硬编码的数值类', () => {
    const files = [
      'src/App.vue',
      ...readdirSync(resolve(process.cwd(), 'src/components/playground'))
        .filter(name => name.endsWith('.vue'))
        .map(name => `src/components/playground/${name}`),
    ]

    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf-8')
      // 贪婪匹配到最后一个 </template>：组件里的 <template v-if> 会让非贪婪版本提前收尾，
      // 那之后的模板就再也扫不到了（ItemControls 正是这种写法）
      const template = /<template>([\s\S]*)<\/template>/.exec(src)?.[1] ?? ''
      // 取捕获组而不是整段匹配：整段带着 class=" 和收尾的引号，首尾两个类名会被漏掉
      for (const [, cls] of template.matchAll(/class="([^"]*)"/g)) {
        for (const token of cls.split(/\s+/)) {
          if (/^(?:lg:)?(?:gap|gap-x|gap-y|mb|mt|space-y|p)-\d+$/.test(token))
            offenders.push(`${file}: ${token}`)
        }
      }
    }

    expect(offenders, `这些地方绕开了全局间距变量：\n${offenders.join('\n')}`).toEqual([])
  })
})
