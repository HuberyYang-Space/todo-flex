const MDN = 'https://developer.mozilla.org/zh-CN/docs/Web/CSS'

export interface PropertyOption {
  value: string
  /** 标记为 true 的选项收进「更多值」折叠区，避免面板被近义值撑爆 */
  advanced?: boolean
}

interface PropertyBase {
  key: string
  /** 对应的 CSS 属性名，直接展示在面板上 */
  cssName: string
  labelKey: string
  mdn: string
}

export type PropertyDef
  = | (PropertyBase & { kind: 'enum', options: PropertyOption[], default: string })
    | (PropertyBase & { kind: 'number', min: number, max: number, step: number, default: number })
    | (PropertyBase & { kind: 'boolean', default: boolean })
    | (PropertyBase & { kind: 'text', presets: string[], default: string })

export const containerProperties: PropertyDef[] = [
  {
    kind: 'enum',
    key: 'display',
    cssName: 'display',
    labelKey: 'prop.display',
    mdn: `${MDN}/display`,
    options: [{ value: 'flex' }, { value: 'inline-flex' }],
    default: 'flex',
  },
  {
    kind: 'enum',
    key: 'direction',
    cssName: 'flex-direction',
    labelKey: 'prop.direction',
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
    labelKey: 'prop.wrap',
    mdn: `${MDN}/flex-wrap`,
    options: [{ value: 'nowrap' }, { value: 'wrap' }, { value: 'wrap-reverse' }],
    default: 'nowrap',
  },
  {
    kind: 'enum',
    key: 'justifyContent',
    cssName: 'justify-content',
    labelKey: 'prop.justifyContent',
    mdn: `${MDN}/justify-content`,
    options: [
      { value: 'flex-start' },
      { value: 'center' },
      { value: 'flex-end' },
      { value: 'space-between' },
      { value: 'space-around' },
      { value: 'space-evenly' },
      { value: 'start', advanced: true },
      { value: 'end', advanced: true },
      { value: 'left', advanced: true },
      { value: 'right', advanced: true },
    ],
    default: 'flex-start',
  },
  {
    kind: 'enum',
    key: 'alignItems',
    cssName: 'align-items',
    labelKey: 'prop.alignItems',
    mdn: `${MDN}/align-items`,
    options: [
      { value: 'stretch' },
      { value: 'flex-start' },
      { value: 'center' },
      { value: 'flex-end' },
      { value: 'baseline' },
      { value: 'first baseline', advanced: true },
      { value: 'last baseline', advanced: true },
      { value: 'self-start', advanced: true },
      { value: 'self-end', advanced: true },
    ],
    default: 'stretch',
  },
  {
    kind: 'enum',
    key: 'alignContent',
    cssName: 'align-content',
    labelKey: 'prop.alignContent',
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
    labelKey: 'prop.rowGap',
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
    labelKey: 'prop.columnGap',
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
    labelKey: 'prop.grow',
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
    labelKey: 'prop.shrink',
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
    labelKey: 'prop.basis',
    mdn: `${MDN}/flex-basis`,
    presets: ['auto', 'content', '0', '100px', '30%'],
    default: 'auto',
  },
  {
    kind: 'number',
    key: 'order',
    cssName: 'order',
    labelKey: 'prop.order',
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
    labelKey: 'prop.alignSelf',
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
    labelKey: 'prop.size',
    mdn: `${MDN}/width`,
    min: 20,
    max: 400,
    step: 10,
    default: 80,
  },
  {
    kind: 'boolean',
    key: 'minWidthAuto',
    cssName: 'min-width: auto',
    labelKey: 'prop.minWidthAuto',
    mdn: `${MDN}/min-width`,
    default: true,
  },
  {
    kind: 'boolean',
    key: 'marginAuto',
    cssName: 'margin: auto',
    labelKey: 'prop.marginAuto',
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

/** flex 简写的四种常见取值，点击后回填三个分量——这本身就是一堂课 */
export const flexShorthandPresets: FlexShorthandPreset[] = [
  { label: '1', grow: 1, shrink: 1, basis: '0' },
  { label: 'auto', grow: 1, shrink: 1, basis: 'auto' },
  { label: 'initial', grow: 0, shrink: 1, basis: 'auto' },
  { label: 'none', grow: 0, shrink: 0, basis: 'auto' },
]

/** 折叠区未展开时，只给出常用值 */
export function visibleOptions(prop: PropertyDef, showAdvanced: boolean): PropertyOption[] {
  if (prop.kind !== 'enum')
    return []
  return showAdvanced ? prop.options : prop.options.filter(option => !option.advanced)
}
