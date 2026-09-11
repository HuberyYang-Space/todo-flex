import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultState } from '~/core/defaults'
import { MAX_ITEMS, useFlexState } from './useFlexState'

describe('useFlexState', () => {
  beforeEach(() => {
    // 状态是模块级单例，每个用例前必须复位
    useFlexState().resetState()
  })

  it('初始为三个盒子且未选中', () => {
    const { state } = useFlexState()
    expect(state.items).toHaveLength(3)
    expect(state.selectedId).toBeNull()
  })

  it('多次调用共享同一份状态', () => {
    useFlexState().state.container.direction = 'column'
    expect(useFlexState().state.container.direction).toBe('column')
  })

  it('新增的盒子 id 不与已删除的重复', () => {
    const { state, addItem, removeItem } = useFlexState()
    removeItem('item-1')
    addItem()
    const ids = state.items.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('item-1')
  })

  it('盒子数量有上限，防止面板与演示区过载', () => {
    const { state, addItem } = useFlexState()
    for (let i = 0; i < 20; i++)
      addItem()
    expect(state.items).toHaveLength(MAX_ITEMS)
  })

  it('至少保留一个盒子', () => {
    const { state, removeItem } = useFlexState()
    for (const id of [...state.items.map(item => item.id)])
      removeItem(id)
    expect(state.items).toHaveLength(1)
  })

  it('删除选中的盒子会清空选中状态', () => {
    const { state, selectItem, removeItem } = useFlexState()
    selectItem('item-2')
    removeItem('item-2')
    expect(state.selectedId).toBeNull()
  })

  it('selectedItem 跟随选中 id', () => {
    const { selectedItem, selectItem } = useFlexState()
    expect(selectedItem.value).toBeNull()
    selectItem('item-2')
    expect(selectedItem.value?.id).toBe('item-2')
  })

  it('derived 与 css 随状态变化重新计算', () => {
    const { state, derived, css } = useFlexState()
    state.container.width = 600
    state.items.forEach((item) => {
      item.grow = 1
      item.basis = '0'
    })
    expect(derived.value.items[0].finalMainSize).toBe(192) // (600 - 24) / 3
    expect(css.value).toContain('flex: 1 1 0;')
  })
})

/*
 * 分享链接进来时要直接还原成对方的画面。
 * 状态是模块级单例、在模块加载那一刻就定了，所以这里靠 resetModules + 动态 import 重现首屏时机。
 */
describe('useFlexState 的首屏初始化', () => {
  const originalSearch = globalThis.location.search

  afterEach(() => {
    globalThis.history.replaceState(null, '', originalSearch || '/')
    vi.restoreAllMocks()
    vi.resetModules()
  })

  async function loadWith(search: string) {
    globalThis.history.replaceState(null, '', search)
    vi.resetModules()
    return (await import('./useFlexState')).useFlexState()
  }

  it('地址栏带短码时按短码还原，而不是先给默认状态', async () => {
    const { state } = await loadWith('?v=1&c=flex.column.wrap.between.center.normal.8.8.500.400&i=2-1-auto-0-fe-120-1-0,0-1-auto-0-auto-80-0-1')

    expect(state.container.direction).toBe('column')
    expect(state.container.justifyContent).toBe('space-between')
    expect(state.container.width).toBe(500)
    expect(state.items).toHaveLength(2)
    expect(state.items[0].grow).toBe(2)
    expect(state.items[0].alignSelf).toBe('flex-end')
    expect(state.items[1].marginAuto).toBe(true)
  })

  it('地址栏是坏短码时回退默认状态，绝不白屏', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { state } = await loadWith('?v=1&c=坏掉了&i=也坏了')

    expect(state.container.direction).toBe('row')
    expect(state.items).toHaveLength(3)
  })

  it('地址栏没有短码时就是默认状态', async () => {
    const { state } = await loadWith('/')

    expect(state.container.direction).toBe('row')
    expect(state.items).toHaveLength(3)
  })

  it('新增盒子的序号接着还原出来的数量走，不撞号', async () => {
    const { state, addItem } = await loadWith('?v=1&c=flex.row.nowrap.fs.stretch.normal.12.12.720.320&i=0-1-auto-0-auto-80-1-0,0-1-auto-0-auto-80-1-0')

    addItem()

    const ids = state.items.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('loadState', () => {
  beforeEach(() => {
    // 状态是模块级单例，每个用例前必须复位
    useFlexState().resetState()
  })

  it('整体替换状态，容器与盒子都换成传入的那一份', () => {
    const { state, loadState } = useFlexState()
    const next = createDefaultState()
    next.container.width = 480
    next.container.justifyContent = 'space-between'
    next.items[0].grow = 1

    loadState(next)

    expect(state.container.width).toBe(480)
    expect(state.container.justifyContent).toBe('space-between')
    expect(state.items[0].grow).toBe(1)
  })

  it('载入盒子数量不同的状态后，新增盒子的 id 不与现有的撞号', () => {
    const { state, loadState, addItem } = useFlexState()
    const next = createDefaultState()
    next.items = next.items.slice(0, 2)

    loadState(next)
    addItem()

    expect(new Set(state.items.map(item => item.id)).size).toBe(state.items.length)
  })

  it('载入后修改原对象不会再影响单例', () => {
    const { state, loadState } = useFlexState()
    const next = createDefaultState()

    loadState(next)
    next.container.width = 999

    expect(state.container.width).not.toBe(999)
  })
})
