import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import { containerProperties, numberProp } from '~/data/flexProperties'
import StageResizer from './StageResizer.vue'

/** happy-dom 未必有 PointerEvent 构造器，手工造事件保证测试环境无关 */
function firePointer(type: string, clientX: number, clientY: number): void {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { clientX, clientY, pointerId: 1 })
  window.dispatchEvent(event)
}

describe('stageResizer', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('拖拽同时改变容器的宽和高', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer, { attachTo: document.body })

    await wrapper.get('[data-testid="stage-resizer"]').trigger('pointerdown', { clientX: 100, clientY: 100 })
    firePointer('pointermove', 160, 130)

    expect(state.container.width).toBe(780)
    expect(state.container.height).toBe(350)
  })

  it('松手之后再移动鼠标不再改尺寸', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer, { attachTo: document.body })

    await wrapper.get('[data-testid="stage-resizer"]').trigger('pointerdown', { clientX: 100, clientY: 100 })
    firePointer('pointerup', 100, 100)
    firePointer('pointermove', 500, 500)

    expect(state.container.width).toBe(720)
    expect(state.container.height).toBe(320)
  })

  it('尺寸被限制在上下限之内', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer, { attachTo: document.body })

    await wrapper.get('[data-testid="stage-resizer"]').trigger('pointerdown', { clientX: 0, clientY: 0 })
    firePointer('pointermove', -9999, -9999)
    expect(state.container.width).toBe(numberProp(containerProperties, 'width').min)
    expect(state.container.height).toBe(numberProp(containerProperties, 'height').min)

    firePointer('pointermove', 9999, 9999)
    expect(state.container.width).toBe(numberProp(containerProperties, 'width').max)
    expect(state.container.height).toBe(numberProp(containerProperties, 'height').max)

    // 用例之间不卸载组件，监听器留在 window 上——松手收尾，免得串到后面的用例
    firePointer('pointerup', 0, 0)
  })

  // 拖完手柄焦点若还留在上一个控件（比如某个滑块）上，接着按方向键就会改掉那个属性
  it('按下手柄后焦点落在手柄上，不留在上一个控件', async () => {
    const wrapper = mount(StageResizer, { attachTo: document.body })
    const handle = wrapper.get('[data-testid="stage-resizer"]')

    await handle.trigger('pointerdown', { clientX: 0, clientY: 0 })
    firePointer('pointerup', 0, 0)

    expect(document.activeElement).toBe(handle.element)
  })

  // 它不响应键盘，留在 Tab 序列里就是一个按了没反应的按钮；键盘改用设置区的宽高滑块
  it('手柄不进 Tab 序列，可访问名称指向宽高滑块', () => {
    const handle = mount(StageResizer).get('[data-testid="stage-resizer"]')

    expect(handle.attributes('tabindex')).toBe('-1')
    expect(handle.attributes('aria-label')).toContain('width')
    expect(handle.attributes('aria-label')).toContain('height')
  })

  it('方向键不改尺寸，也不拦截浏览器的默认行为', async () => {
    const { state } = useFlexState()
    const handle = mount(StageResizer).get('[data-testid="stage-resizer"]')

    for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
      const event = new KeyboardEvent('keydown', { key, shiftKey: true, bubbles: true, cancelable: true })
      handle.element.dispatchEvent(event)
      expect(event.defaultPrevented, key).toBe(false)
    }

    expect(state.container.width).toBe(720)
    expect(state.container.height).toBe(320)
  })
})

describe('stageResizer 的区间取自属性表', () => {
  const widthProp = numberProp(containerProperties, 'width')
  const originalMax = widthProp.max

  afterEach(() => {
    widthProp.max = originalMax
  })

  it('改了表里的上限，拖拽跟着变', async () => {
    useFlexState().resetState()
    widthProp.max = 1000
    const { state } = useFlexState()
    const wrapper = mount(StageResizer, { attachTo: document.body })

    await wrapper.get('[data-testid="stage-resizer"]').trigger('pointerdown', { clientX: 0, clientY: 0 })
    firePointer('pointermove', 9999, 0)
    expect(state.container.width).toBe(1000)

    firePointer('pointerup', 0, 0)
  })
})
