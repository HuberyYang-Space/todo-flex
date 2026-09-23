import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import { MAX_ITEMS } from '~/core/constants'
import { itemProperties } from '~/data/flexProperties'
import ItemControls from './ItemControls.vue'
import ItemList from './ItemList.vue'

describe('itemControls', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('未选中盒子时给出提示而不是空白面板', () => {
    const wrapper = mount(ItemControls)
    expect(wrapper.find('[data-testid="item-empty"]').exists()).toBe(true)
  })

  it('选中后每个输入控件都有各不相同的可访问名称', async () => {
    const wrapper = mount(ItemControls)
    useFlexState().selectItem('item-1')
    await wrapper.vm.$nextTick()
    const inputs = wrapper.findAll('input')
    const names = inputs.map(input => input.attributes('aria-label'))

    // 滑块、basis 文本框、两个复选框都得在场，否则这条等于没测
    expect(inputs.map(input => input.attributes('type') ?? 'text'))
      .toEqual(expect.arrayContaining(['range', 'text', 'checkbox']))
    for (const name of names)
      expect(name).toBeTruthy()
    expect(new Set(names).size).toBe(names.length)
  })

  it('basis 文本框的长度上限取自属性表，与链接解码同一个上限', async () => {
    const wrapper = mount(ItemControls)
    useFlexState().selectItem('item-1')
    await wrapper.vm.$nextTick()
    const basisProp = itemProperties.find(prop => prop.key === 'basis')

    expect(basisProp?.kind).toBe('text')
    expect(wrapper.get('input[aria-label="flex-basis 自定义值"]').attributes('maxlength'))
      .toBe(String(basisProp?.kind === 'text' && basisProp.maxLength))
  })

  // 断言标注挂在谁身上，而不只是「页面上有这个标注」
  it('「仅演示区」只标在仅演示区的属性名旁', async () => {
    const wrapper = mount(ItemControls)
    useFlexState().selectItem('item-1')
    await wrapper.vm.$nextTick()

    const badges = wrapper.findAll('[data-testid="demo-only"]')
    const demoOnlyNames = itemProperties.filter(prop => prop.demoOnly).map(prop => prop.cssName)

    expect(badges.length, '一个标注都没有时下面的逐个断言等于没测').toBeGreaterThan(0)
    expect(badges).toHaveLength(demoOnlyNames.length)
    for (const [index, badge] of badges.entries()) {
      expect(badge.text()).toBe('仅演示区')
      expect(badge.element.parentElement?.textContent).toContain(demoOnlyNames[index])
      expect(badge.element.parentElement?.querySelector('a'), '不是 CSS 属性，不该链到 MDN').toBeNull()
    }
  })

  it('读屏在仅演示区的控件上也听得到「仅演示区」', async () => {
    const wrapper = mount(ItemControls)
    useFlexState().selectItem('item-1')
    await wrapper.vm.$nextTick()

    const names = itemProperties.filter(prop => prop.demoOnly).map(prop => prop.cssName)
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      const ids = (wrapper.get(`[aria-label="${name}"]`).attributes('aria-describedby') ?? '').split(' ').filter(Boolean)
      expect(ids.map(id => wrapper.find(`[id="${id}"]`).text()), name).toContain('仅演示区')
    }
  })

  it('选中后渲染该盒子的属性控件', async () => {
    const wrapper = mount(ItemControls)
    useFlexState().selectItem('item-2')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="item-empty"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('flex-grow')
    expect(wrapper.text()).toContain('flex-basis')
  })

  it('改动只作用于当前选中的盒子', async () => {
    const { state, selectItem } = useFlexState()
    const wrapper = mount(ItemControls)
    selectItem('item-2')
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-value="0"]').trigger('click')
    expect(state.items[1].basis).toBe('0')
    expect(state.items[0].basis).toBe('auto')
  })

  it('flex 简写预设一次回填三个分量', async () => {
    const { state, selectItem } = useFlexState()
    const wrapper = mount(ItemControls)
    selectItem('item-1')
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-preset="1"]').trigger('click')
    expect(state.items[0]).toMatchObject({ grow: 1, shrink: 1, basis: '0' })

    await wrapper.get('[data-preset="none"]').trigger('click')
    expect(state.items[0]).toMatchObject({ grow: 0, shrink: 0, basis: 'auto' })
  })

  it('当前三元组与某个预设吻合时该预设高亮', async () => {
    const { state, selectItem } = useFlexState()
    const wrapper = mount(ItemControls)
    selectItem('item-1')
    state.items[0].grow = 1
    state.items[0].shrink = 1
    state.items[0].basis = 'auto'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-preset="auto"]').classes()).toContain('is-active')
    expect(wrapper.get('[data-preset="none"]').classes()).not.toContain('is-active')
  })
})

describe('itemList', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('列出全部盒子', () => {
    expect(mount(ItemList).findAll('[data-testid="item-row"]')).toHaveLength(3)
  })

  it('新增按钮追加盒子', async () => {
    const wrapper = mount(ItemList)
    await wrapper.get('[data-testid="add-item"]').trigger('click')
    expect(useFlexState().state.items).toHaveLength(4)
  })

  it('到达上限后新增按钮禁用', async () => {
    const { addItem } = useFlexState()
    for (let i = 0; i < MAX_ITEMS; i++)
      addItem()
    const wrapper = mount(ItemList)
    expect(wrapper.get('[data-testid="add-item"]').attributes('disabled')).toBeDefined()
  })

  it('删除按钮移除对应盒子', async () => {
    const wrapper = mount(ItemList)
    await wrapper.findAll('[data-testid="remove-item"]')[0].trigger('click')
    const { state } = useFlexState()
    expect(state.items).toHaveLength(2)
    expect(state.items.map(item => item.id)).not.toContain('item-1')
  })

  it('点击行选中该盒子', async () => {
    const wrapper = mount(ItemList)
    await wrapper.findAll('[data-testid="item-row"]')[2].trigger('click')
    expect(useFlexState().state.selectedId).toBe('item-3')
  })

  it('行的可点区域是真按钮，键盘能 Tab 到并暴露选中态', async () => {
    const wrapper = mount(ItemList)
    const rows = wrapper.findAll('[data-testid="item-row"]')

    for (const row of rows)
      expect(row.element.tagName).toBe('BUTTON')

    await rows[1].trigger('click')
    expect(rows[1].attributes('aria-pressed')).toBe('true')
    expect(rows[0].attributes('aria-pressed')).toBe('false')
  })
})

describe('basis 输入框把关', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  const BASIS_INPUT = 'input[aria-label="flex-basis 自定义值"]'

  async function mountWithItem1() {
    const wrapper = mount(ItemControls)
    useFlexState().selectItem('item-1')
    await wrapper.vm.$nextTick()
    return {
      wrapper,
      input: () => wrapper.get(BASIS_INPUT),
      inputValue: () => (wrapper.get(BASIS_INPUT).element as HTMLInputElement).value,
      hint: () => wrapper.get('[data-testid="field-hint"]').text(),
    }
  }

  it('合法值随打随生效，不出提示', async () => {
    const { input, hint } = await mountWithItem1()
    await input().setValue('120px')

    expect(useFlexState().state.items[0].basis).toBe('120px')
    expect(hint()).toBe('')
  })

  it.each([
    ['50', '非 0 数值要带单位'],
    ['initial', '全局关键字'],
    ['var(--x)', 'var()'],
    ['calc-size(auto, size)', 'calc-size()'],
    ['abc', '不是合法的 flex-basis'],
  ])('打出 %j 时只提示原因，不写进状态，输入框保留原样', async (value, reason) => {
    const { input, inputValue, hint } = await mountWithItem1()
    await input().setValue(value)

    expect(useFlexState().state.items[0].basis).toBe('auto')
    expect(hint()).toContain(reason)
    expect(inputValue()).toBe(value)
  })

  it('草稿被拒时输入框标 aria-invalid，改回合法值或失焦恢复后撤掉', async () => {
    const { input } = await mountWithItem1()
    expect(input().attributes('aria-invalid')).toBe('false')

    await input().setValue('50')
    expect(input().attributes('aria-invalid')).toBe('true')

    await input().setValue('50px')
    expect(input().attributes('aria-invalid')).toBe('false')

    await input().setValue('50')
    await input().trigger('blur')
    expect(input().attributes('aria-invalid')).toBe('false')
  })

  it('改回合法值后提示消失', async () => {
    const { input, hint } = await mountWithItem1()
    await input().setValue('50')
    await input().setValue('50px')

    expect(hint()).toBe('')
    expect(useFlexState().state.items[0].basis).toBe('50px')
  })

  it.each(['blur', 'keydown.enter'])('%s 时仍不合法，退回当前生效的值并说明原因', async (event) => {
    const { input, inputValue, hint } = await mountWithItem1()
    await input().setValue('120px')
    await input().setValue('50')
    await input().trigger(event)

    expect(inputValue()).toBe('120px')
    expect(hint()).toContain('非 0 数值要带单位')
    expect(hint()).toContain('已恢复为 120px')
    expect(useFlexState().state.items[0].basis).toBe('120px')
  })

  // 逐字打 0.5em 会经过 0.：它不能进状态，否则导出的 flex 简写整条失效
  it('打字途中经过的非法前缀不进状态，失焦时退回上一个合法值', async () => {
    const { input, inputValue } = await mountWithItem1()
    await input().setValue('0')
    await input().setValue('0.')
    await input().trigger('blur')

    expect(useFlexState().state.items[0].basis).toBe('0')
    expect(inputValue()).toBe('0')
  })

  it.each([{ isComposing: true }, { keyCode: 229 }])('输入法组合中按回车是上屏，不触发恢复（%o）', async (init) => {
    const { input, inputValue, hint } = await mountWithItem1()
    await input().setValue('calc')
    await input().trigger('keydown', { key: 'Enter', ...init })

    expect(inputValue()).toBe('calc')
    expect(hint()).not.toContain('已恢复')
  })

  // 真实 Chrome 复现过：按住下方的 align-self 选项导致失焦，提示由一行变两行把选项挤下去，松手时点击落空
  it('按住别处导致的失焦，等松手之后再恢复', async () => {
    const { input, inputValue, hint } = await mountWithItem1()
    await input().setValue('50')
    window.dispatchEvent(new MouseEvent('mousedown'))
    await input().trigger('blur')

    expect(inputValue()).toBe('50')
    expect(hint()).not.toContain('已恢复')

    window.dispatchEvent(new MouseEvent('mouseup'))
    await flushPromises()

    expect(inputValue()).toBe('auto')
    expect(hint()).toContain('已恢复为 auto')
  })

  it('失焦时合法就什么都不动', async () => {
    const { input, inputValue, hint } = await mountWithItem1()
    await input().setValue('30%')
    await input().trigger('blur')

    expect(inputValue()).toBe('30%')
    expect(hint()).toBe('')
  })

  it.each(['blur', 'keydown.enter'])('%s 时把合法值规范成去首尾空白的小写，预设跟着高亮', async (event) => {
    const { wrapper, input, inputValue } = await mountWithItem1()
    await input().setValue(' 100PX ')
    await input().trigger(event)

    expect(useFlexState().state.items[0].basis).toBe('100px')
    expect(inputValue()).toBe('100px')
    expect(wrapper.get('[data-value="100px"]').classes()).toContain('is-active')
  })

  it('点一个与当前值相同的预设，也会清掉「已恢复为」的提示', async () => {
    const { wrapper, input, hint } = await mountWithItem1()
    await input().setValue('50')
    await input().trigger('blur')
    expect(hint()).toContain('已恢复为 auto')

    await wrapper.get('[data-value="auto"]').trigger('click')
    expect(hint()).toBe('')
  })

  it('点预设会盖掉没生效的草稿与提示', async () => {
    const { wrapper, input, inputValue, hint } = await mountWithItem1()
    await input().setValue('50')
    await wrapper.get('[data-value="30%"]').trigger('click')

    expect(inputValue()).toBe('30%')
    expect(hint()).toBe('')
  })

  // 两个盒子的 basis 都是 auto：值没变，只靠 watch 同步不了草稿
  it('草稿停在被拒值时换选中的盒子，输入框显示新盒子的值、提示清空', async () => {
    const { wrapper, input, inputValue, hint } = await mountWithItem1()
    await input().setValue('50')
    useFlexState().selectItem('item-2')
    await wrapper.vm.$nextTick()

    expect(inputValue()).toBe('auto')
    expect(hint()).toBe('')
  })
})
