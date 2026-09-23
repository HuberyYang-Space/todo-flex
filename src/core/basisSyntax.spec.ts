import type { BasisIssue } from './basisSyntax'
import { describe, expect, it } from 'vitest'
import { basisIssue, basisKind } from './basisSyntax'
import chrome from './basisSyntax.chrome.json'

const STATIC = [
  '50px',
  '30%',
  '0',
  'auto',
  'content',
  '2em',
  '0.5rem',
  '12.5%',
  'max-content',
  'min-content',
  'fit-content',
  'AUTO',
  ' auto ',
  '1in',
  '2.54cm',
  '72pt',
  '6pc',
  '10mm',
  '40q',
  '+10px',
  '.5px',
  '1e2px',
  '0.0',
  '\t100px',
  '100px\n',
  '1PX',
]

const RUNTIME = [
  'calc(50% - 10px)',
  'min(100px, 50%)',
  'max(10px, 5em)',
  'clamp(10px, 5em, 100px)',
  'round(10px, 3px)',
  'mod(10px, 3px)',
  'rem(10px, 3px)',
  'abs(-10px)',
  'hypot(3px, 4px)',
  'round(up, 10px, 3px)',
  'CALC(10px)',
  'calc( 1px )',
  'calc(10px * 2)',
  'calc(2 * 10px)',
  'calc(10px / 2)',
  'calc((10px + 5px) * 2)',
  'calc(10% + 5px)',
  'calc(-10px + 20px)',
  'min(10%, 5px)',
  'max(calc(1px + 2px), 3px)',
  'calc(1px*2)',
  '5ch',
  '3ex',
  '2lh',
  '10vw',
  '5cqw',
]

const REJECTED: Record<BasisIssue, string[]> = {
  'unitless': ['50', '12.5', '1e3'],
  'global-keyword': ['initial', 'inherit', 'unset', 'revert', 'revert-layer', 'INITIAL', ' inherit '],
  'substitution': [
    'var(--x)',
    'var(--x, 10px)',
    'env(x)',
    'env(x, 10px)',
    'attr(data-x px)',
    'attr(data-x px, 10px)',
    'VAR(--x)',
    'calc(var(--x))',
    'min(10px, var(--y))',
    'calc(1px + env(x))',
    'max(attr(data-x px), 1px)',
  ],
  'calc-size': ['calc-size(auto, size)', 'Calc-Size(auto, size)', 'min(calc-size(auto, size), 10px)'],
  'math-syntax': [
    'calc(100%-20px)',
    'calc(100% -20px)',
    'calc(1px +2px)',
    'calc(50)',
    'calc(auto)',
    'calc()',
    'min()',
    'min(10px,)',
    'max(1px 2px)',
    'clamp(1px, 2px)',
    'abs(10)',
    'calc(1px) calc(2px)',
    'calc(100px))',
    'calc(10px * 10px)',
  ],
  'unsupported': [
    '100pxx',
    'abc',
    '-10px',
    '',
    '50 px',
    'fit-content(100px)',
    'foo(1px)',
    'sign(-1px)',
    'minmax(10px, 20px)',
    'anchor-size(width)',
    '0.',
    '100.px',
    '0.px',
    '1.e2px',
    '\u00A0100px',
    '100px\u00A0',
    '1fr',
    '10px;color:red',
    '10px !important',
    'calc(1px)}*{display:none}a{b:calc(1px)',
  ],
}

const rejectedCases = Object.entries(REJECTED).flatMap(([issue, values]) => values.map(value => [value, issue] as const))

describe('basisKind', () => {
  it.each(STATIC)('%j 静态可算', (basis) => {
    expect(basisKind(basis)).toBe('static')
  })

  it.each(RUNTIME)('%j 合法，但要到运行期才能确定', (basis) => {
    expect(basisKind(basis)).toBe('runtime')
  })

  it.each(rejectedCases)('%j 本站不收', (basis) => {
    expect(basisKind(basis)).toBe('rejected')
  })
})

describe('basisIssue', () => {
  it.each([...STATIC, ...RUNTIME])('%j 收下，没有问题', (basis) => {
    expect(basisIssue(basis)).toBeNull()
  })

  it.each(rejectedCases)('%j 被拒，原因是 %s', (basis, issue) => {
    expect(basisIssue(basis)).toBe(issue)
  })
})

// 夹具由 basisSyntax.probe.html 在真实 Chrome 里生成：每个候选值分别写成 `flex: 2 3 <值>` 与三条单项属性，
// 计算值与 offsetWidth 全部相同才算 consistent。候选集覆盖全部长度单位、一批非长度单位、数字的各种写法、
// 写错的数学函数、首尾空白与收下示例的每个打字前缀——断言的是分类器本身，不只是上面这几张例子表
describe('basis 分类与真实 Chrome 对拍', () => {
  const rows = new Map(chrome.rows.map(row => [row.value, row]))

  it('夹具自证：已知在简写里失效的值确实测出了不一致，正常值测出一致', () => {
    for (const value of ['50', 'initial', 'var(--x)', 'calc-size(auto, size)', '0.', 'calc(100%-20px)', '1fr'])
      expect(rows.get(value)?.consistent, value).toBe(false)
    expect(rows.get('50px')?.consistent).toBe(true)
  })

  it('夹具覆盖了每个收下的示例和它的每个打字前缀', () => {
    for (const basis of [...STATIC, ...RUNTIME]) {
      for (let end = 1; end <= basis.length; end++)
        expect(rows.has(basis.slice(0, end)), `${JSON.stringify(basis.slice(0, end))} 没在 Chrome 里测过，先重新生成夹具`).toBe(true)
    }
  })

  it('夹具里被收下的每一个值，简写与单项属性都一致', () => {
    const leaks = chrome.rows.filter(row => !row.consistent && basisIssue(row.value) === null).map(row => row.value)
    expect(leaks).toEqual([])
  })
})
