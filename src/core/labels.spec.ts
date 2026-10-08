import { describe, expect, it } from 'vitest'
import { formatNumber, itemLabel, px, roundTenth } from './labels'

describe('itemLabel', () => {
  it('按索引给出 A、B、C 的盒子标签', () => {
    expect(itemLabel(0)).toBe('A')
    expect(itemLabel(2)).toBe('C')
  })

  it('超过 26 个盒子后回绕，不会给出非字母标签', () => {
    // 盒子数上限是 8，回绕只是防御；重点是绝不产出 '[' 这类紧邻 Z 的字符
    expect(itemLabel(26)).toBe('A')
  })
})

describe('数字显示', () => {
  it('保留 1 位小数', () => {
    expect(roundTenth(306.666)).toBe(306.7)
    expect(px(306.666)).toBe('306.7px')
  })

  it('负数用数学负号 U+2212，读作减号而不是连字符', () => {
    expect(formatNumber(-47.647)).toBe('−47.6')
    expect(px(-190)).toBe('−190px')
  })

  it('舍入到 0 的负数不显示成 −0', () => {
    expect(formatNumber(-0.04)).toBe('0')
  })

  it('因子可以多留一位小数', () => {
    expect(formatNumber(0.333, 2)).toBe('0.33')
    expect(formatNumber(1, 2)).toBe('1')
  })
})
