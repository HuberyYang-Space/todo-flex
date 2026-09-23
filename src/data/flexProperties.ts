import type { BasisIssue } from '~/core/basisSyntax'
import { basisIssue, normalizeBasis } from '~/core/basisSyntax'

const MDN = 'https://developer.mozilla.org/zh-CN/docs/Web/CSS'

interface PropertyOption {
  value: string
}

/** 只作用于演示区的属性不是 CSS，面板标出来、CSS 区说明它不会导出，也没有 MDN 文档可链 */
type PropertyBase = { key: string, cssName: string } & ({ mdn: string, demoOnly?: never } | { demoOnly: true, mdn?: never })

export type PropertyDef
  = | (PropertyBase & { kind: 'enum', options: PropertyOption[], default: string })
    | (PropertyBase & { kind: 'number', min: number, max: number, step: number, default: number })
    | (PropertyBase & { kind: 'boolean', default: boolean })
    | (PropertyBase & {
      kind: 'text'
      presets: string[]
      maxLength: number
      default: string
      /** 被拒时返回提示文案，收下返回 null。分享链接解码走同一道关 */
      check: (value: string) => string | null
      /** 收下的值写进状态前的规范写法，导出的 CSS 与预设高亮才对得上 */
      normalize: (value: string) => string
    })

type NumberPropertyDef = Extract<PropertyDef, { kind: 'number' }>

/** 区间只在表里写一份，拖拽手柄与链接解码都从这里读 */
export function numberProp(props: PropertyDef[], key: string): NumberPropertyDef {
  const prop = props.find(item => item.key === key)
  if (prop?.kind !== 'number')
    throw new Error(`属性表里没有数值属性 ${key}`)
  return prop
}

const BASIS_HINTS: Record<BasisIssue, string> = {
  'unitless': '非 0 数值要带单位，比如 50px',
  'global-keyword': '全局关键字不能写进 flex 简写，想要默认值请用 auto',
  'substitution': '本站没有可供 var()、env()、attr() 引用的值，请直接写长度',
  'calc-size': 'calc-size() 写进 flex 简写会让整条声明失效',
  'math-syntax': '数学函数写法有误：+ 和 - 两边要留空格，结果要是长度或百分比，比如 calc(100% - 20px)',
  'unsupported': '不是合法的 flex-basis，可以写 auto、content、100px、30% 或 calc()',
}

export const containerProperties: PropertyDef[] = [
  {
    kind: 'enum',
    key: 'display',
    cssName: 'display',
    mdn: `${MDN}/display`,
    options: [{ value: 'flex' }, { value: 'inline-flex' }],
    default: 'flex',
  },
  {
    kind: 'number',
    key: 'width',
    cssName: 'width',
    mdn: `${MDN}/width`,
    min: 200,
    max: 1200,
    step: 1,
    default: 720,
  },
  {
    kind: 'number',
    key: 'height',
    cssName: 'height',
    mdn: `${MDN}/height`,
    min: 120,
    max: 600,
    step: 1,
    default: 320,
  },
  {
    kind: 'enum',
    key: 'direction',
    cssName: 'flex-direction',
    mdn: `${MDN}/flex-direction`,
    options: [
      { value: 'row' },
      { value: 'row-reverse' },
      { value: 'column' },
      { value: 'column-reverse' },
    ],
    default: 'row',
  },
  {
    kind: 'enum',
    key: 'wrap',
    cssName: 'flex-wrap',
    mdn: `${MDN}/flex-wrap`,
    options: [{ value: 'nowrap' }, { value: 'wrap' }, { value: 'wrap-reverse' }],
    default: 'nowrap',
  },
  {
    kind: 'enum',
    key: 'justifyContent',
    cssName: 'justify-content',
    mdn: `${MDN}/justify-content`,
    options: [
      { value: 'flex-start' },
      { value: 'center' },
      { value: 'flex-end' },
      { value: 'space-between' },
      { value: 'space-around' },
      { value: 'space-evenly' },
      { value: 'start' },
      { value: 'end' },
      { value: 'left' },
      { value: 'right' },
    ],
    default: 'flex-start',
  },
  {
    kind: 'enum',
    key: 'alignItems',
    cssName: 'align-items',
    mdn: `${MDN}/align-items`,
    options: [
      { value: 'stretch' },
      { value: 'flex-start' },
      { value: 'center' },
      { value: 'flex-end' },
      { value: 'baseline' },
      { value: 'first baseline' },
      { value: 'last baseline' },
      { value: 'self-start' },
      { value: 'self-end' },
    ],
    default: 'stretch',
  },
  {
    kind: 'enum',
    key: 'alignContent',
    cssName: 'align-content',
    mdn: `${MDN}/align-content`,
    options: [
      { value: 'normal' },
      { value: 'flex-start' },
      { value: 'center' },
      { value: 'flex-end' },
      { value: 'space-between' },
      { value: 'space-around' },
      { value: 'space-evenly' },
      { value: 'stretch' },
    ],
    default: 'normal',
  },
  {
    kind: 'number',
    key: 'rowGap',
    cssName: 'row-gap',
    mdn: `${MDN}/row-gap`,
    min: 0,
    max: 64,
    step: 1,
    default: 12,
  },
  {
    kind: 'number',
    key: 'columnGap',
    cssName: 'column-gap',
    mdn: `${MDN}/column-gap`,
    min: 0,
    max: 64,
    step: 1,
    default: 12,
  },
]

export const itemProperties: PropertyDef[] = [
  {
    kind: 'number',
    key: 'grow',
    cssName: 'flex-grow',
    mdn: `${MDN}/flex-grow`,
    min: 0,
    max: 10,
    step: 1,
    default: 0,
  },
  {
    kind: 'number',
    key: 'shrink',
    cssName: 'flex-shrink',
    mdn: `${MDN}/flex-shrink`,
    min: 0,
    max: 10,
    step: 1,
    default: 1,
  },
  {
    kind: 'text',
    key: 'basis',
    cssName: 'flex-basis',
    mdn: `${MDN}/flex-basis`,
    presets: ['auto', 'content', '0', '100px', '30%'],
    maxLength: 40,
    default: 'auto',
    check: (value) => {
      const issue = basisIssue(value)
      return issue === null ? null : BASIS_HINTS[issue]
    },
    normalize: normalizeBasis,
  },
  {
    kind: 'number',
    key: 'order',
    cssName: 'order',
    mdn: `${MDN}/order`,
    min: -5,
    max: 5,
    step: 1,
    default: 0,
  },
  {
    kind: 'enum',
    key: 'alignSelf',
    cssName: 'align-self',
    mdn: `${MDN}/align-self`,
    options: [
      { value: 'auto' },
      { value: 'stretch' },
      { value: 'flex-start' },
      { value: 'center' },
      { value: 'flex-end' },
      { value: 'baseline' },
    ],
    default: 'auto',
  },
  {
    kind: 'number',
    key: 'size',
    cssName: '内容尺寸',
    demoOnly: true,
    min: 20,
    max: 400,
    step: 10,
    default: 80,
  },
  {
    kind: 'boolean',
    key: 'minWidthAuto',
    cssName: 'min-width: auto',
    mdn: `${MDN}/min-width`,
    default: true,
  },
  {
    kind: 'boolean',
    key: 'marginAuto',
    cssName: 'margin: auto',
    mdn: `${MDN}/margin`,
    default: false,
  },
]

export interface FlexShorthandPreset {
  label: string
  grow: number
  shrink: number
  basis: string
}

export const flexShorthandPresets: FlexShorthandPreset[] = [
  { label: '1', grow: 1, shrink: 1, basis: '0' },
  { label: 'auto', grow: 1, shrink: 1, basis: 'auto' },
  { label: 'initial', grow: 0, shrink: 1, basis: 'auto' },
  { label: 'none', grow: 0, shrink: 0, basis: 'auto' },
]
