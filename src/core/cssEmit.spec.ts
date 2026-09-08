import { describe, expect, it } from 'vitest'
import { emitCss } from './cssEmit'
import { createDefaultState } from './defaults'

describe('emitCss', () => {
  it('输出容器规则，gap 用 row column 简写', () => {
    const state = createDefaultState()
    state.container.rowGap = 8
    state.container.columnGap = 16
    const css = emitCss(state)
    expect(css).toContain('display: flex;')
    expect(css).toContain('flex-direction: row;')
    expect(css).toContain('flex-wrap: nowrap;')
    expect(css).toContain('justify-content: flex-start;')
    expect(css).toContain('align-items: stretch;')
    expect(css).toContain('gap: 8px 16px;')
  })

  it('align-content 为 normal 时不输出该行，避免噪音', () => {
    const state = createDefaultState()
    expect(emitCss(state)).not.toContain('align-content')
    state.container.alignContent = 'space-between'
    expect(emitCss(state)).toContain('align-content: space-between;')
  })

  it('每个盒子输出 flex 简写，序号从 1 开始', () => {
    const state = createDefaultState()
    state.items[0].grow = 2
    state.items[0].basis = '120px'
    const css = emitCss(state)
    expect(css).toContain('.item-1 {')
    expect(css).toContain('flex: 2 1 120px;')
    expect(css).toContain('.item-3 {')
  })

  it('只在非默认值时输出 order / align-self / min-width / margin', () => {
    const state = createDefaultState()
    expect(emitCss(state)).not.toContain('order:')
    expect(emitCss(state)).not.toContain('align-self:')
    expect(emitCss(state)).not.toContain('min-width:')
    expect(emitCss(state)).not.toContain('margin:')

    state.items[0].order = 2
    state.items[0].alignSelf = 'center'
    state.items[0].minWidthAuto = false
    state.items[0].marginAuto = true
    const css = emitCss(state)
    expect(css).toContain('order: 2;')
    expect(css).toContain('align-self: center;')
    expect(css).toContain('min-width: 0;')
    expect(css).toContain('margin: auto;')
  })

  it('column 方向下关闭 min-width:auto 输出的是 min-height', () => {
    const state = createDefaultState()
    state.container.direction = 'column'
    state.items[0].minWidthAuto = false
    expect(emitCss(state)).toContain('min-height: 0;')
  })

  it('输出结果可直接粘贴使用（结构快照）', () => {
    expect(emitCss(createDefaultState())).toMatchInlineSnapshot(`
      ".container {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: flex-start;
        align-items: stretch;
        gap: 12px 12px;
      }

      .item-1 {
        flex: 0 1 auto;
      }

      .item-2 {
        flex: 0 1 auto;
      }

      .item-3 {
        flex: 0 1 auto;
      }"
    `)
  })
})
