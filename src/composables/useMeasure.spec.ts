import type { EffectScope } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useFlexState } from './useFlexState'
import { useMeasure } from './useMeasure'

interface Offsets { width: number, height: number, left: number, top: number }

/** happy-dom 不做排版，offset* 全是 0，这里手工塞进去模拟浏览器算出的布局 */
function setOffsets(el: HTMLElement, offsets: Offsets): void {
  const map = {
    offsetWidth: offsets.width,
    offsetHeight: offsets.height,
    offsetLeft: offsets.left,
    offsetTop: offsets.top,
  }
  for (const [key, value] of Object.entries(map))
    Object.defineProperty(el, key, { value, configurable: true })
}

function appendItem(stage: HTMLElement, id: string, offsets: Offsets): HTMLElement {
  const el = document.createElement('div')
  el.dataset.itemId = id
  setOffsets(el, offsets)
  stage.append(el)
  return el
}

function buildStage(): HTMLElement {
  const stage = document.createElement('div')
  setOffsets(stage, { width: 600, height: 300, left: 0, top: 0 })
  appendItem(stage, 'i1', { width: 100, height: 300, left: 0, top: 0 })
  appendItem(stage, 'i2', { width: 200, height: 300, left: 112, top: 0 })
  document.body.append(stage)
  return stage
}

/** 可手动触发的 ResizeObserver 替身，用来验证「尺寸变化 → 重新采样」这条链路 */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  observed = new Set<Element>()
  disconnectCount = 0

  constructor(private callback: () => void) {
    FakeResizeObserver.instances.push(this)
  }

  static get latest(): FakeResizeObserver {
    const found = FakeResizeObserver.instances.at(-1)
    if (!found)
      throw new Error('没有创建任何 ResizeObserver')
    return found
  }

  observe(el: Element): void {
    this.observed.add(el)
  }

  disconnect(): void {
    this.observed.clear()
    this.disconnectCount += 1
  }

  trigger(): void {
    this.callback()
  }
}

describe('useMeasure', () => {
  let scope: EffectScope

  beforeEach(() => {
    document.body.innerHTML = ''
    FakeResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    useFlexState().resetState()
    // paused 是模块级的，用例之间必须归位，否则前一个用例的挂起会串到下一个
    useMeasure().resume()
    useMeasure().measured.value = null
    scope = effectScope()
  })

  async function observe(stage: HTMLElement | undefined) {
    const target = ref(stage)
    scope.run(() => useMeasure().observeStage(target))
    await nextTick()
    return target
  }

  it('接上演示区后采出容器与每个盒子的尺寸和位置', async () => {
    await observe(buildStage())

    const { measured } = useMeasure()
    expect(measured.value).toEqual({
      width: 600,
      height: 300,
      items: [
        { id: 'i1', width: 100, height: 300, left: 0, top: 0 },
        { id: 'i2', width: 200, height: 300, left: 112, top: 0 },
      ],
    })
  })

  it('只读 offset*，绝不调用 getBoundingClientRect', async () => {
    // 红线：M4 接入 GSAP Flip 后 rect 会返回 transform 的中间态，明细表数字会乱跳
    const stage = buildStage()
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect')

    await observe(stage)
    FakeResizeObserver.latest.trigger()

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('容器与每个盒子都进入 ResizeObserver 的观测范围', async () => {
    const stage = await observe(buildStage()).then(target => target.value!)

    const { observed } = FakeResizeObserver.latest
    expect(observed.has(stage)).toBe(true)
    expect(observed.size).toBe(3)
  })

  it('尺寸变化触发重新采样', async () => {
    const stage = buildStage()
    await observe(stage)

    setOffsets(stage.querySelector<HTMLElement>('[data-item-id="i1"]')!, {
      width: 340,
      height: 300,
      left: 0,
      top: 0,
    })
    FakeResizeObserver.latest.trigger()

    expect(useMeasure().measured.value!.items[0].width).toBe(340)
  })

  it('盒子只挪位置不变尺寸时也重新采样', async () => {
    // ResizeObserver 对纯位置变化不发通知，改 justify-content 就是这种情况
    const stage = buildStage()
    await observe(stage)

    setOffsets(stage.querySelector<HTMLElement>('[data-item-id="i1"]')!, {
      width: 100,
      height: 300,
      left: 300,
      top: 0,
    })
    useFlexState().state.container.justifyContent = 'center'
    await nextTick()

    expect(useMeasure().measured.value!.items[0].left).toBe(300)
  })

  it('新增盒子后把它一并纳入观测', async () => {
    const stage = buildStage()
    await observe(stage)

    appendItem(stage, 'i3', { width: 60, height: 300, left: 424, top: 0 })
    useFlexState().addItem()
    await nextTick()

    expect(useMeasure().measured.value!.items.map(item => item.id)).toEqual(['i1', 'i2', 'i3'])
    expect(FakeResizeObserver.latest.observed.size).toBe(4)
  })

  it('作用域销毁后断开观测，不再持有元素', async () => {
    await observe(buildStage())
    const observer = FakeResizeObserver.latest
    // 重新挂载时也会 disconnect 一次，所以只认「销毁前后的增量」，避免测试被蒙混过关
    const before = observer.disconnectCount

    scope.stop()

    expect(observer.disconnectCount).toBe(before + 1)
    expect(observer.observed.size).toBe(0)
  })

  it('演示区元素还没挂载时不产出观测结果', async () => {
    await observe(undefined)

    expect(useMeasure().measured.value).toBeNull()
  })

  it('挂起期间状态变化不再更新观测结果', async () => {
    await observe(buildStage())
    const { measured, pause, resume } = useMeasure()
    const before = measured.value

    pause()
    useFlexState().state.container.width = 999
    await nextTick()

    expect(measured.value).toBe(before)
    resume()
  })

  it('挂起期间 ResizeObserver 报告的尺寸变化同样被忽略', async () => {
    const stage = buildStage()
    await observe(stage)
    const { measured, pause, resume } = useMeasure()
    const before = measured.value

    pause()
    setOffsets(stage, { width: 999, height: 300, left: 0, top: 0 })
    FakeResizeObserver.latest.trigger()

    expect(measured.value).toBe(before)
    resume()
  })

  it('恢复时立即重采一次，补上挂起期间漏掉的变化', async () => {
    const stage = buildStage()
    await observe(stage)
    const { measured, pause, resume } = useMeasure()

    pause()
    setOffsets(stage, { width: 999, height: 300, left: 0, top: 0 })
    FakeResizeObserver.latest.trigger()
    resume()

    // 不用等下一次状态变化，恢复的那一刻就该是新值
    expect(measured.value?.width).toBe(999)
  })

  it('演示区卸载之后恢复是安全的空操作', async () => {
    await observe(buildStage())
    scope.stop()

    const { pause, resume } = useMeasure()
    pause()
    expect(() => resume()).not.toThrow()
  })
})
