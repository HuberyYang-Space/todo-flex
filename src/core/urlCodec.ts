import type { Direction, FlexContainerState, FlexItemState, FlexState, Wrap } from './types'
import { containerProperties, itemProperties } from '~/data/flexProperties'
import { createDefaultState, MAX_ITEMS, STAGE_LIMITS } from './defaults'

/** 格式一旦不兼容就进位，老链接会被拒掉而不是解出错的状态 */
const VERSION = '1'

/**
 * 长值 ↔ 短码。除了缩短 URL，更要紧的是躲开分隔符：item 段用 `-` 分字段，
 * 而 `flex-start` 这些合法值自带 `-`，不映射就会被多切出一段。
 * 规则：值里带 `-`、空格或其它分隔符的必须映射，其余一律原样，短码才读得懂、手写得出。
 */
const VALUE_CODES: Record<string, string> = {
  'inline-flex': 'iflex',
  'row-reverse': 'rr',
  'column-reverse': 'cr',
  'wrap-reverse': 'wr',
  'flex-start': 'fs',
  'flex-end': 'fe',
  'space-between': 'between',
  'space-around': 'around',
  'space-evenly': 'evenly',
  'first baseline': 'fbl',
  'last baseline': 'lbl',
  'self-start': 'ss',
  'self-end': 'se',
}

const CODE_VALUES: Record<string, string> = Object.fromEntries(
  Object.entries(VALUE_CODES).map(([value, code]) => [code, value]),
)

function toCode(value: string): string {
  return VALUE_CODES[value] ?? value
}

function fromCode(code: string): string {
  return CODE_VALUES[code] ?? code
}

/** 合法值直接取自属性元信息表，短码与面板不会各说各话 */
function allowedValues(props: typeof containerProperties, key: string): Set<string> | null {
  const prop = props.find(item => item.key === key)
  return prop?.kind === 'enum' ? new Set(prop.options.map(option => option.value)) : null
}

/** 面板输入框的 maxlength 与解码同一个上限，面板能输入的链接就一定解得回来 */
function textMaxLength(props: typeof itemProperties, key: string): number {
  const prop = props.find(item => item.key === key)
  if (prop?.kind !== 'text')
    throw new Error(`属性表里没有文本属性 ${key}`)
  return prop.maxLength
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 夹回属性表里该数值控件的区间，与面板滑块能调出的范围同源 */
function clampToProp(props: typeof containerProperties, key: string, value: number): number {
  const prop = props.find(item => item.key === key)
  if (prop?.kind !== 'number')
    throw new Error(`属性表里没有数值属性 ${key}`)
  return clamp(value, prop.min, prop.max)
}

/**
 * 只转义非字母数字的字符，`auto`、`120px` 这类常见值原样留着。
 *
 * 前缀必须是 `~` 而不是 `%`：URLSearchParams 读值时自己会做一次 percent-decoding，
 * 用 `%` 的话 `30%` 编成 `30%25`、取出来被还原成 `30%`，再解一次就是 URIError。
 * `~` 是 URL 的 unreserved 字符，传输层不会动它。
 */
const ESCAPE_PREFIX = '~'

function escapeText(value: string): string {
  return value.replace(/[^a-z0-9]/gi, char =>
    [...new TextEncoder().encode(char)]
      .map(byte => `${ESCAPE_PREFIX}${byte.toString(16).toUpperCase().padStart(2, '0')}`)
      .join(''))
}

function unescapeText(value: string): string | null {
  const bytes: number[] = []
  let index = 0

  while (index < value.length) {
    const char = value[index]
    if (char !== ESCAPE_PREFIX) {
      bytes.push(...new TextEncoder().encode(char))
      index += 1
      continue
    }

    const hex = value.slice(index + 1, index + 3)
    if (!/^[0-9a-f]{2}$/i.test(hex))
      return null
    bytes.push(Number.parseInt(hex, 16))
    index += 3
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
  }
  catch {
    return null
  }
}

/** `Number('')` 是 0、`Number('x')` 是 NaN，都得挡住 */
function parseNumber(raw: string): number | null {
  if (raw.trim() === '')
    return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

/**
 * 数字也要过转义：order 可以是负数，而 `-` 正是 item 段的字段分隔符。
 * 非负整数转义后一字不变，老链接照旧解得出来。
 */
function encodeNumber(value: number): string {
  return escapeText(String(value))
}

function parseEscapedNumber(raw: string): number | null {
  const text = unescapeText(raw)
  return text === null ? null : parseNumber(text)
}

function parseIntegerFlag(raw: string): boolean | null {
  if (raw === '1')
    return true
  if (raw === '0')
    return false
  return null
}

/** 含开头的问号，可直接喂给 replaceState */
export function encode(state: FlexState): string {
  const { container, items } = state

  const containerCode = [
    toCode(container.display),
    toCode(container.direction),
    toCode(container.wrap),
    toCode(container.justifyContent),
    toCode(container.alignItems),
    toCode(container.alignContent),
    encodeNumber(container.rowGap),
    encodeNumber(container.columnGap),
    encodeNumber(container.width),
    encodeNumber(container.height),
  ].join('.')

  const itemsCode = items
    .map(item => [
      encodeNumber(item.grow),
      encodeNumber(item.shrink),
      escapeText(item.basis),
      encodeNumber(item.order),
      toCode(item.alignSelf),
      encodeNumber(item.size),
      item.minWidthAuto ? 1 : 0,
      item.marginAuto ? 1 : 0,
    ].join('-'))
    .join(',')

  const parts = [`v=${VERSION}`, `c=${containerCode}`, `i=${itemsCode}`]

  // 存索引而不是 id：id 不参与序列化，decode 时按位置重建
  const selectedIndex = items.findIndex(item => item.id === state.selectedId)
  if (selectedIndex >= 0)
    parts.push(`sel=${selectedIndex}`)

  return `?${parts.join('&')}`
}

function decodeContainer(raw: string): FlexContainerState | null {
  const parts = raw.split('.')
  if (parts.length !== 10)
    return null

  const [display, direction, wrap, justifyContent, alignItems, alignContent] = parts.slice(0, 6).map(fromCode)
  const numbers = parts.slice(6).map(parseEscapedNumber)
  if (numbers.includes(null))
    return null

  const enums: [string, string][] = [
    ['display', display],
    ['direction', direction],
    ['wrap', wrap],
    ['justifyContent', justifyContent],
    ['alignItems', alignItems],
    ['alignContent', alignContent],
  ]
  for (const [key, value] of enums) {
    const allowed = allowedValues(containerProperties, key)
    if (!allowed?.has(value))
      return null
  }

  const [rowGap, columnGap, width, height] = numbers as number[]
  return {
    display: display as FlexContainerState['display'],
    direction: direction as Direction,
    wrap: wrap as Wrap,
    justifyContent,
    alignItems,
    alignContent,
    rowGap: clampToProp(containerProperties, 'rowGap', rowGap),
    columnGap: clampToProp(containerProperties, 'columnGap', columnGap),
    width: clamp(width, STAGE_LIMITS.minWidth, STAGE_LIMITS.maxWidth),
    height: clamp(height, STAGE_LIMITS.minHeight, STAGE_LIMITS.maxHeight),
  }
}

function decodeItem(raw: string, index: number): FlexItemState | null {
  const parts = raw.split('-')
  if (parts.length !== 8)
    return null

  const [growRaw, shrinkRaw, basisRaw, orderRaw, alignSelfRaw, sizeRaw, minWidthRaw, marginRaw] = parts

  const grow = parseEscapedNumber(growRaw)
  const shrink = parseEscapedNumber(shrinkRaw)
  const order = parseEscapedNumber(orderRaw)
  const size = parseEscapedNumber(sizeRaw)
  const basis = unescapeText(basisRaw)
  const minWidthAuto = parseIntegerFlag(minWidthRaw)
  const marginAuto = parseIntegerFlag(marginRaw)
  if (grow === null || shrink === null || order === null || size === null
    || basis === null || minWidthAuto === null || marginAuto === null) {
    return null
  }

  if (basis.length > textMaxLength(itemProperties, 'basis'))
    return null

  const alignSelf = fromCode(alignSelfRaw)
  if (!allowedValues(itemProperties, 'alignSelf')?.has(alignSelf))
    return null

  return {
    id: `item-${index + 1}`,
    grow: clampToProp(itemProperties, 'grow', grow),
    shrink: clampToProp(itemProperties, 'shrink', shrink),
    basis,
    order: clampToProp(itemProperties, 'order', order),
    alignSelf,
    size: clampToProp(itemProperties, 'size', size),
    minWidthAuto,
    marginAuto,
  }
}

/**
 * 带不带开头的 `?` 都吃。结构性错误（版本、段数、非法枚举）一律返回 `null`，绝不解出半对半错的状态。
 * 越界的数值夹回面板区间、超出上限的盒子截掉——链接能手写，但状态只能是面板调得出来的样子。
 * 没有 `v` 参数是正常的首次访问，不警告。
 */
export function decode(query: string): FlexState | null {
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query)

  const version = params.get('v')
  if (version === null)
    return null

  if (version !== VERSION) {
    console.warn(`[todo-flex] 无法识别的分享链接版本 v=${version}，已回退默认状态`)
    return null
  }

  const containerRaw = params.get('c')
  const itemsRaw = params.get('i')
  if (containerRaw === null || itemsRaw === null) {
    console.warn('[todo-flex] 分享链接缺少 c 或 i 参数，已回退默认状态')
    return null
  }

  const container = decodeContainer(containerRaw)
  const items = itemsRaw.split(',').slice(0, MAX_ITEMS).map(decodeItem)
  if (container === null || items.includes(null)) {
    console.warn('[todo-flex] 分享链接的内容无法解析，已回退默认状态')
    return null
  }

  const state: FlexState = {
    container,
    items: items as FlexItemState[],
    selectedId: null,
  }

  const selRaw = params.get('sel')
  if (selRaw !== null) {
    const index = parseNumber(selRaw)
    if (index === null || !Number.isInteger(index) || index < 0 || index >= state.items.length) {
      console.warn(`[todo-flex] 分享链接的选中项 sel=${selRaw} 越界，已忽略`)
    }
    else {
      state.selectedId = state.items[index].id
    }
  }

  return state
}

export function decodeOrDefault(query: string): FlexState {
  return decode(query) ?? createDefaultState()
}
