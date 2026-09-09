import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import { STAGE_LIMITS } from '~/core/defaults'
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
    expect(state.container.width).toBe(STAGE_LIMITS.minWidth)
    expect(state.container.height).toBe(STAGE_LIMITS.minHeight)

    firePointer('pointermove', 9999, 9999)
    expect(state.container.width).toBe(STAGE_LIMITS.maxWidth)
    expect(state.container.height).toBe(STAGE_LIMITS.maxHeight)

    // 用例之间不卸载组件，监听器留在 window 上——松手收尾，免得串到后面的用例
    firePointer('pointerup', 0, 0)
  })

  it('方向键微调 1px，保住键盘可达', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer)
    const handle = wrapper.get('[data-testid="stage-resizer"]')

    await handle.trigger('keydown', { key: 'ArrowRight' })
    await handle.trigger('keydown', { key: 'ArrowUp' })

    expect(state.container.width).toBe(721)
    expect(state.container.height).toBe(319)
  })

  it('按住 Shift 步长变 10px', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer)

    await wrapper.get('[data-testid="stage-resizer"]').trigger('keydown', { key: 'ArrowLeft', shiftKey: true })

    expect(state.container.width).toBe(710)
  })

  it('无关按键不改尺寸', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer)

    await wrapper.get('[data-testid="stage-resizer"]').trigger('keydown', { key: 'Enter' })

    expect(state.container.width).toBe(720)
  })
})
