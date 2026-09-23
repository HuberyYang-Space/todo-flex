/**
 * flex-basis 的语法分类：浏览器怎么认它，本站收不收它。
 * 不 import 任何模块：属性表要用它给输入框把关，而 core 的其余模块反过来依赖属性表，放进去就成环。
 *
 * 判定是保守的：只收写法确定合法的子集，拿不准的一律拒。错拒一个其实合法的值只是少一种写法，
 * 错收一个值会让导出的 `flex` 简写整条失效、与演示区对不上。收下即一致，由 basisSyntax.chrome.json 的真实 Chrome 夹具证明。
 */

/**
 * - `static`：推导引擎能算出像素值
 * - `runtime`：合法，但取值要到运行期才能确定（字体度量、视口、`calc()` 等），推导引擎拿不到
 * - `rejected`：本站不收。放进 `flex` 简写会让整条声明失效，而演示区用的单项属性只丢掉 basis，
 *   收下它，导出的 CSS 就复现不出演示区的布局
 */
type BasisKind = 'static' | 'runtime' | 'rejected'

export type BasisIssue = 'unitless' | 'global-keyword' | 'substitution' | 'calc-size' | 'math-syntax' | 'unsupported'

/** 演示区的内容是一块固定尺寸的占位，max-content、min-content、fit-content 都等于它，与 auto 同值 */
const AUTO_LIKE = new Set(['auto', 'content', 'max-content', 'min-content', 'fit-content'])

/** 单项属性认、简写不认 */
const GLOBAL_KEYWORDS = new Set(['initial', 'inherit', 'unset', 'revert', 'revert-layer'])

export const PX_PER_UNIT = new Map([
  ['px', 1],
  ['in', 96],
  ['cm', 96 / 2.54],
  ['mm', 96 / 25.4],
  ['q', 96 / 101.6],
  ['pt', 96 / 72],
  ['pc', 16],
])

/** 演示区把字号钉在 1rem，em 与 rem 同值 */
export const FONT_RELATIVE_UNITS = new Set(['em', 'rem'])

const RUNTIME_UNITS = new Set([
  'ex',
  'rex',
  'cap',
  'rcap',
  'ch',
  'rch',
  'ic',
  'ric',
  'lh',
  'rlh',
  'vw',
  'vh',
  'vi',
  'vb',
  'vmin',
  'vmax',
  'svw',
  'svh',
  'svi',
  'svb',
  'svmin',
  'svmax',
  'lvw',
  'lvh',
  'lvi',
  'lvb',
  'lvmin',
  'lvmax',
  'dvw',
  'dvh',
  'dvi',
  'dvb',
  'dvmin',
  'dvmax',
  'cqw',
  'cqh',
  'cqi',
  'cqb',
  'cqmin',
  'cqmax',
])

/**
 * 收下的数学函数与参数个数。其余函数一律拒：fit-content()、minmax()、anchor-size() 浏览器本就不认；
 * sign()、exp() 这类结果是纯数，只能嵌在乘除里用，拿不准就不收
 */
const MATH_ARITY = new Map<string, [min: number, max: number]>([
  ['calc', [1, 1]],
  ['min', [1, Infinity]],
  ['max', [1, Infinity]],
  ['clamp', [3, 3]],
  ['round', [2, 2]],
  ['mod', [2, 2]],
  ['rem', [2, 2]],
  ['abs', [1, 1]],
  ['hypot', [1, Infinity]],
])

const ROUNDING_STRATEGIES = new Set(['nearest', 'up', 'down', 'to-zero'])

/** 嵌在哪一层都算：引用不到东西时简写在计算期整条失效；带回退的两边虽一致，演示区也没有可引用的东西 */
const SUBSTITUTION = /(?:^|[^a-z-])(?:var|env|attr)\(/
const CALC_SIZE = /(?:^|[^a-z-])calc-size\(/

type Token
  = | { type: 'ws' }
    | { type: 'number', value: number, unit: string }
    | { type: 'function', name: string }
    | { type: 'ident', name: string }
    | { type: 'delim', char: string }

type CalcType = 'number' | 'length' | 'percentage' | 'length-percentage'

interface Classified {
  kind: BasisKind
  issue: BasisIssue | null
  length?: { value: number, unit: string }
}

/**
 * 规范写法：去掉首尾的 CSS 空白、统一小写。收下的写法只含数字、单位、关键字与数学函数名，大小写都不敏感。
 * 只去 CSS 空白：trim() 连 NBSP 一起去掉，而 CSS 不把 NBSP 当空白，从网页复制来的值常带它
 */
export function normalizeBasis(basis: string): string {
  return basis.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '').toLowerCase()
}

const TOKEN_RULES: [RegExp, (match: RegExpExecArray) => Token][] = [
  [/^[ \t\n\r\f]+/, () => ({ type: 'ws' })],
  // 小数点后必须有数字：`0.` `100.px` 浏览器不认，放行就会在打字途中把它写进状态
  [/^([+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?/, match => ({ type: 'number', value: Number(match[1]), unit: match[2] ?? '' })],
  [/^(-?[a-z][a-z-]*)\(/, match => ({ type: 'function', name: match[1] })],
  [/^-?[a-z][a-z-]*/, match => ({ type: 'ident', name: match[0] })],
  [/^[(),*/+-]/, match => ({ type: 'delim', char: match[0] })],
]

/** 切不动的字符（`;` `{` `!` 引号、NBSP……）直接返回 null，它们也就进不了导出的 CSS */
function tokenize(raw: string): Token[] | null {
  const tokens: Token[] = []
  let rest = raw
  while (rest) {
    const hit = TOKEN_RULES.map(([pattern, build]) => [pattern.exec(rest), build] as const).find(([match]) => match)
    if (!hit)
      return null
    const [match, build] = hit
    tokens.push(build(match!))
    rest = rest.slice(match![0].length)
  }
  return tokens
}

/** 加减与逗号两边的类型要能合并：长度与百分比合成 length-percentage，纯数不能和它们混 */
function combine(a: CalcType, b: CalcType): CalcType | null {
  if (a === b)
    return a
  return a === 'number' || b === 'number' ? null : 'length-percentage'
}

function isDelim(token: Token | undefined, char: string): boolean {
  return token?.type === 'delim' && token.char === char
}

/** 整串必须恰好是一个数学函数；返回结果类型，写法不合法返回 null */
function parseMath(tokens: Token[]): CalcType | null {
  let pos = 0

  function skipWs(): boolean {
    const start = pos
    while (tokens[pos]?.type === 'ws')
      pos++
    return pos > start
  }

  function value(): CalcType | null {
    skipWs()
    const token = tokens[pos++]
    if (token?.type === 'number') {
      if (token.unit === '')
        return 'number'
      if (token.unit === '%')
        return 'percentage'
      return PX_PER_UNIT.has(token.unit) || FONT_RELATIVE_UNITS.has(token.unit) || RUNTIME_UNITS.has(token.unit) ? 'length' : null
    }
    if (isDelim(token, '(')) {
      const type = sum()
      skipWs()
      return isDelim(tokens[pos++], ')') ? type : null
    }
    return token?.type === 'function' ? mathFunction(token.name) : null
  }

  function product(): CalcType | null {
    let type = value()
    while (type) {
      const save = pos
      skipWs()
      const operator = tokens[pos]
      if (!isDelim(operator, '*') && !isDelim(operator, '/')) {
        pos = save
        break
      }
      pos++
      const rhs = value()
      if (!rhs)
        return null
      // 乘法至少一边是纯数；除数必须是纯数（长度除以长度的写法各浏览器支持不一，不收）
      if (isDelim(operator, '*'))
        type = type === 'number' ? rhs : rhs === 'number' ? type : null
      else
        type = rhs === 'number' ? type : null
    }
    return type
  }

  function sum(): CalcType | null {
    let type = product()
    while (type) {
      const save = pos
      // + 与 - 两边必须有空白：`100%-20px` 会被切成两个挨着的值，整条失效
      if (!skipWs() || !(isDelim(tokens[pos], '+') || isDelim(tokens[pos], '-'))) {
        pos = save
        break
      }
      pos++
      if (!skipWs())
        return null
      const rhs = product()
      type = rhs && combine(type, rhs)
    }
    return type
  }

  /** 逗号分隔的参数，连同结尾的右括号一起吃掉 */
  function args(): CalcType[] | null {
    const list: CalcType[] = []
    while (true) {
      const type = sum()
      if (!type)
        return null
      list.push(type)
      skipWs()
      const token = tokens[pos++]
      if (isDelim(token, ')'))
        return list
      if (!isDelim(token, ','))
        return null
    }
  }

  function mathFunction(name: string): CalcType | null {
    const arity = MATH_ARITY.get(name)
    if (!arity)
      return null

    if (name === 'round') {
      skipWs()
      const strategy = tokens[pos]
      if (strategy?.type === 'ident') {
        if (!ROUNDING_STRATEGIES.has(strategy.name))
          return null
        pos++
        skipWs()
        if (!isDelim(tokens[pos++], ','))
          return null
      }
    }

    const list = args()
    if (!list || list.length < arity[0] || list.length > arity[1])
      return null
    return list.reduce<CalcType | null>((merged, type) => merged && combine(merged, type), list[0])
  }

  const type = value()
  skipWs()
  return pos === tokens.length ? type : null
}

function classify(basis: string): Classified {
  const rejected = (issue: BasisIssue): Classified => ({ kind: 'rejected', issue })
  const raw = normalizeBasis(basis)

  if (AUTO_LIKE.has(raw))
    return { kind: 'static', issue: null }
  if (GLOBAL_KEYWORDS.has(raw))
    return rejected('global-keyword')
  if (SUBSTITUTION.test(raw))
    return rejected('substitution')
  if (CALC_SIZE.test(raw))
    return rejected('calc-size')

  const tokens = tokenize(raw)
  const first = tokens?.[0]
  if (!tokens || !first)
    return rejected('unsupported')

  if (first.type === 'function') {
    if (!MATH_ARITY.has(first.name))
      return rejected('unsupported')
    // 结果是纯数（calc(50)）同样不行：flex-basis 要的是长度或百分比
    const type = parseMath(tokens)
    return type && type !== 'number' ? { kind: 'runtime', issue: null } : rejected('math-syntax')
  }

  if (tokens.length !== 1 || first.type !== 'number')
    return rejected('unsupported')

  const { value, unit } = first
  if (unit === '')
    return value === 0 ? { kind: 'static', issue: null, length: { value, unit } } : rejected('unitless')
  if (value < 0)
    return rejected('unsupported')
  if (unit === '%' || PX_PER_UNIT.has(unit) || FONT_RELATIVE_UNITS.has(unit))
    return { kind: 'static', issue: null, length: { value, unit } }
  return RUNTIME_UNITS.has(unit) ? { kind: 'runtime', issue: null } : rejected('unsupported')
}

export function basisKind(basis: string): BasisKind {
  return classify(basis).kind
}

/** 收下返回 null；被拒时给出原因，面板据此提示改法 */
export function basisIssue(basis: string): BasisIssue | null {
  return classify(basis).issue
}

/** 静态可算的长度与百分比拆成数值与单位；auto 一类关键字与运行期的值返回 null */
export function staticLength(basis: string): { value: number, unit: string } | null {
  return classify(basis).length ?? null
}
