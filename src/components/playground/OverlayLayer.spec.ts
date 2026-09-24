import type { MeasuredStage } from '~/core/types'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { readSfcStyle } from '~/test/sfcStyle'
import DemoStage from './DemoStage.vue'
import OverlayLayer from './OverlayLayer.vue'

/** happy-dom 不排版，实测值全是 0——这里伪造一份观测结果来驱动几何 */
function fakeMeasured(): MeasuredStage {
  return {
    width: 400,
    height: 200,
    items: [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
      { id: 'item-2', left: 112, top: 0, width: 100, height: 200 },
      { id: 'item-3', left: 224, top: 0, width: 100, height: 200 },
    ],
  }
}

describe('overlayLayer', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useFlexState().state.container.width = 400
    useFlexState().state.container.height = 200
    const { visible, setHovered } = useOverlay()
    visible.value = true
    setHovered(null)
    useMeasure().measured.value = fakeMeasured()
  })

  it('把行尾空白画成剩余空间色块', () => {
    const wrapper = mount(OverlayLayer)
    const bands = wrapper.findAll('[data-testid="overlay-band"]')
    expect(bands).toHaveLength(1)
    expect(bands[0].attributes('data-kind')).toBe('free')
    expect(bands[0].attributes('width')).toBe('76')
  })

  it('行尾的色块按流向挂上反向斜纹的类名', () => {
    const wrapper = mount(OverlayLayer)
    const band = wrapper.find('[data-testid="overlay-band"]')
    expect(band.classes()).toContain('band-free--x-reverse')
  })

  it('盒子被推到末尾时，行首的色块改挂正向斜纹', () => {
    useMeasure().measured.value = {
      width: 400,
      height: 200,
      items: [{ id: 'item-1', left: 300, top: 0, width: 100, height: 200 }],
    }
    const wrapper = mount(OverlayLayer)
    const band = wrapper.find('[data-testid="overlay-band"]')
    expect(band.classes()).toContain('band-free--x-forward')
  })

  it('column 下色块改挂垂直轴的类名，不看色块自己是宽是高', () => {
    useFlexState().state.container.direction = 'column'
    // 720×56 的宽扁横条：形状读着像横向流，流动轴其实是垂直的
    useMeasure().measured.value = {
      width: 720,
      height: 320,
      items: [{ id: 'item-1', left: 0, top: 0, width: 720, height: 264 }],
    }
    const wrapper = mount(OverlayLayer)
    const band = wrapper.find('[data-testid="overlay-band"]')
    expect(Number(band.attributes('width'))).toBeGreaterThan(Number(band.attributes('height')))
    expect(band.classes()).toContain('band-free--y-reverse')
  })

  // 类名接不到 fill 的话，<rect> 退回 SVG 默认的 fill: black，整块剩余空间画成黑矩形
  it('四份斜纹各自闭合：类名 → fill → pattern，轴与流向不许错配', () => {
    const wrapper = mount(OverlayLayer)
    const overlay = readSfcStyle('src/components/playground/OverlayLayer.vue')

    for (const axis of ['x', 'y']) {
      for (const flow of ['forward', 'reverse']) {
        const id = `overlay-stripes-${axis}-${flow}`
        expect(wrapper.find(`#${id}`).exists()).toBe(true)
        expect(overlay.decl(`.band-free--${axis}-${flow}`, 'fill')).toBe(`url(#${id})`)
      }
    }
  })

  it('斜纹的不透明度只由 CSS 给，<line> 上不写 stroke-opacity 属性——属性跟不上 html.dark', () => {
    const lines = mount(OverlayLayer).findAll('pattern line')

    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines)
      expect(line.attributes('stroke-opacity')).toBeUndefined()
  })

  it('垂直轴的 pattern 把纹路转 90° 变成水平纹路', () => {
    const wrapper = mount(OverlayLayer)
    expect(wrapper.find('#overlay-stripes-x-forward').attributes('patternTransform')).toBeUndefined()
    expect(wrapper.find('#overlay-stripes-y-forward').attributes('patternTransform')).toBe('rotate(90)')
  })

  it('关掉开关后整层不渲染', async () => {
    const wrapper = mount(OverlayLayer)
    useOverlay().visible.value = false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(false)
  })

  it('还没有观测结果时不渲染，不用 0 冒充', async () => {
    useMeasure().measured.value = null
    const wrapper = mount(OverlayLayer)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(false)
  })

  it('轴向箭头随 direction 翻转', async () => {
    const wrapper = mount(OverlayLayer)
    const horizontal = wrapper.get('[data-testid="overlay-axis-main"]')
    expect(Number(horizontal.attributes('x2'))).toBeGreaterThan(Number(horizontal.attributes('x1')))

    useFlexState().state.container.direction = 'row-reverse'
    await wrapper.vm.$nextTick()
    const reversed = wrapper.get('[data-testid="overlay-axis-main"]')
    expect(Number(reversed.attributes('x2'))).toBeLessThan(Number(reversed.attributes('x1')))
  })

  it('悬停盒子时冒出尺寸 HUD，移开就收起', async () => {
    const wrapper = mount(OverlayLayer)
    expect(wrapper.find('[data-testid="overlay-hud"]').exists()).toBe(false)

    useOverlay().setHovered('item-2')
    await wrapper.vm.$nextTick()
    const hud = wrapper.get('[data-testid="overlay-hud"]')
    expect(hud.text()).toContain('100')

    useOverlay().setHovered(null)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="overlay-hud"]').exists()).toBe(false)
  })

  it('没有悬停时 HUD 跟着选中的盒子', async () => {
    const wrapper = mount(OverlayLayer)
    useFlexState().selectItem('item-3')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="overlay-hud"]').text()).toContain('100')
  })

  it('溢出时画出越界标记', async () => {
    useMeasure().measured.value = {
      width: 400,
      height: 200,
      items: [{ id: 'item-1', left: 0, top: 0, width: 480, height: 200 }],
    }
    const { state } = useFlexState()
    state.items.splice(1)

    const wrapper = mount(OverlayLayer)
    await wrapper.vm.$nextTick()

    const bands = wrapper.findAll('[data-testid="overlay-band"]')
    expect(bands).toHaveLength(1)
    expect(bands[0].attributes('data-kind')).toBe('overflow')
  })

  // 色块沉到盒子下面，HUD 跟着沉下去就会被它要标注的盒子挡住，所以两层分开
  it('hUD 与色块分属两层，HUD 不在沉底的那一层里', async () => {
    const wrapper = mount(OverlayLayer)
    useOverlay().setHovered('item-2')
    await wrapper.vm.$nextTick()

    const under = wrapper.get('[data-testid="overlay"]')
    expect(under.find('[data-testid="overlay-band"]').exists()).toBe(true)
    expect(under.find('[data-testid="overlay-hud"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="overlay-hud"]').exists()).toBe(true)

    // 光是「分成两层」不够：两层各自挂对 class，下面那条 z-index 守卫才管得住它们
    expect(under.classes()).toContain('overlay--under')
    expect(wrapper.get('[data-testid="overlay-hud-layer"]').classes()).toContain('overlay--over')
  })

  it('层序写死在样式里：色块低于盒子，HUD 高于盒子', () => {
    const overlay = readSfcStyle('src/components/playground/OverlayLayer.vue')
    const stage = readSfcStyle('src/components/playground/DemoStage.vue')

    const 色块层 = Number(overlay.decl('.overlay--under', 'z-index'))
    const HUD层 = Number(overlay.decl('.overlay--over', 'z-index'))
    const 盒子 = Number(stage.decl('.stage-item', 'z-index'))

    // 样式表里有 .stage-item { z-index } 不等于盒子真挂着这个类——两层叠加层那边已经断言过元素侧，盒子这边也要
    // 用完即卸：DemoStage 会挂上观测，活到下一个用例就会把共享的 measured 覆盖成 happy-dom 的全零
    const stageWrapper = mount(DemoStage)
    const items = stageWrapper.findAll('[data-testid="stage-item"]')
    expect(items.length).toBeGreaterThan(0)
    for (const item of items)
      expect(item.classes()).toContain('stage-item')
    stageWrapper.unmount()

    expect(色块层, '色块层没沉到盒子下面').toBeLessThan(盒子)
    expect(HUD层, 'HUD 没浮在盒子上面').toBeGreaterThan(盒子)
  })

  function measuredWithWideGap(): MeasuredStage {
    // 三个盒子各 40 宽，行尾空出 400 - 120 - 24 = 256px，够放得下标签
    return {
      width: 400,
      height: 200,
      items: [
        { id: 'item-1', left: 0, top: 0, width: 40, height: 200 },
        { id: 'item-2', left: 52, top: 0, width: 40, height: 200 },
        { id: 'item-3', left: 104, top: 0, width: 40, height: 200 },
      ],
    }
  }

  it('每行画一个剩余空间标签，实际与理论并排', () => {
    useMeasure().measured.value = measuredWithWideGap()
    const wrapper = mount(OverlayLayer)

    const labels = wrapper.findAll('[data-testid="overlay-line-label"]')
    expect(labels).toHaveLength(1)
    // 实际 400 - 3×40 - 24 = 256；理论 400 - 3×80 - 24 = 136（盒子内容尺寸默认 80）
    expect(labels[0].text()).toContain('256')
    expect(labels[0].text()).toContain('136')
  })

  it('实际与理论对不上时标出来，一致时不标', async () => {
    useMeasure().measured.value = measuredWithWideGap()
    const wrapper = mount(OverlayLayer)
    expect(wrapper.get('[data-testid="overlay-line-label"]').classes()).toContain('mismatch')

    // 把盒子内容尺寸调成 40，理论与实际就对上了
    for (const item of useFlexState().state.items)
      item.size = 40
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="overlay-line-label"]').classes()).not.toContain('mismatch')
  })

  it('理论值无法静态推导时，标签与 HUD 都写「理论 —」且不标不一致', async () => {
    useMeasure().measured.value = measuredWithWideGap()
    useFlexState().state.items[0].basis = 'calc(10% + 1px)'
    useOverlay().setHovered('item-1')
    const wrapper = mount(OverlayLayer)
    await wrapper.vm.$nextTick()

    const label = wrapper.get('[data-testid="overlay-line-label"]')
    const hud = wrapper.get('[data-testid="overlay-hud"] text')
    expect(label.text()).toContain('理论 —')
    expect(label.classes()).not.toContain('mismatch')
    expect(hud.text()).toContain('理论 —')
    expect(hud.classes()).not.toContain('mismatch')
  })

  it('色块放不下这行字就不画，宁可不标也不让字溢出到盒子上', () => {
    // 默认的观测值里行尾只空出 400 - 300 - 24 = 76px，塞不下标签
    const wrapper = mount(OverlayLayer)
    expect(wrapper.find('[data-testid="overlay-line-label"]').exists()).toBe(false)
  })

  // 阈值两侧各取一点，钉住「刚好放不下就不画」。happy-dom 不排版，估算值本身准不准只能到浏览器里量
  it('色块宽度卡在阈值两侧：差一点不画，够了才画', () => {
    const tailOf = (containerWidth: number): MeasuredStage => ({
      width: containerWidth,
      height: 200,
      items: [
        { id: 'item-1', left: 0, top: 0, width: 40, height: 200 },
        { id: 'item-2', left: 52, top: 0, width: 40, height: 200 },
        { id: 'item-3', left: 104, top: 0, width: 40, height: 200 },
      ],
    })

    // 三位数那行字估算 117.8px，加 8px 内缩要 125.8px
    useMeasure().measured.value = tailOf(268) // 行尾空出 124px，差一点
    expect(mount(OverlayLayer).find('[data-testid="overlay-line-label"]').exists()).toBe(false)

    useMeasure().measured.value = tailOf(272) // 行尾空出 128px，够了
    expect(mount(OverlayLayer).find('[data-testid="overlay-line-label"]').exists()).toBe(true)
  })

  it('标签跟色块同属沉底那一层，不抢盒子的层级', () => {
    useMeasure().measured.value = measuredWithWideGap()
    const wrapper = mount(OverlayLayer)

    expect(wrapper.get('[data-testid="overlay"]').find('[data-testid="overlay-line-label"]').exists()).toBe(true)
  })
})
