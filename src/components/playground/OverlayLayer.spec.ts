import type { MeasuredStage } from '~/core/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import { useMeasure } from '~/composables/useMeasure'
import { useOverlay } from '~/composables/useOverlay'
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

  it('流动轴与流向的四份斜纹 pattern 都定义在 defs 里', () => {
    const wrapper = mount(OverlayLayer)
    for (const axis of ['x', 'y']) {
      for (const flow of ['forward', 'reverse'])
        expect(wrapper.find(`#overlay-stripes-${axis}-${flow}`).exists()).toBe(true)
    }
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

  /*
   * 叠加层要读成「铺在台面上、被方块压住」的一层，而不是盖在方块脸上的一张膜。
   * 但 HUD 是标签，跟着沉下去就会被它要标注的那个盒子挡住——标签看不见等于没有。
   * 所以色块/箭头沉底、HUD 单独浮在上层，两层分开。
   */
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
    const overlayCss = readFileSync(resolve(process.cwd(), 'src/components/playground/OverlayLayer.vue'), 'utf-8')
    const stageCss = readFileSync(resolve(process.cwd(), 'src/components/playground/DemoStage.vue'), 'utf-8')

    const zOf = (src: string, selector: string): number => {
      const block = new RegExp(`${selector}\\s*\\{[^}]*\\}`).exec(src)?.[0] ?? ''
      const z = /z-index:\s*(-?\d+)/.exec(block)
      expect(z, `${selector} 没有显式 z-index，层序就只能靠 DOM 顺序碰运气`).toBeTruthy()
      return Number(z![1])
    }

    const 色块层 = zOf(overlayCss, '\\.overlay--under')
    const HUD层 = zOf(overlayCss, '\\.overlay--over')
    const 盒子 = zOf(stageCss, '\\.stage-item')

    expect(色块层, '色块层没沉到盒子下面').toBeLessThan(盒子)
    expect(HUD层, 'HUD 没浮在盒子上面').toBeGreaterThan(盒子)
  })

  /*
   * 每行色块上标出「实际剩余 vs 理论剩余」。
   *
   * 这一对数字原本算出来就扔了：core/overlay.ts 的 OverlayGeometry.lines 一直没有消费方，
   * 只有它自己的单测在引用。而它恰恰是本站主线在行这一级的落点——
   * 明细表比的是单个盒子的尺寸，这里比的是整行还剩多少空间，
   * 两者不一致时说明有规则介入（min-width:auto 撑住了某个盒子，剩余空间就比理论值少）。
   */
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

  it('色块放不下这行字就不画，宁可不标也不让字溢出到盒子上', () => {
    // 默认的观测值里行尾只空出 400 - 300 - 24 = 76px，塞不下标签
    const wrapper = mount(OverlayLayer)
    expect(wrapper.find('[data-testid="overlay-line-label"]').exists()).toBe(false)
  })

  /*
   * 阈值按文本内容估算，不是写死的常数——数字位数一变，这行字就变宽。
   * 「剩余 456 · 理论 456」浏览器实测 117px，最早写死的 110px 已经不够，
   * 色块宽度落在 110~117 之间时文字会溢出到旁边的盒子上。
   * 这条测试卡在阈值两侧各取一点，钉住「刚好放不下就不画」。
   */
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

    /*
     * 三位数那行字估算 117.8px（与浏览器实测的 117px 吻合），加 8px 内缩后要 125.8px。
     * 注意分隔点「·」是 U+00B7，落在 Latin-1 区间里，按半角宽度计——
     * 当成全角会把估算值抬高 4px 多，卡边界的那档就会误判。
     */
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
