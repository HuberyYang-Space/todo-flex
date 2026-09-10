import { afterEach, describe, expect, it, vi } from 'vitest'
import { containerProperties, itemProperties } from '~/data/flexProperties'
import { createDefaultState } from './defaults'
import { decode, decodeOrDefault, encode } from './urlCodec'

describe('urlCodec', () => {
  it('默认状态编码后能原样解回来', () => {
    const state = createDefaultState()
    expect(decode(encode(state))).toEqual(state)
  })

  it('编成带版本前缀的可读短码，不是 base64', () => {
    const query = encode(createDefaultState())

    expect(query).toContain('v=1')
    // display.direction.wrap.justify.align.alignContent.rowGap.colGap.width.height
    expect(query).toContain('c=flex.row.nowrap.fs.stretch.normal.12.12.720.320')
    // grow-shrink-basis-order-alignSelf-size-minWidthAuto-marginAuto，逗号分隔三个盒子
    expect(query).toContain('i=0-1-auto-0-auto-80-1-0,0-1-auto-0-auto-80-1-0,0-1-auto-0-auto-80-1-0')
  })
})

/*
 * 设计文档给的 item 段例子只用了 auto / center 这类「干净」值，掩盖了一个冲突：
 * item 段用 `-` 分字段，而 alignSelf 的合法值里就有 flex-start、self-end 这些自带 `-` 的。
 */
describe('urlCodec 的分隔符与特殊字符', () => {
  it('alignSelf 取 flex-start 这类自带短横线的值也能解回来', () => {
    const state = createDefaultState()
    state.items[0].alignSelf = 'flex-start'
    state.items[1].alignSelf = 'flex-end'

    const back = decode(encode(state))

    expect(back?.items[0].alignSelf).toBe('flex-start')
    expect(back?.items[1].alignSelf).toBe('flex-end')
  })

  it('容器段自带短横线的值同样能解回来', () => {
    const state = createDefaultState()
    state.container.direction = 'column-reverse'
    state.container.wrap = 'wrap-reverse'
    state.container.justifyContent = 'space-between'

    const back = decode(encode(state))

    expect(back?.container.direction).toBe('column-reverse')
    expect(back?.container.wrap).toBe('wrap-reverse')
    expect(back?.container.justifyContent).toBe('space-between')
  })

  it('alignItems 取 first baseline 这类带空格的值也能解回来', () => {
    const state = createDefaultState()
    state.container.alignItems = 'first baseline'

    expect(decode(encode(state))?.container.alignItems).toBe('first baseline')
  })

  it('basis 带百分号不会把查询串拆坏', () => {
    const state = createDefaultState()
    state.items[0].basis = '30%'

    expect(decode(encode(state))?.items[0].basis).toBe('30%')
  })

  it('basis 里塞进分隔符也只影响它自己', () => {
    const state = createDefaultState()
    // 极端但合法：calc 里同时有空格、百分号、减号、括号
    state.items[1].basis = 'calc(100% - 10px)'

    const back = decode(encode(state))

    expect(back?.items[1].basis).toBe('calc(100% - 10px)')
    expect(back?.items).toHaveLength(3)
  })

  it('选中项按位置存取，不受 id 影响', () => {
    const state = createDefaultState()
    state.selectedId = state.items[2].id

    expect(decode(encode(state))?.selectedId).toBe('item-3')
  })
})

/*
 * 解析失败一律回退默认状态并 console.warn，绝不解出一个半对半错的状态——那比白屏更难查。
 */
describe('urlCodec 对非法输入的回退', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** 拦住警告，免得污染测试输出；返回收到的警告条数 */
  function silenceWarn() {
    return vi.spyOn(console, 'warn').mockImplementation(() => {})
  }

  it('没有 v 参数属于首次访问，返回 null 但不警告', () => {
    const warn = silenceWarn()

    expect(decode('')).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })

  it('版本对不上就整个拒掉', () => {
    const warn = silenceWarn()
    const query = encode(createDefaultState()).replace('v=1', 'v=2')

    expect(decode(query)).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('缺少 c 或 i 参数就整个拒掉', () => {
    silenceWarn()

    expect(decode('?v=1&i=0-1-auto-0-auto-80-1-0')).toBeNull()
    expect(decode('?v=1&c=flex.row.nowrap.fs.stretch.normal.12.12.720.320')).toBeNull()
  })

  it('容器段数不对就整个拒掉', () => {
    silenceWarn()

    expect(decode('?v=1&c=flex.row.nowrap&i=0-1-auto-0-auto-80-1-0')).toBeNull()
  })

  it('枚举值不在属性表里就整个拒掉', () => {
    silenceWarn()
    // justify-content 没有 middle 这个值
    const query = encode(createDefaultState()).replace('.fs.', '.middle.')

    expect(decode(query)).toBeNull()
  })

  it('数字位塞了非数字就整个拒掉', () => {
    silenceWarn()
    const query = encode(createDefaultState()).replace('.720.320', '.wide.320')

    expect(decode(query)).toBeNull()
  })

  it('sel 越界只丢掉选中项，其余照常解出来', () => {
    const warn = silenceWarn()
    const query = `${encode(createDefaultState())}&sel=9`

    const back = decode(query)

    expect(back).not.toBeNull()
    expect(back?.selectedId).toBeNull()
    expect(back?.items).toHaveLength(3)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('decodeOrDefault 把兜底做掉，调用方不必自己判空', () => {
    silenceWarn()

    expect(decodeOrDefault('?v=99&c=x&i=y')).toEqual(createDefaultState())
  })
})

/*
 * 设计文档要求「映射表与属性元信息表同源」。这条把两者钉在一起：
 * 将来往 flexProperties 里加了带短横线或空格的新值、却忘了配短码，会在这里当场失败。
 */
describe('urlCodec 与属性元信息表同源', () => {
  it('容器属性表里每个枚举值都能原样解回来', () => {
    for (const prop of containerProperties) {
      if (prop.kind !== 'enum')
        continue

      for (const option of prop.options) {
        const state = createDefaultState()
        const container = state.container as unknown as Record<string, string>
        container[prop.key] = option.value

        const back = decode(encode(state))
        const hint = `${prop.key}=${option.value}`

        expect(back, hint).not.toBeNull()
        expect((back!.container as unknown as Record<string, string>)[prop.key], hint).toBe(option.value)
      }
    }
  })

  it('盒子属性表里每个枚举值都能原样解回来', () => {
    for (const prop of itemProperties) {
      if (prop.kind !== 'enum')
        continue

      for (const option of prop.options) {
        const state = createDefaultState()
        const item = state.items[0] as unknown as Record<string, string>
        item[prop.key] = option.value

        const back = decode(encode(state))
        const hint = `${prop.key}=${option.value}`

        expect(back, hint).not.toBeNull()
        expect((back!.items[0] as unknown as Record<string, string>)[prop.key], hint).toBe(option.value)
      }
    }
  })

  /*
   * 光有 round-trip 还不够：不映射的值只要不撞上分隔符，字符串层面照样解得回来，
   * 可空格这类字符放进真实 URL 会被浏览器改写或在复制粘贴时截断。
   * 所以还要钉住「产物本身是合法 URL」——这才是短码表真正要防的东西。
   */
  it('任何枚举值下编码结果都只含 URL 安全字符', () => {
    const enumProps = [
      ...containerProperties.map(prop => ['container', prop] as const),
      ...itemProperties.map(prop => ['item', prop] as const),
    ]

    for (const [scope, prop] of enumProps) {
      if (prop.kind !== 'enum')
        continue

      for (const option of prop.options) {
        const state = createDefaultState()
        const target = (scope === 'container' ? state.container : state.items[0]) as unknown as Record<string, string>
        target[prop.key] = option.value

        // 分隔符 ?&=. 、数值与短码用的 -~ ，此外只许字母数字
        expect(encode(state), `${prop.key}=${option.value}`).toMatch(/^[\w?&=.,~-]+$/)
      }
    }
  })

  it('basis 的每个预设值都能原样解回来', () => {
    const basisProp = itemProperties.find(prop => prop.key === 'basis')
    if (basisProp?.kind !== 'text')
      throw new Error('basis 应当是 text 类型的属性')

    for (const preset of basisProp.presets) {
      const state = createDefaultState()
      state.items[0].basis = preset

      expect(decode(encode(state))?.items[0].basis, preset).toBe(preset)
    }
  })
})
