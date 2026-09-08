import { describe, expect, it } from 'vitest'
import { itemLabel } from './labels'

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
