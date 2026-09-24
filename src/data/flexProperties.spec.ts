import type { FlexContainerState, FlexItemState } from '~/core/types'
import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from '~/core/defaults'
import { containerProperties, flexShorthandPresets, itemProperties, numberProp } from './flexProperties'

const allProperties = [...containerProperties, ...itemProperties]

describe('属性元信息表', () => {
  it('每个属性的 key 唯一', () => {
    const keys = allProperties.map(prop => prop.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  // 判据是 pnpm tscheck：拼错的 key 必须编译不过，运行期抛错只是兜底
  it('key 拼错在编译期就报错', () => {
    // @ts-expect-error 容器属性里没有 widht
    expect(() => numberProp(containerProperties, 'widht')).toThrow()
    // @ts-expect-error size 是盒子属性，不在容器属性表里
    expect(() => numberProp(containerProperties, 'size')).toThrow()

    // @ts-expect-error 表里的 key 同样受状态字段约束
    const typo: (typeof containerProperties)[number] = { kind: 'boolean', key: 'widht', cssName: 'widht', mdn: '', default: true }
    expect(typo.key).toBe('widht')
  })

  it('枚举属性的默认值必须出现在选项里', () => {
    for (const prop of allProperties) {
      if (prop.kind === 'enum')
        expect(prop.options.map(option => option.value)).toContain(prop.default)
    }
  })

  it('数值属性的默认值落在取值区间内', () => {
    for (const prop of allProperties) {
      if (prop.kind === 'number') {
        expect(prop.default).toBeGreaterThanOrEqual(prop.min)
        expect(prop.default).toBeLessThanOrEqual(prop.max)
      }
    }
  })

  // 用类型锚定字段清单：接口加了字段而这里没跟上，类型检查就报错；表里漏了，断言就红
  it('容器属性覆盖状态里所有字段', () => {
    const fields: Record<keyof FlexContainerState, true> = {
      display: true,
      width: true,
      height: true,
      direction: true,
      wrap: true,
      justifyContent: true,
      alignItems: true,
      alignContent: true,
      rowGap: true,
      columnGap: true,
    }
    expect(containerProperties.map(prop => prop.key).sort()).toEqual(Object.keys(fields).sort())
  })

  it('项目属性覆盖盒子状态里除 id 外的所有字段', () => {
    const fields: Record<Exclude<keyof FlexItemState, 'id'>, true> = {
      grow: true,
      shrink: true,
      basis: true,
      order: true,
      alignSelf: true,
      size: true,
      minWidthAuto: true,
      marginAuto: true,
    }
    expect(itemProperties.map(prop => prop.key).sort()).toEqual(Object.keys(fields).sort())
  })

  it('每个 CSS 属性都带 MDN 链接，仅演示区的属性不是 CSS、没有链接', () => {
    for (const prop of allProperties) {
      if (prop.demoOnly)
        expect(prop.mdn, prop.key).toBeUndefined()
      else
        expect(prop.mdn, prop.key).toMatch(/^https:\/\/developer\.mozilla\.org\//)
    }
  })

  it('只有内容尺寸标为仅演示区', () => {
    expect(allProperties.filter(prop => prop.demoOnly).map(prop => prop.key)).toEqual(['size'])
  })

  it('文本属性的默认值、预设都过得了自己的 check，flex 简写预设的 basis 也过得了', () => {
    for (const prop of allProperties) {
      if (prop.kind !== 'text')
        continue
      expect(prop.check(prop.default), prop.default).toBeNull()
      for (const preset of prop.presets)
        expect(prop.check(preset), preset).toBeNull()
    }

    const basis = itemProperties.find(prop => prop.key === 'basis')
    if (basis?.kind !== 'text')
      throw new Error('basis 应当是 text 类型的属性')
    for (const preset of flexShorthandPresets)
      expect(basis.check(preset.basis), preset.label).toBeNull()
  })

  it('文本属性的默认值与预设已经是规范写法，规范化不会改动它们', () => {
    for (const prop of allProperties) {
      if (prop.kind !== 'text')
        continue
      for (const value of [prop.default, ...prop.presets])
        expect(prop.normalize(value), value).toBe(value)
    }
  })

  it('basis 的 check 对被拒的值给出改法', () => {
    const basis = itemProperties.find(prop => prop.key === 'basis')
    if (basis?.kind !== 'text')
      throw new Error('basis 应当是 text 类型的属性')

    expect(basis.check('50')).toContain('50px')
    expect(basis.check('initial')).toContain('auto')
    expect(basis.check('var(--x)')).toContain('var()')
    expect(basis.check('calc-size(auto, size)')).toContain('calc-size()')
    expect(basis.check('calc(100%-20px)')).toContain('两边要留空格')
    expect(basis.check('abc')).toContain('不是合法的 flex-basis')
  })

  describe('默认值只在属性表里写一份', () => {
    const sizeProp = itemProperties.find(prop => prop.key === 'size')!
    const gapProp = containerProperties.find(prop => prop.key === 'rowGap')!
    const widthProp = containerProperties.find(prop => prop.key === 'width')!
    const [originalSize, originalGap, originalWidth] = [sizeProp.default, gapProp.default, widthProp.default]

    afterEach(() => {
      sizeProp.default = originalSize
      gapProp.default = originalGap
      widthProp.default = originalWidth
    })

    it('改了表里的默认值，初始状态跟着变', () => {
      sizeProp.default = 123
      gapProp.default = 7
      widthProp.default = 640

      expect(createDefaultItem('x').size).toBe(123)
      expect(createDefaultState().container.rowGap).toBe(7)
      expect(createDefaultState().container.width).toBe(640)
    })
  })
})

describe('flex 简写预设', () => {
  it('覆盖四种常见取值', () => {
    expect(flexShorthandPresets.map(preset => preset.label)).toEqual(['1', 'auto', 'initial', 'none'])
  })

  it('每个预设都展开成明确的三元组', () => {
    const byLabel = new Map(flexShorthandPresets.map(preset => [preset.label, preset]))
    expect(byLabel.get('1')).toMatchObject({ grow: 1, shrink: 1, basis: '0' })
    expect(byLabel.get('auto')).toMatchObject({ grow: 1, shrink: 1, basis: 'auto' })
    expect(byLabel.get('initial')).toMatchObject({ grow: 0, shrink: 1, basis: 'auto' })
    expect(byLabel.get('none')).toMatchObject({ grow: 0, shrink: 0, basis: 'auto' })
  })

  it('initial 预设与默认盒子一致', () => {
    const initial = flexShorthandPresets.find(preset => preset.label === 'initial')!
    const item = createDefaultState().items[0]
    expect([initial.grow, initial.shrink, initial.basis]).toEqual([item.grow, item.shrink, item.basis])
  })
})
