import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
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

    expect(wrapper.find('[data-testid="css-code"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="metrics"]').exists()).toBe(true)
  })

  it('明细区随演示区一起呈现，每个盒子一行', () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.find('[data-testid="metrics"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="metrics-row"]')).toHaveLength(3)
  })

  it('拖拽手柄改变演示区尺寸，一路生效到演示区的真实样式', async () => {
    const wrapper = mount(ThePlayground)
    await wrapper.get('[data-testid="stage-resizer"]').trigger('pointerdown', { clientX: 0, clientY: 0 })
    const move = Object.assign(new Event('pointermove'), { clientX: 10, clientY: 0 })
    window.dispatchEvent(move)
    window.dispatchEvent(new Event('pointerup'))
    await wrapper.vm.$nextTick()

    expect(useFlexState().state.container.width).toBe(730)
    expect(wrapper.get('[data-testid="stage"]').attributes('style')).toContain('width: 730px')
    wrapper.unmount()
  })

  // 打开别人的链接时第一眼看的是演示区，提示要挨着它，不能藏进操作区或 CSS 栏
  it('分享链接被拒的提示挂在演示区面板里：标题行之后、演示区之前', () => {
    useFlexState().shareIssue.value = 'content'
    const wrapper = mount(ThePlayground)

    const notice = wrapper.get('[data-testid="share-notice"]').element
    const stage = wrapper.get('[data-testid="stage"]').element
    expect(notice.previousElementSibling?.textContent).toContain('演示区')
    expect(notice.parentElement?.contains(stage)).toBe(true)
    expect(notice.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    useFlexState().shareIssue.value = null
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
   * 留白已由 .stage-wrapper 的 --overhang 承担，滚动容器再写一份只会白缩可视范围。
   * 只能读源码断言：UnoCSS 原子类在 happy-dom 里不生成真实样式值，computed style 恒为 0。
   */
  it('演示区滚动容器不再叠加内边距，留白只由 stage-wrapper 的 overhang 承担', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/playground/ThePlayground.vue'), 'utf-8')
    const scroller = /<div class="([^"]*overflow-auto[^"]*)">\s*<DemoStage\s*\/>/.exec(src)
    expect(scroller, '没找到包着 DemoStage 的滚动容器').toBeTruthy()

    // p-2 / p-space / lg:p-4 都算，四向与单向的内边距类一个都不许有
    const padding = scroller![1]
      .split(/\s+/)
      .filter(token => /^(?:lg:)?p[trblxy]?-/.test(token))

    expect(padding, `滚动容器不该再带内边距：${padding.join(' ')}`).toHaveLength(0)
  })

  /*
   * 整页不滚、只有各栏内部滚：flex 子项的 min-height 默认是 auto，中间漏一级 min-h-0 整页就重新开始滚。
   * 同上，只能读源码断言。
   */
  it('整页不滚动的滚动链一层不缺', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf-8')
    const playground = readFileSync(resolve(process.cwd(), 'src/components/playground/ThePlayground.vue'), 'utf-8')

    // 都带 lg: 前缀是有意的：窄屏塌成一栏后一屏放不下，必须退回普通文档流滚动
    const appRoot = /<div class="([^"]*)"[^>]*>\s*(?:<!--[\s\S]*?-->\s*)?<header/.exec(app)
    expect(appRoot, '没找到 App.vue 的根容器').toBeTruthy()
    expect(appRoot![1], 'App 根容器要占满视口高度').toMatch(/(?:^|\s)lg:h-full(?:\s|$)/)
    expect(appRoot![1], '宽屏下整页不得滚动').toMatch(/(?:^|\s)lg:overflow-hidden(?:\s|$)/)

    const pgRoot = /<div class="([^"]*)"[^>]*>\s*<aside/.exec(playground)
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

    // 第三列的链条独立于中列：栏本身要能被压到行高以下，栏里的滚动区还得吃满剩余高度
    const cssColumn = /<CssOutput class="([^"]*)"/.exec(playground)
    expect(cssColumn, '没找到右侧 CSS 栏').toBeTruthy()
    expect(cssColumn![1], 'CSS 栏缺 min-h-0，长 CSS 会把整行顶高').toMatch(/(?:^|\s)lg:min-h-0(?:\s|$)/)

    const cssOutput = readFileSync(resolve(process.cwd(), 'src/components/playground/CssOutput.vue'), 'utf-8')
    const cssScroller = /<div class="([^"]*overflow-auto[^"]*)">/.exec(cssOutput)
    expect(cssScroller, '没找到 CSS 面板里的滚动容器').toBeTruthy()
    expect(cssScroller![1], 'CSS 滚动容器要吃满面板的剩余高度').toMatch(/(?:^|\s)flex-1(?:\s|$)/)
    expect(cssScroller![1], 'CSS 滚动容器缺 min-h-0，滚动条会跑到外层去').toMatch(/(?:^|\s)min-h-0(?:\s|$)/)
  })

  /*
   * 窗口收窄时右侧 CSS 栏不能被顶出视口：`1fr` 的下限是 min-content，演示区的 min-content 会冒到 grid 轨道上，
   * 所以轨道得写 minmax(0, 1fr)，grid 项自己也得 min-w-0，两者缺一不可。
   * min-w-0 不能带 lg: 前缀：塌成一栏后同一个 min-content 会把整页撑宽，视口 390 时页面 810 宽。
   * happy-dom 不排版，量不出 min-content，只能读源码断言。
   */
  it('中间列能被压缩，窄窗口下右侧 CSS 栏不会被顶出视口', () => {
    const playground = readFileSync(resolve(process.cwd(), 'src/components/playground/ThePlayground.vue'), 'utf-8')

    const pgRoot = /<div class="([^"]*)"[^>]*>\s*<aside/.exec(playground)
    expect(pgRoot, '没找到 ThePlayground 的根容器').toBeTruthy()

    const cols = /lg:grid-cols-\[([^\]]+)\]/.exec(pgRoot![1])
    expect(cols, `根容器上没找到三列栅格：${pgRoot![1]}`).toBeTruthy()

    const tracks = cols![1].split('_')
    expect(tracks, `期望三条轨道，实际是 ${cols![1]}`).toHaveLength(3)
    expect(
      tracks[1],
      `中间列写成了 ${tracks[1]}。裸 1fr 等价于 minmax(auto, 1fr)，`
      + '它的下限是演示区那 808px 的 min-content，窗口一窄右侧 CSS 栏就被顶出视口并被裁掉',
    ).toBe('minmax(0,1fr)')

    const main = /<main class="([^"]*)"/.exec(playground)
    expect(main, '没找到右侧 main').toBeTruthy()
    expect(
      main![1],
      'main 缺不带前缀的 min-w-0：轨道让开了，grid 项自己的自动最小尺寸仍会把它撑到 min-content；只写 lg: 的话窄屏整页被撑宽',
    ).toMatch(/(?:^|\s)min-w-0(?:\s|$)/)
  })

  /*
   * 全站只有两档间距，且一律由父级 gap 承担：子元素再带 margin，边界处就是两份间距相加。
   * 只查竖向节奏用得上的 gap / mb / mt / space-y / p；px-* 与 py-* 是控件自己的内边距，不在此列。
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
