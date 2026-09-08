import { describe, expect, it } from 'vitest'
import { createDefaultState } from '~/core/defaults'
import { containerProperties, flexShorthandPresets, itemProperties, visibleOptions } from './flexProperties'

const allProperties = [...containerProperties, ...itemProperties]

describe('属性元信息表', () => {
  it('每个属性的 key 唯一', () => {
    const keys = allProperties.map(prop => prop.key)
    expect(new Set(keys).size).toBe(keys.length)
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

  it('容器属性覆盖状态里所有可控字段（width/height 由拖拽控制，不在表内）', () => {
    const state = createDefaultState()
    const controllable = Object.keys(state.container).filter(key => key !== 'width' && key !== 'height')
    expect(containerProperties.map(prop => prop.key).sort()).toEqual(controllable.sort())
  })

  it('项目属性覆盖盒子状态里除 id 外的所有字段', () => {
    const state = createDefaultState()
    const controllable = Object.keys(state.items[0]).filter(key => key !== 'id')
    expect(itemProperties.map(prop => prop.key).sort()).toEqual(controllable.sort())
  })

  it('每个属性都带 MDN 链接与文案 key', () => {
    for (const prop of allProperties) {
      expect(prop.mdn).toMatch(/^https:\/\/developer\.mozilla\.org\//)
      expect(prop.labelKey.length).toBeGreaterThan(0)
    }
  })

  it('表里的默认值与 createDefaultState 一致', () => {
    const state = createDefaultState()
    for (const prop of containerProperties)
      expect(prop.default).toBe(state.container[prop.key as keyof typeof state.container])
    for (const prop of itemProperties)
      expect(prop.default).toBe(state.items[0][prop.key as keyof typeof state.items[0]])
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

describe('visibleOptions', () => {
  it('默认隐藏标记为 advanced 的近义值', () => {
    const justify = containerProperties.find(prop => prop.key === 'justifyContent')!
    if (justify.kind !== 'enum')
      throw new Error('justifyContent 应当是枚举属性')

    const common = visibleOptions(justify, false).map(option => option.value)
    const all = visibleOptions(justify, true).map(option => option.value)
    expect(common).toContain('space-between')
    expect(common).not.toContain('left')
    expect(all).toContain('left')
    expect(all.length).toBeGreaterThan(common.length)
  })
})
