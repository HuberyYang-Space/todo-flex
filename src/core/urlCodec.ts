import type { Direction, FlexContainerState, FlexItemState, FlexState, Wrap } from './types'
import { containerProperties, itemProperties } from '~/data/flexProperties'
import { createDefaultState } from './defaults'

/** 短码格式的版本号。格式一旦不兼容就进位，老链接会被 decode 拒掉而不是解出错的状态 */
const VERSION = '1'

/**
 * 长值 ↔ 短码。两个目的，缺一不可：
 * 1. 缩短 URL；
 * 2. **躲开分隔符**——item 段用 `-` 分字段，而 `flex-start` / `self-end` 这些合法值自带 `-`，
 *    不映射的话 `1-1-auto-0-flex-start-80-1-0` 会被切成 9 段。含空格的 `first baseline` 同理。
 *
 * 所以规则是：**值里带 `-`、空格或其它分隔符的必须映射，其余一律原样**，
 * 好让 `flex.row.nowrap.fs.stretch.normal.12.12.720.320` 这样的短码仍然读得懂、手写得出来。
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

/** 某个枚举属性的合法值集合，直接取自属性元信息表——短码表与面板不会各说各话 */
function allowedValues(props: typeof containerProperties, key: string): Set<string> | null {
  const prop = props.find(item => item.key === key)
  return prop?.kind === 'enum' ? new Set(prop.options.map(option => option.value)) : null
}

/**
 * basis 是自由文本（`auto` / `120px` / `30%` / `calc(...)`），可能带上分隔符甚至百分号。
 * 只把非字母数字的字符转义掉，`auto` 和 `120px` 这类常见值原样留着，可读性不受影响。
 *
 * **转义前缀必须是 `~` 而不是 `%`**：URLSearchParams 读值时自己会做一次 percent-decoding，
 * 用 `%` 的话 `30%` 编成 `30%25`、取出来又被还原成 `30%`，再解一次就是 URIError。
 * `~` 是 URL 的 unreserved 字符，从头到尾没人会动它，转义层与传输层就不会互相打架。
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

/** 解析一个有限数字，非法返回 null——`Number('')` 是 0、`Number('x')` 是 NaN，都得挡住 */
function parseNumber(raw: string): number | null {
  if (raw.trim() === '')
    return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function parseIntegerFlag(raw: string): boolean | null {
  if (raw === '1')
    return true
  if (raw === '0')
    return false
  return null
}

/** 把状态编成 `?v=1&c=…&i=…` 形式的查询串（含问号，可直接喂给 replaceState） */
export function encode(state: FlexState): string {
  const { container, items } = state

  const containerCode = [
    toCode(container.display),
    toCode(container.direction),
    toCode(container.wrap),
    toCode(container.justifyContent),
    toCode(container.alignItems),
    toCode(container.alignContent),
    container.rowGap,
    container.columnGap,
    container.width,
    container.height,
  ].join('.')

  const itemsCode = items
    .map(item => [
      item.grow,
      item.shrink,
      escapeText(item.basis),
      item.order,
      toCode(item.alignSelf),
      item.size,
      item.minWidthAuto ? 1 : 0,
      item.marginAuto ? 1 : 0,
    ].join('-'))
    .join(',')

  const parts = [`v=${VERSION}`, `c=${containerCode}`, `i=${itemsCode}`]

  // 选中项存索引而不是 id：id 不参与序列化，decode 时按位置重建，存索引才不会失配
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
  const numbers = parts.slice(6).map(parseNumber)
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
    rowGap,
    columnGap,
    width,
    height,
  }
}

function decodeItem(raw: string, index: number): FlexItemState | null {
  const parts = raw.split('-')
  if (parts.length !== 8)
    return null

  const [growRaw, shrinkRaw, basisRaw, orderRaw, alignSelfRaw, sizeRaw, minWidthRaw, marginRaw] = parts

  const grow = parseNumber(growRaw)
  const shrink = parseNumber(shrinkRaw)
  const order = parseNumber(orderRaw)
  const size = parseNumber(sizeRaw)
  const basis = unescapeText(basisRaw)
  const minWidthAuto = parseIntegerFlag(minWidthRaw)
  const marginAuto = parseIntegerFlag(marginRaw)
  if (grow === null || shrink === null || order === null || size === null
    || basis === null || minWidthAuto === null || marginAuto === null) {
    return null
  }

  const alignSelf = fromCode(alignSelfRaw)
  if (!allowedValues(itemProperties, 'alignSelf')?.has(alignSelf))
    return null

  return {
    id: `item-${index + 1}`,
    grow,
    shrink,
    basis,
    order,
    alignSelf,
    size,
    minWidthAuto,
    marginAuto,
  }
}

/**
 * 把查询串解回状态。带不带开头的 `?` 都吃。
 *
 * 任何一处对不上（版本不符、段数不对、值不在属性表里）都返回 `null`，交给调用方回退默认状态——
 * **绝不解出一个半对半错的状态**，那比白屏更难查。没有 `v` 参数属于正常的首次访问，不算错，也不警告。
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
  const items = itemsRaw.split(',').map(decodeItem)
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

/** 解不出来就给默认状态，调用方不必自己兜底 */
export function decodeOrDefault(query: string): FlexState {
  return decode(query) ?? createDefaultState()
}
