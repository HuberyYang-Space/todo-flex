# 设置区、演示区、CSS 区三处一致 Implementation Plan

> **状态：2026-09-23 已按本计划实施完毕。这是过程记录，不是待办清单。** 进度以 git 历史与
> [progress.md 的 M14 节](../../progress.md#m14设置区演示区css-区三处一致)为准；执行中对本计划的偏差见文末「执行偏差」。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设置区收下的每个值，演示区（单项属性）与导出的 CSS（`flex` 简写）渲染出同一个布局；容器宽高进设置区与 CSS 区；「内容尺寸」标明仅用于演示。

**Architecture:** 新增零依赖的叶子模块 `src/core/basisSyntax.ts` 负责 basis 的语法分类与拒收原因；属性表给 text 属性加 `check`，面板输入框与分享链接解码都走这一道关。容器宽高作为两个 number 属性进属性表，面板自动长出滑块，区间只在表里写一份。

**Tech Stack:** Vue 3.5（script setup、auto-import）、vitest 5 + happy-dom + @vue/test-utils、UnoCSS、headless Chrome 对拍。

**Spec:** [2026-09-23-three-way-consistency-design.md](../specs/2026-09-23-three-way-consistency-design.md)

## Global Constraints

- **不逐任务提交**：全部做完后与工作区里已有的未提交改动一起走 `/commit`（用户决定）。本计划没有逐任务的 commit 步骤
- 代码注释用简体中文，只写代码表达不出的「为什么」
- 新代码不手写 vue / @vueuse/core / `src/composables/` 的 import（auto-import 已注入）；旧代码里手写的 import 不顺手改（另有工程项跟踪）
- `src/core/` 零 DOM、零 vue 依赖；`basisSyntax.ts` 不 import 任何模块
- 控制面板只由 [flexProperties.ts](../../../src/data/flexProperties.ts) 驱动，不为单个属性手写模板
- 格式问题一律 `pnpm lint:fix`，不手动排版
- 不新增、不升级依赖
- 调用 claude-in-chrome 插件前先问用户；headless Chrome 对拍不碰用户标签页，不需要问
- 临时 spec 用完挪出 `src/`，否则 `pnpm test` 会跑到它

## Review Focus

1. **大小写与首尾空白**：`INITIAL`、` inherit `、`VAR(--x)`、`Calc-Size(auto, size)` 必须和小写一样被拒 → Task 1 的用例表里逐个列出
2. **草稿停在被拒值时切换选中的盒子，而新盒子的 basis 恰好与旧盒子相同**：输入框必须显示新盒子的值、提示清空（值没变，`watch` 不会触发）→ Task 3 用 `key` 重建字段并加用例
3. **回车与失焦在真实浏览器里的提交时机**：happy-dom 里是手动触发事件，真实键盘与焦点行为没有自动化守卫 → Task 7 列入浏览器核对清单（需用户同意）
4. **拖手柄时宽高滑块跟着动，拖滑块时演示区跟着变** → Task 5 加双向用例
5. **老分享链接里的 basis 现在被拒**（`initial`、`var()`）：整条回默认；线上 `dropConsole` 删了警告，用户看不到原因 → Task 2 加用例钉住「整条拒掉」，静默问题留在已有工程项里，交付时明说

---

## 文件结构

| 文件 | 动作 | 职责 |
| --- | --- | --- |
| `src/core/basisSyntax.ts` | 新建 | basis 的语法分类（`static` / `runtime` / `rejected`）与拒收原因，从 `resolveBasis.ts` 迁出 |
| `src/core/basisSyntax.spec.ts` | 新建 | 分类与原因的用例表 + Chrome 夹具守卫 |
| `src/core/basisSyntax.chrome.json` | 新建 | 真实 Chrome 实测的简写 / 单项属性对照夹具 |
| `src/core/resolveBasis.ts` / `.spec.ts` | 改 | 只留像素换算 |
| `src/core/deriveLayout.ts`、`measuredLines.ts`、`diagnostics.ts` | 改 | `basisKind` 改从 `basisSyntax` 引入 |
| `src/data/flexProperties.ts` / `.spec.ts` | 改 | text 属性加 `check`；加 `width` / `height`；`size` 标 `demoOnly`；导出 `numberProp` |
| `src/core/urlCodec.ts` / `.spec.ts` | 改 | basis 走 `check`；宽高区间读表 |
| `src/components/playground/PropertyField.vue` | 改 | 文本框草稿、提示、失焦 / 回车恢复；「仅演示区」标注 |
| `src/components/playground/ItemControls.vue` / `.spec.ts` | 改 | 字段按「盒子 + 属性」建 key；输入框把关用例 |
| `src/core/types.ts`、`diagnostics.ts` / `.spec.ts`、`MetricsTable.vue` | 改 | 删掉 `invalid-basis` |
| `src/core/defaults.ts` | 改 | 删 `STAGE_LIMITS`，宽高默认值来自表 |
| `src/components/playground/StageResizer.vue` / `.spec.ts` | 改 | 区间读表 |
| `src/components/playground/ContainerControls.spec.ts` | 改 | 宽高滑块用例 |
| `src/core/cssEmit.ts` / `.spec.ts`、`styleMap.ts` | 改 | 导出宽高 |
| `src/components/playground/CssOutput.vue` / `.spec.ts` | 改 | 顶部说明「仅演示区」的属性不会导出 |
| `CLAUDE.md`、`.docs/*.md` | 改 | 红线 9、pitfalls、architecture、progress |

---

### Task 1: basis 语法分类模块与 Chrome 夹具

**Files:**
- Create: `src/core/basisSyntax.ts`
- Create: `src/core/basisSyntax.spec.ts`
- Create: `src/core/basisSyntax.chrome.json`
- Modify: `src/core/resolveBasis.ts`（整个文件重写）
- Modify: `src/core/resolveBasis.spec.ts:1-81`（删掉 `basisKind` 那一组）、`:93-101`（删掉被拒值的用例）
- Modify: `src/core/deriveLayout.ts:5`、`src/core/measuredLines.ts:4`、`src/core/diagnostics.ts:12,66`

**Interfaces:**
- Produces:
  - `type BasisKind = 'static' | 'runtime' | 'rejected'`
  - `type BasisIssue = 'unitless' | 'global-keyword' | 'substitution' | 'calc-size' | 'unsupported'`
  - `basisKind(basis: string): BasisKind`
  - `basisIssue(basis: string): BasisIssue | null`——收下返回 `null`
  - `parseLength(raw: string): { value: number, unit: string } | null`、`PX_PER_UNIT`、`FONT_RELATIVE_UNITS`（只给 `resolveBasis.ts` 用）

- **Step 1: 用 headless Chrome 生成夹具**

探针页（写进会话临时目录 `$SP`，heredoc 必须加引号）：

```bash
SP=<会话临时目录>/basis-probe && mkdir -p $SP
cat > $SP/probe.html <<'EOF'
<!doctype html><html><body>
<div style="display:flex;width:720px;height:100px"><div id="a"><div style="width:80px;height:20px"></div></div></div>
<pre id="out"></pre>
<script>
const values = [
  '50px', '30%', '0', 'auto', 'content', '2em', '0.5rem', '12.5%', 'max-content', 'min-content', 'fit-content', 'AUTO', ' auto ',
  '1in', '2.54cm', '72pt', '6pc', '10mm', '40q',
  'calc(50% - 10px)', 'min(100px, 50%)', 'max(10px, 5em)', 'clamp(10px, 5em, 100px)', 'round(10px, 3px)', 'mod(10px, 3px)',
  'rem(10px, 3px)', 'abs(-10px)', 'hypot(3px, 4px)', 'CALC(10px)', '5ch', '3ex', '2lh', '10vw', '5cqw',
  '50', '12.5', '1e3',
  'initial', 'inherit', 'unset', 'revert', 'revert-layer', 'INITIAL', ' inherit ',
  'var(--x)', 'var(--x, 10px)', 'env(x)', 'env(x, 10px)', 'attr(data-x px)', 'attr(data-x px, 10px)', 'VAR(--x)',
  'calc-size(auto, size)', 'Calc-Size(auto, size)',
  '100pxx', 'abc', '-10px', '', '50 px', 'fit-content(100px)', 'foo(1px)', 'sign(-1px)', 'minmax(10px, 20px)', 'anchor-size(width)',
]
const a = document.getElementById('a')
function snapshot() {
  const cs = getComputedStyle(a)
  return [cs.flexGrow, cs.flexShrink, cs.flexBasis, a.offsetWidth].join('|')
}
// grow / shrink 故意不取初始值：简写整条失效时退回 0 1 auto，与单项属性的 2 3 一比就露出来
const rows = values.map((value) => {
  a.removeAttribute('style')
  a.style.flex = `2 3 ${value}`
  const shorthand = snapshot()
  a.removeAttribute('style')
  a.style.flexGrow = '2'
  a.style.flexShrink = '3'
  a.style.flexBasis = value
  const longhand = snapshot()
  return { value, consistent: shorthand === longhand, shorthand, longhand }
})
document.getElementById('out').textContent = JSON.stringify({ userAgent: navigator.userAgent, rows })
</script></body></html>
EOF
perl -e 'alarm 40; exec @ARGV' "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-first-run --no-default-browser-check --disable-extensions \
  --password-store=basic --use-mock-keychain --virtual-time-budget=5000 \
  --user-data-dir=$SP/profile --dump-dom "file://$SP/probe.html" 2>/dev/null > $SP/out.html
python3 - "$SP/out.html" src/core/basisSyntax.chrome.json <<'PY'
import html, json, re, sys
data = json.loads(html.unescape(re.search(r'<pre id="out">(.*?)</pre>', open(sys.argv[1]).read(), re.S).group(1)))
assert len(data['rows']) == 64, len(data['rows'])
json.dump(data, open(sys.argv[2], 'w'), ensure_ascii=False, indent=2)
print('rows', len(data['rows']), 'inconsistent', sum(not r['consistent'] for r in data['rows']))
PY
```

退出码 142 是 `alarm` 超时信号，结果在那之前已写完。Expected：`rows 64`，并且 `100px` 一致、`calc-size(auto, size)` / `initial` / `var(--x)` / `50` 不一致（与 [spec 的实测表](../specs/2026-09-23-three-way-consistency-design.md#真实-chrome-实测哪些-basis-放进简写会出问题)相符）。行数对不上就是页面没重新生成，不要往下走。

- **Step 2: 写失败的测试**

`src/core/basisSyntax.spec.ts`：

```ts
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
  'CALC(10px)',
  '5ch',
  '3ex',
  '2lh',
  '10vw',
  '5cqw',
]

const REJECTED: Record<BasisIssue, string[]> = {
  'unitless': ['50', '12.5', '1e3'],
  'global-keyword': ['initial', 'inherit', 'unset', 'revert', 'revert-layer', 'INITIAL', ' inherit '],
  'substitution': ['var(--x)', 'var(--x, 10px)', 'env(x)', 'env(x, 10px)', 'attr(data-x px)', 'attr(data-x px, 10px)', 'VAR(--x)'],
  'calc-size': ['calc-size(auto, size)', 'Calc-Size(auto, size)'],
  'unsupported': ['100pxx', 'abc', '-10px', '', '50 px', 'fit-content(100px)', 'foo(1px)', 'sign(-1px)', 'minmax(10px, 20px)', 'anchor-size(width)'],
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

// 夹具由真实 Chrome 生成：720px 容器里一个 80px 内容的盒子，分别写 `flex: 2 3 <值>` 与三条单项属性，
// 计算值与 offsetWidth 全部相同才算 consistent。生成方法见 .docs/superpowers/plans/2026-09-23-three-way-consistency.md 的 Task 1
describe('basis 分类与真实 Chrome 对拍', () => {
  const rows = new Map(chrome.rows.map(row => [row.value, row]))

  it('夹具自证：已知在简写里失效的值确实测出了不一致，正常值测出一致', () => {
    for (const value of ['50', 'initial', 'var(--x)', 'calc-size(auto, size)'])
      expect(rows.get(value)?.consistent, value).toBe(false)
    expect(rows.get('100px')?.consistent).toBe(true)
  })

  it.each([...STATIC, ...RUNTIME])('收下的 %j 在 Chrome 里实测过，简写与单项属性一致', (basis) => {
    expect(rows.get(basis), '这个值没在 Chrome 里测过，先重新生成夹具').toBeDefined()
    expect(rows.get(basis)!.consistent).toBe(true)
  })

  it('夹具里每一个两边不一致的值都被拒收', () => {
    for (const row of chrome.rows) {
      if (!row.consistent)
        expect(basisIssue(row.value), row.value).not.toBeNull()
    }
  })
})
```

- **Step 3: 跑测试确认失败**

Run: `pnpm vitest run src/core/basisSyntax.spec.ts`
Expected: FAIL，`Failed to resolve import "./basisSyntax"`

- **Step 4: 写实现**

`src/core/basisSyntax.ts`：

```ts
/**
 * flex-basis 的语法分类：浏览器怎么认它，本站收不收它。
 * 不 import 任何模块：属性表要用它给输入框把关，而 core 的其余模块反过来依赖属性表，放进去就成环。
 */

/**
 * - `static`：推导引擎能算出像素值
 * - `runtime`：合法，但取值要到运行期才能确定（字体度量、视口、`calc()` 等），推导引擎拿不到
 * - `rejected`：本站不收。放进 `flex` 简写会让整条声明失效，而演示区用的单项属性只丢掉 basis，
 *   收下它，导出的 CSS 就复现不出演示区的布局
 */
export type BasisKind = 'static' | 'runtime' | 'rejected'

export type BasisIssue = 'unitless' | 'global-keyword' | 'substitution' | 'calc-size' | 'unsupported'

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
 * 取自真实浏览器：fit-content()、minmax()、sign()、anchor-size() 在 flex-basis 里都不被接受；
 * calc-size() 单项属性认、简写不认（CSS.supports('flex', '1 1 calc-size(auto, size)') 为假）
 */
const RUNTIME_FUNCTIONS = new Set(['calc', 'min', 'max', 'clamp', 'round', 'mod', 'rem', 'abs', 'hypot'])

/** 引用不到东西时简写在计算期整条失效；带回退的两边虽一致，演示区也没有可引用的东西 */
const SUBSTITUTION_FUNCTIONS = new Set(['var', 'env', 'attr'])

function normalize(basis: string): string {
  return basis.trim().toLowerCase()
}

function functionName(raw: string): string | null {
  return /^([a-z-]+)\(.*\)$/.exec(raw)?.[1] ?? null
}

export function parseLength(raw: string): { value: number, unit: string } | null {
  const number = /^\+?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/.exec(raw)
  return number ? { value: Number(number[0]), unit: raw.slice(number[0].length) } : null
}

export function basisKind(basis: string): BasisKind {
  const raw = normalize(basis)
  if (AUTO_LIKE.has(raw))
    return 'static'

  const fn = functionName(raw)
  if (fn)
    return RUNTIME_FUNCTIONS.has(fn) ? 'runtime' : 'rejected'

  const length = parseLength(raw)
  if (!length)
    return 'rejected'

  const { value, unit } = length
  if (unit === '')
    return value === 0 ? 'static' : 'rejected'
  if (unit === '%' || PX_PER_UNIT.has(unit) || FONT_RELATIVE_UNITS.has(unit))
    return 'static'
  return RUNTIME_UNITS.has(unit) ? 'runtime' : 'rejected'
}

/** 收下返回 null；被拒时给出原因，面板据此提示改法 */
export function basisIssue(basis: string): BasisIssue | null {
  if (basisKind(basis) !== 'rejected')
    return null

  const raw = normalize(basis)
  if (GLOBAL_KEYWORDS.has(raw))
    return 'global-keyword'

  const fn = functionName(raw)
  if (fn !== null && SUBSTITUTION_FUNCTIONS.has(fn))
    return 'substitution'
  if (fn === 'calc-size')
    return 'calc-size'

  return parseLength(raw)?.unit === '' ? 'unitless' : 'unsupported'
}
```

`src/core/resolveBasis.ts` 整个替换为：

```ts
import type { FlexContainerState, FlexItemState } from './types'
import { mainAxisSize } from './axis'
import { basisKind, FONT_RELATIVE_UNITS, parseLength, PX_PER_UNIT } from './basisSyntax'
import { DEFAULT_FONT_SIZE } from './defaults'

/**
 * 把 flex-basis 解析成像素。故意不做 min/max 截断，那道缝隙留给诊断层。
 * 运行期才能确定的值这里只给占位，deriveLayout 会把整个容器标成无法推导。
 */
export function resolveBasis(item: FlexItemState, container: FlexContainerState, fontSize = DEFAULT_FONT_SIZE): number {
  const length = basisKind(item.basis) === 'static' ? parseLength(item.basis.trim().toLowerCase()) : null
  if (!length)
    return item.size

  const { value, unit } = length
  if (unit === '%')
    return (mainAxisSize(container) * value) / 100
  if (FONT_RELATIVE_UNITS.has(unit))
    return value * fontSize
  return value * (PX_PER_UNIT.get(unit) ?? 1)
}
```

引入方改路径：

- `src/core/deriveLayout.ts:5`：`import { basisKind, resolveBasis } from './resolveBasis'` → 两行
  `import { basisKind } from './basisSyntax'` 与 `import { resolveBasis } from './resolveBasis'`
- `src/core/measuredLines.ts:4`：同上
- `src/core/diagnostics.ts:12`：`from './resolveBasis'` → `from './basisSyntax'`；`:66` 的 `kind === 'invalid'` → `kind === 'rejected'`（这条诊断在 Task 4 整条删掉，这里只保持编译通过）

`src/core/resolveBasis.spec.ts`：

- 删掉第 4 行 import 里的 `basisKind`、第 12–81 行整个 `describe('basisKind', …)`
- 第 93 行的用例改成只测演示区里与 auto 同值的关键字：

```ts
  it.each(['max-content', 'min-content', 'fit-content'])('%s 在演示区里等价于 auto，取内容固有尺寸', (basis) => {
    const { item, container } = setup(basis, 80)
    expect(resolveBasis(item, container)).toBe(80)
  })
```

- 删掉两条「非法值…按 auto 处理 / 回退到内容固有尺寸」的用例：被拒的值再也进不了状态，这个行为没有调用方

- **Step 5: 跑测试确认通过**

Run: `pnpm vitest run src/core/basisSyntax.spec.ts src/core/resolveBasis.spec.ts && pnpm test && pnpm tscheck`
Expected: 全部 PASS。`diagnostics.spec.ts` 里 basis `'50'` 那条仍然通过（仍被判为 `rejected`）

---

### Task 2: 属性表的 basis 把关，分享链接走同一道关

**Files:**
- Modify: `src/data/flexProperties.ts:1-17`（类型）、`:146-154`（basis 条目）
- Modify: `src/data/flexProperties.spec.ts`
- Modify: `src/core/urlCodec.ts:1-3`、`:41-65`、`:237-238`
- Modify: `src/core/urlCodec.spec.ts`

**Interfaces:**
- Consumes: `basisIssue`、`BasisIssue`（Task 1）
- Produces:
  - text 属性新字段 `check: (value: string) => string | null`——被拒时返回提示文案，收下返回 `null`
  - `numberProp(props: PropertyDef[], key: string): Extract<PropertyDef, { kind: 'number' }>`（Task 5 的手柄与链接解码用）

- **Step 1: 写失败的测试**

`src/data/flexProperties.spec.ts` 在「每个属性都带 MDN 链接」之后加：

```ts
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

  it('basis 的 check 对被拒的值给出改法', () => {
    const basis = itemProperties.find(prop => prop.key === 'basis')
    if (basis?.kind !== 'text')
      throw new Error('basis 应当是 text 类型的属性')

    expect(basis.check('50')).toContain('50px')
    expect(basis.check('initial')).toContain('auto')
    expect(basis.check('var(--x)')).toContain('var()')
    expect(basis.check('calc-size(auto, size)')).toContain('calc-size()')
    expect(basis.check('abc')).toContain('不是合法的 flex-basis')
  })
```

`src/core/urlCodec.spec.ts` 的 `describe('urlCodec 对非法输入的回退')` 里加：

```ts
  it.each(['50', 'initial', 'var(--x)', 'calc-size(auto, size)', '100pxx'])('basis 是面板不收的 %j 就整个拒掉', (basis) => {
    const warn = silenceWarn()
    const state = createDefaultState()
    state.items[1].basis = basis

    expect(decode(encode(state))).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })
```

- **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/data/flexProperties.spec.ts src/core/urlCodec.spec.ts`
Expected: FAIL——`prop.check is not a function`；urlCodec 的 5 条拿到的是解出来的状态而不是 `null`

- **Step 3: 写实现**

`src/data/flexProperties.ts` 顶部与类型：

```ts
import type { BasisIssue } from '~/core/basisSyntax'
import { basisIssue } from '~/core/basisSyntax'

const MDN = 'https://developer.mozilla.org/zh-CN/docs/Web/CSS'

interface PropertyOption {
  value: string
}

interface PropertyBase {
  key: string
  cssName: string
  mdn: string
}

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
  'unsupported': '不是合法的 flex-basis，可以写 auto、content、100px、30% 或 calc()',
}
```

basis 条目加一行：

```ts
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
  },
```

`src/core/urlCodec.ts`：

```ts
import type { Direction, FlexContainerState, FlexItemState, FlexState, Wrap } from './types'
import type { PropertyDef } from '~/data/flexProperties'
import { containerProperties, itemProperties, numberProp } from '~/data/flexProperties'
import { createDefaultState, MAX_ITEMS, STAGE_LIMITS } from './defaults'
```

把 `textMaxLength`（第 47–53 行）换成：

```ts
/** 输入框的 maxlength 与 check 都与解码同源：面板能输入的链接一定解得回来，面板不收的也解不出来 */
function acceptsText(props: PropertyDef[], key: string, value: string): boolean {
  const prop = props.find(item => item.key === key)
  if (prop?.kind !== 'text')
    throw new Error(`属性表里没有文本属性 ${key}`)
  return value.length <= prop.maxLength && prop.check(value) === null
}
```

`clampToProp`（第 59–65 行）改用 `numberProp`：

```ts
/** 夹回属性表里该数值控件的区间，与面板滑块能调出的范围同源 */
function clampToProp(props: PropertyDef[], key: string, value: number): number {
  const { min, max } = numberProp(props, key)
  return clamp(value, min, max)
}
```

`allowedValues` 的参数类型同样改成 `PropertyDef[]`。`decodeItem` 第 237–238 行改成：

```ts
  if (!acceptsText(itemProperties, 'basis', basis))
    return null
```

- **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/data/flexProperties.spec.ts src/core/urlCodec.spec.ts && pnpm tscheck`
Expected: PASS

---

### Task 3: basis 输入框把关

**Files:**
- Modify: `src/components/playground/PropertyField.vue:1-23`（script）、`:68-94`（text 分支模板）
- Modify: `src/components/playground/ItemControls.vue:62-68`
- Modify: `src/components/playground/ItemControls.spec.ts`

**Interfaces:**
- Consumes: text 属性的 `check`（Task 2）
- Produces: 输入框 `aria-label="flex-basis 自定义值"`；提示区 `data-testid="field-hint"`（`role="status"`，无提示时文本为空）

- **Step 1: 写失败的测试**

`src/components/playground/ItemControls.spec.ts` 末尾加：

```ts
describe('basis 输入框把关', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  const BASIS_INPUT = 'input[aria-label="flex-basis 自定义值"]'

  async function mountWithItem1() {
    const wrapper = mount(ItemControls)
    useFlexState().selectItem('item-1')
    await wrapper.vm.$nextTick()
    return {
      wrapper,
      input: () => wrapper.get(BASIS_INPUT),
      inputValue: () => (wrapper.get(BASIS_INPUT).element as HTMLInputElement).value,
      hint: () => wrapper.get('[data-testid="field-hint"]').text(),
    }
  }

  it('合法值随打随生效，不出提示', async () => {
    const { input, hint } = await mountWithItem1()
    await input().setValue('120px')

    expect(useFlexState().state.items[0].basis).toBe('120px')
    expect(hint()).toBe('')
  })

  it.each([
    ['50', '非 0 数值要带单位'],
    ['initial', '全局关键字'],
    ['var(--x)', 'var()'],
    ['calc-size(auto, size)', 'calc-size()'],
    ['abc', '不是合法的 flex-basis'],
  ])('打出 %j 时只提示原因，不写进状态，输入框保留原样', async (value, reason) => {
    const { input, inputValue, hint } = await mountWithItem1()
    await input().setValue(value)

    expect(useFlexState().state.items[0].basis).toBe('auto')
    expect(hint()).toContain(reason)
    expect(inputValue()).toBe(value)
  })

  it('改回合法值后提示消失', async () => {
    const { input, hint } = await mountWithItem1()
    await input().setValue('50')
    await input().setValue('50px')

    expect(hint()).toBe('')
    expect(useFlexState().state.items[0].basis).toBe('50px')
  })

  it.each(['blur', 'keydown.enter'])('%s 时仍不合法，退回当前生效的值并说明原因', async (event) => {
    const { input, inputValue, hint } = await mountWithItem1()
    await input().setValue('120px')
    await input().setValue('50')
    await input().trigger(event)

    expect(inputValue()).toBe('120px')
    expect(hint()).toContain('非 0 数值要带单位')
    expect(hint()).toContain('已恢复为 120px')
    expect(useFlexState().state.items[0].basis).toBe('120px')
  })

  it('失焦时合法就什么都不动', async () => {
    const { input, inputValue, hint } = await mountWithItem1()
    await input().setValue('30%')
    await input().trigger('blur')

    expect(inputValue()).toBe('30%')
    expect(hint()).toBe('')
  })

  it('点预设会盖掉没生效的草稿与提示', async () => {
    const { wrapper, input, inputValue, hint } = await mountWithItem1()
    await input().setValue('50')
    await wrapper.get('[data-value="30%"]').trigger('click')

    expect(inputValue()).toBe('30%')
    expect(hint()).toBe('')
  })

  // 两个盒子的 basis 都是 auto：值没变，只靠 watch 同步不了草稿
  it('草稿停在被拒值时换选中的盒子，输入框显示新盒子的值、提示清空', async () => {
    const { wrapper, input, inputValue, hint } = await mountWithItem1()
    await input().setValue('50')
    useFlexState().selectItem('item-2')
    await wrapper.vm.$nextTick()

    expect(inputValue()).toBe('auto')
    expect(hint()).toBe('')
  })
})
```

- **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/ItemControls.spec.ts`
Expected: FAIL——被拒值直接写进了状态；找不到 `[data-testid="field-hint"]`

- **Step 3: 写实现**

`src/components/playground/PropertyField.vue` 的 script 换成（`ref` / `watch` / `useId` 由 auto-import 注入）：

```ts
<script setup lang="ts">
import type { PropertyDef } from '~/data/flexProperties'
import { useFlip } from '~/composables/useFlip'

const props = defineProps<{
  prop: PropertyDef
  modelValue: string | number | boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
}>()

const { setScrubbing } = useFlip()

/** 输入框显示的是草稿：被拒的值只停在这里，不进状态 */
const draft = ref(String(props.modelValue))
const hint = ref<string | null>(null)
const hintId = useId()

watch(() => props.modelValue, (value) => {
  draft.value = String(value)
  hint.value = null
})

function onNumberInput(event: Event): void {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value))
}

function onTextInput(event: Event): void {
  if (props.prop.kind !== 'text')
    return
  draft.value = (event.target as HTMLInputElement).value
  hint.value = props.prop.check(draft.value)
  if (hint.value === null)
    emit('update:modelValue', draft.value)
}

/** 失焦或回车时还不合法就退回生效的值：输入框不能停在一个没生效的值上，看着像是改成功了 */
function onTextCommit(): void {
  if (props.prop.kind !== 'text')
    return
  const reason = props.prop.check(draft.value)
  if (reason === null)
    return
  draft.value = String(props.modelValue)
  hint.value = `${reason}，已恢复为 ${props.modelValue}`
}
</script>
```

模板里 text 分支（原第 68–94 行）换成：

```vue
    <div v-else-if="props.prop.kind === 'text'">
      <div class="flex flex-wrap gap-tight" role="group" :aria-label="props.prop.cssName">
        <button
          v-for="preset in props.prop.presets"
          :key="preset"
          data-testid="option"
          :data-value="preset"
          type="button"
          class="option"
          :class="{ 'is-active': props.modelValue === preset }"
          :aria-pressed="props.modelValue === preset"
          @click="emit('update:modelValue', preset)"
        >
          {{ preset }}
        </button>
        <input
          class="w-20 border border-bd rounded-1 bg-transparent px-2 py-1 text-xs font-mono"
          :aria-label="`${props.prop.cssName} 自定义值`"
          :aria-describedby="hintId"
          :maxlength="props.prop.maxLength"
          :value="draft"
          @input="onTextInput"
          @blur="onTextCommit"
          @keydown.enter="onTextCommit"
        >
      </div>
      <!-- live region 要一直在场，内容变了读屏才会播报；没提示时是空段落，不占高度 -->
      <p
        :id="hintId"
        data-testid="field-hint"
        role="status"
        class="text-xs op-70"
        :class="{ 'mt-tight': hint }"
      >
        {{ hint }}
      </p>
    </div>
```

`src/components/playground/ItemControls.vue` 第 62–68 行，字段按「盒子 + 属性」建 key：

```vue
      <PropertyField
        v-for="prop in itemProperties"
        :key="`${selectedItem.id}:${prop.key}`"
        :prop="prop"
        :model-value="valueOf(selectedItem, prop.key)"
        @update:model-value="update(selectedItem, prop.key, $event)"
      />
```

- **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/components/playground/ItemControls.spec.ts && pnpm test && pnpm tscheck`
Expected: PASS。原有的「选中后每个输入控件都有各不相同的可访问名称」照常通过（提示区不是 input）

---

### Task 4: 删掉「非法 basis」诊断

被拒的值再也进不了状态（Task 2 挡链接、Task 3 挡输入框），这条诊断永远触发不了，按零消费方规则删掉。

**Files:**
- Modify: `src/core/types.ts:90-111`
- Modify: `src/core/diagnostics.ts:64-69`
- Modify: `src/core/diagnostics.spec.ts:196-203`
- Modify: `src/components/playground/MetricsTable.vue:15`

- **Step 1: 删用例**

删掉 `src/core/diagnostics.spec.ts` 里 `it('basis 非法时直接指出，不归因成 min-width:auto', …)` 整条。

- **Step 2: 删实现**

`src/core/types.ts`：

```ts
export type DiagnosticRule
  = | 'runtime-basis'
    | 'line-break-widened'
    | 'line-break-shifted'
    | 'min-width-auto'
    | 'margin-auto'
    | 'max-size-clamp'

/**
 * - `warn`：理论值与实际值对不上，指出是哪条规则介入了
 * - `info`：由状态直接推出的提示，如 `margin: auto`——它只改位置、不改尺寸，不会体现为尺寸偏差
 */
```

`src/core/diagnostics.ts` 第 64–69 行换成：

```ts
    if (theoretical === null)
      return basisKind(item.basis) === 'runtime' ? { ...base, rule: 'runtime-basis', severity: 'info', params: {} } : null
```

`src/components/playground/MetricsTable.vue` 删掉 `'invalid-basis': …` 那一行。

- **Step 3: 跑测试与类型检查**

Run: `pnpm test && pnpm tscheck && grep -rn "invalid-basis" src`
Expected: 测试与类型检查通过，grep 无输出

---

### Task 5: 容器宽高进属性表、设置区与导出的 CSS

**Files:**
- Modify: `src/data/flexProperties.ts:19-27`（display 之后插入两条）
- Modify: `src/data/flexProperties.spec.ts:30-43`、`:64-81`
- Modify: `src/core/defaults.ts:11-16`、`:30`
- Modify: `src/core/types.ts:4`
- Modify: `src/core/urlCodec.ts:3`、`:213-214`
- Modify: `src/core/urlCodec.spec.ts:3`、`:187-198`
- Modify: `src/components/playground/StageResizer.vue:1-51`
- Modify: `src/components/playground/StageResizer.spec.ts`
- Modify: `src/components/playground/ContainerControls.spec.ts:39-46`
- Modify: `src/core/cssEmit.ts:8-15`、`src/core/cssEmit.spec.ts`
- Modify: `src/core/styleMap.ts:4-9`

**Interfaces:**
- Consumes: `numberProp`（Task 2）
- Produces: `containerProperties` 里 key 为 `width`（200–1200，默认 720）、`height`（120–600，默认 320）的 number 属性；`STAGE_LIMITS` 删除

- **Step 1: 写失败的测试**

`src/data/flexProperties.spec.ts` 第 31–43 行的字段清单改成覆盖全部字段：

```ts
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
```

同文件「默认值只在属性表里写一份」那组加上宽度：

```ts
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
```

`src/core/urlCodec.spec.ts`：第 3 行 import 去掉 `STAGE_LIMITS`，第 2 行加 `numberProp`；`describe('urlCodec 把越界数值夹回面板区间')` 里第一条改成读表，并加一条改表的用例：

```ts
describe('urlCodec 把越界数值夹回面板区间', () => {
  const heightProp = numberProp(containerProperties, 'height')
  const originalMax = heightProp.max

  afterEach(() => {
    heightProp.max = originalMax
  })

  it('容器的间距与宽高夹到属性表的区间里', () => {
    const state = createDefaultState()
    Object.assign(state.container, { rowGap: -5, columnGap: 999, width: 99999, height: -50 })

    const back = decode(encode(state))!.container

    expect(back.rowGap).toBe(0)
    expect(back.columnGap).toBe(64)
    expect(back.width).toBe(numberProp(containerProperties, 'width').max)
    expect(back.height).toBe(heightProp.min)
  })

  it('宽高的区间取自属性表，改了表解码跟着变', () => {
    heightProp.max = 400
    const state = createDefaultState()
    state.container.height = 500

    expect(decode(encode(state))!.container.height).toBe(400)
  })
```

（该 describe 原有的其余用例保持不动。）

`src/components/playground/StageResizer.spec.ts`：第 4 行换成
`import { containerProperties, numberProp } from '~/data/flexProperties'`，第 1–2 行 vitest import 加 `afterEach`；
第 48–53 行的 `STAGE_LIMITS.minWidth` / `maxWidth` / `minHeight` / `maxHeight` 换成
`numberProp(containerProperties, 'width').min` 等；末尾加：

```ts
describe('stageResizer 的区间取自属性表', () => {
  const widthProp = numberProp(containerProperties, 'width')
  const originalMax = widthProp.max

  afterEach(() => {
    widthProp.max = originalMax
  })

  it('改了表里的上限，拖拽跟着变', async () => {
    useFlexState().resetState()
    widthProp.max = 1000
    const { state } = useFlexState()
    const wrapper = mount(StageResizer, { attachTo: document.body })

    await wrapper.get('[data-testid="stage-resizer"]').trigger('pointerdown', { clientX: 0, clientY: 0 })
    firePointer('pointermove', 9999, 0)
    expect(state.container.width).toBe(1000)

    firePointer('pointerup', 0, 0)
  })
})
```

`src/components/playground/ContainerControls.spec.ts`：第 39–46 行原先取第一个滑块，加了宽高之后第一个是 width，改成按名字取：

```ts
  it('数值控件写回状态且为数字类型', async () => {
    const wrapper = mount(ContainerControls)
    await wrapper.get('input[aria-label="row-gap"]').setValue('24')
    const { state } = useFlexState()
    expect(state.container.rowGap).toBe(24)
    expect(typeof state.container.rowGap).toBe('number')
  })

  it('宽高滑块与拖拽手柄写同一份状态，两边互相跟着走', async () => {
    const { state } = useFlexState()
    const wrapper = mount(ContainerControls)
    const width = wrapper.get('input[aria-label="width"]')
    const widthProp = numberProp(containerProperties, 'width')

    expect(width.attributes('min')).toBe(String(widthProp.min))
    expect(width.attributes('max')).toBe(String(widthProp.max))

    state.container.width = 900
    await wrapper.vm.$nextTick()
    expect((width.element as HTMLInputElement).value).toBe('900')

    await wrapper.get('input[aria-label="height"]').setValue('400')
    expect(state.container.height).toBe(400)
  })
```

（第 4 行 import 加 `numberProp`。）

`src/core/cssEmit.spec.ts` 加：

```ts
  it('容器宽高写进 .container，粘过去才复现得出演示区的布局', () => {
    const state = createDefaultState()
    state.container.width = 640
    state.container.height = 280
    const containerBlock = emitCss(state).split('\n\n')[0]

    expect(containerBlock).toMatch(/^\.container \{/)
    expect(containerBlock).toContain('  width: 640px;')
    expect(containerBlock).toContain('  height: 280px;')
  })
```

并把结构快照里 `.container` 块改成：

```
      ".container {
        display: flex;
        width: 720px;
        height: 320px;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: flex-start;
        align-items: stretch;
        gap: 12px 12px;
      }
```

- **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/data/flexProperties.spec.ts src/core/urlCodec.spec.ts src/components/playground/StageResizer.spec.ts src/components/playground/ContainerControls.spec.ts src/core/cssEmit.spec.ts`
Expected: FAIL——表里没有 width / height（`numberProp` 抛「属性表里没有数值属性 width」），导出的 CSS 没有宽高

- **Step 3: 写实现**

`src/data/flexProperties.ts` 在 display 条目之后插入：

```ts
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
```

`src/core/defaults.ts`：删掉 `STAGE_LIMITS`（第 11–16 行），`createDefaultState` 的容器改成：

```ts
    container: defaultsOf(containerProperties) as FlexContainerState,
```

`src/core/types.ts`：删掉第 4 行注释「width/height 由演示区拖拽调整，不在控制面板的属性表里」。

`src/core/urlCodec.ts`：第 3 行 import 去掉 `STAGE_LIMITS`；第 213–214 行改成：

```ts
    width: clampToProp(containerProperties, 'width', width),
    height: clampToProp(containerProperties, 'height', height),
```

`src/components/playground/StageResizer.vue` script 换成（保持原有的手写 import，不在这次顺手改）：

```ts
<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { useFlip } from '~/composables/useFlip'
import { containerProperties, numberProp } from '~/data/flexProperties'

const { state } = useFlexState()
const { setScrubbing } = useFlip()

const widthProp = numberProp(containerProperties, 'width')
const heightProp = numberProp(containerProperties, 'height')

/** 位移量直接加在按下时的尺寸上，不逐帧累加，避免累积误差 */
const origin = ref<{ x: number, y: number, width: number, height: number } | null>(null)

function clamp(value: number, { min, max }: { min: number, max: number }): number {
  return Math.min(Math.max(Math.round(value), min), max)
}
```

`onPointerdown` 不变；`pointermove` 里改成：

```ts
  state.container.width = clamp(from.width + event.clientX - from.x, widthProp)
  state.container.height = clamp(from.height + event.clientY - from.y, heightProp)
```

`src/core/cssEmit.ts`：

```ts
/** 可直接粘贴进项目的 CSS：省略初始值；容器宽高照写，演示区的布局才复现得出来 */
export function emitCss(state: FlexState): string {
  const { container, items } = state

  const containerRules = [
    `display: ${container.display}`,
    `width: ${container.width}px`,
    `height: ${container.height}px`,
    `flex-direction: ${container.direction}`,
    `flex-wrap: ${container.wrap}`,
    `justify-content: ${container.justifyContent}`,
    `align-items: ${container.alignItems}`,
  ]
```

`src/core/styleMap.ts` 第 5–6 行注释改成：

```ts
 * 状态 → 渲染用的行内样式。与 `cssEmit` 口径不同、刻意不合并：
 * 那边产出可粘贴的 CSS，省略初始值；这边状态里写了什么就输出什么。
```

- **Step 4: 跑测试确认通过**

Run: `pnpm test && pnpm tscheck && grep -rn "STAGE_LIMITS" src`
Expected: PASS，grep 无输出

---

### Task 6: 「内容尺寸」标明仅用于演示

**Files:**
- Modify: `src/data/flexProperties.ts`（`PropertyBase` 与 size 条目）
- Modify: `src/data/flexProperties.spec.ts`
- Modify: `src/components/playground/PropertyField.vue:27-32`（名字那一行）
- Modify: `src/components/playground/CssOutput.vue`
- Modify: `src/components/playground/ItemControls.spec.ts`、`CssOutput.spec.ts`

**Interfaces:**
- Produces: `PropertyBase.demoOnly?: boolean`；标注 `data-testid="demo-only"`；CSS 区说明 `data-testid="css-note"`

- **Step 1: 写失败的测试**

`src/data/flexProperties.spec.ts` 加：

```ts
  it('只有内容尺寸标为仅演示区', () => {
    expect(allProperties.filter(prop => prop.demoOnly).map(prop => prop.key)).toEqual(['size'])
  })
```

`src/components/playground/ItemControls.spec.ts` 的 `describe('itemControls')` 里加：

```ts
  // 断言标注挂在谁身上，而不只是「页面上有这个标注」
  it('「仅演示区」只标在仅演示区的属性名旁', async () => {
    const wrapper = mount(ItemControls)
    useFlexState().selectItem('item-1')
    await wrapper.vm.$nextTick()

    const badges = wrapper.findAll('[data-testid="demo-only"]')
    const demoOnlyNames = itemProperties.filter(prop => prop.demoOnly).map(prop => prop.cssName)

    expect(badges).toHaveLength(demoOnlyNames.length)
    for (const [index, badge] of badges.entries()) {
      expect(badge.text()).toBe('仅演示区')
      expect(badge.element.parentElement?.textContent).toContain(demoOnlyNames[index])
    }
  })
```

`src/components/playground/CssOutput.spec.ts` 加：

```ts
  it('顶部说明仅演示区的属性不是 CSS、不会导出，代码里也确实没有它', () => {
    const wrapper = mount(CssOutput)

    expect(wrapper.get('[data-testid="css-note"]').text()).toContain('「内容尺寸」')
    expect(wrapper.get('[data-testid="css-note"]').text()).toContain('不是 CSS 属性')
    expect(wrapper.get('[data-testid="css-code"]').text()).not.toContain('内容尺寸')
  })
```

- **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/data/flexProperties.spec.ts src/components/playground/ItemControls.spec.ts src/components/playground/CssOutput.spec.ts`
Expected: FAIL——没有 `demoOnly`、找不到 `demo-only` / `css-note`

- **Step 3: 写实现**

`src/data/flexProperties.ts` 的 `PropertyBase`：

```ts
interface PropertyBase {
  key: string
  cssName: string
  mdn: string
  /** 只作用于演示区、不是 CSS 属性：面板标出来，CSS 区说明它不会导出 */
  demoOnly?: boolean
}
```

size 条目加 `demoOnly: true,`。

`src/components/playground/PropertyField.vue` 名字那一行（原第 27–32 行）：

```vue
    <div class="flex items-center justify-between text-xs op-70">
      <span class="flex items-center gap-tight">
        <a :href="props.prop.mdn" target="_blank" rel="noopener" class="font-mono hover:underline">
          {{ props.prop.cssName }}
        </a>
        <span
          v-if="props.prop.demoOnly"
          data-testid="demo-only"
          class="border border-bd rounded-full px-1.5 text-[10px] leading-4"
        >仅演示区</span>
      </span>
      <span v-if="props.prop.kind === 'number'" class="font-mono">{{ props.modelValue }}</span>
    </div>
```

`src/components/playground/CssOutput.vue` script 加：

```ts
import { itemProperties } from '~/data/flexProperties'

const demoOnlyNames = itemProperties.filter(prop => prop.demoOnly).map(prop => `「${prop.cssName}」`).join('、')
```

模板在 `</header>` 之后加：

```vue
    <p v-if="demoOnlyNames" data-testid="css-note" class="shrink-0 text-xs op-60">
      {{ demoOnlyNames }}只用于演示区，不是 CSS 属性，不会导出
    </p>
```

- **Step 4: 跑测试确认通过**

Run: `pnpm test && pnpm tscheck`
Expected: PASS

---

### Task 7: 随机状态对拍、变异验证、全量验证

**Files:**
- Create（临时，用完挪出 `src/`）: `src/core/__scenes.spec.ts`
- 会话临时目录：`scenes.html`、`scenes.js`、`mutate.mjs`

- **Step 1: 生成随机场景**

`src/core/__scenes.spec.ts`（临时）：

```ts
import type { FlexState } from './types'
import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { containerProperties, itemProperties } from '~/data/flexProperties'
import { isRowDirection } from './axis'
import { emitCss } from './cssEmit'
import { createDefaultItem, createDefaultState } from './defaults'
import { containerStyle, contentStyle, itemStyle } from './styleMap'

const ACCEPTED = ['auto', 'content', 'max-content', '0', '50px', '30%', '2em', 'calc(50% - 10px)', 'min(100px, 50%)', '10vw', '5ch', 'clamp(10px, 5em, 100px)']
/** 绕过输入框直接塞进状态：探针自证用，它们必须测出不一致 */
const REJECTED = ['50', 'initial', 'var(--x)', 'calc-size(auto, size)', '100pxx']

it('生成对拍场景', () => {
  let seed = 20260923
  const rand = (): number => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
  const int = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1))
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)]
  const options = (props: typeof containerProperties, key: string): string[] => {
    const prop = props.find(item => item.key === key)
    return prop?.kind === 'enum' ? prop.options.map(option => option.value) : []
  }

  const scenes = Array.from({ length: 2000 }, (_, index) => {
    const probe = index % 10 === 0
    const state: FlexState = createDefaultState()
    Object.assign(state.container, {
      display: pick(options(containerProperties, 'display')),
      direction: pick(options(containerProperties, 'direction')),
      wrap: pick(options(containerProperties, 'wrap')),
      justifyContent: pick(options(containerProperties, 'justifyContent')),
      alignItems: pick(options(containerProperties, 'alignItems')),
      alignContent: pick(options(containerProperties, 'alignContent')),
      rowGap: int(0, 64),
      columnGap: int(0, 64),
      width: int(200, 1200),
      height: int(120, 600),
    })
    state.items = Array.from({ length: int(1, 6) }, (_, i) => ({
      ...createDefaultItem(`item-${i + 1}`),
      grow: int(0, 3),
      shrink: int(0, 3),
      basis: pick(ACCEPTED),
      order: int(-2, 2),
      alignSelf: pick(options(itemProperties, 'alignSelf')),
      size: int(20, 300),
      minWidthAuto: rand() < 0.7,
      marginAuto: rand() < 0.15,
    }))
    if (probe)
      Object.assign(state.items[0], { grow: 2, shrink: 3, basis: pick(REJECTED) })

    const { direction } = state.container
    return {
      probe,
      row: isRowDirection(direction),
      css: emitCss(state),
      container: containerStyle(state.container),
      items: state.items.map(item => ({ style: itemStyle(item, direction), content: contentStyle(item, direction) })),
    }
  })

  writeFileSync(process.env.SCENES_OUT!, `window.SCENES = ${JSON.stringify(scenes)}`)
})
```

Run: `SCENES_OUT=$SP/scenes.js pnpm vitest run src/core/__scenes.spec.ts`

- **Step 2: 在 headless Chrome 里按两种写法渲染、逐盒比对**

`$SP/scenes.html`（heredoc 加引号）：

```html
<!doctype html><html><head><style>body{margin:0}</style><style id="emitted"></style></head><body>
<div id="host"></div><pre id="out"></pre>
<script src="scenes.js"></script>
<script>
const host = document.getElementById('host')
const emitted = document.getElementById('emitted')
const kebab = key => key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
function apply(el, decls) {
  for (const [key, value] of Object.entries(decls))
    el.style.setProperty(kebab(key), String(value))
}
// useEmitted 为真时只挂类名，样式全部来自导出的 CSS 文本；内容块两边一样，它本来就不在导出的 CSS 里
function render(scene, useEmitted) {
  const box = document.createElement('div')
  if (useEmitted) box.className = 'container'
  else apply(box, scene.container)
  scene.items.forEach((item, index) => {
    const el = document.createElement('div')
    if (useEmitted) el.className = `item-${index + 1}`
    else apply(el, item.style)
    const content = document.createElement('div')
    apply(content, item.content)
    apply(content, scene.row ? { height: '20px' } : { width: '20px' })
    el.appendChild(content)
    box.appendChild(el)
  })
  host.appendChild(box)
  const rects = [...box.children].map(el => [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight])
  host.removeChild(box)
  return JSON.stringify(rects)
}
let acceptedMismatch = 0
let probeTotal = 0
let probeMismatch = 0
const examples = []
for (const scene of SCENES) {
  emitted.textContent = ''
  const longhand = render(scene, false)
  emitted.textContent = scene.css
  const shorthand = render(scene, true)
  if (scene.probe) {
    probeTotal++
    if (longhand !== shorthand) probeMismatch++
  }
  else if (longhand !== shorthand) {
    acceptedMismatch++
    if (examples.length < 5) examples.push({ css: scene.css, longhand, shorthand })
  }
}
document.getElementById('out').textContent = JSON.stringify({ total: SCENES.length, acceptedMismatch, probeTotal, probeMismatch, examples })
</script></body></html>
```

用 Task 1 Step 1 同样的 headless 命令 dump `scenes.html`，解析 `<pre id="out">`。

Expected：`total` 为 2000（对不上就是页面没重新生成）；`probeTotal` 200、`probeMismatch` 大于 0（比对手段看得见差异）；`acceptedMismatch` 为 0。
`acceptedMismatch` 不为 0 时拿 `examples` 定位，**不要放宽比对**。

- **Step 3: 删掉临时 spec**

Run: `rm src/core/__scenes.spec.ts && git status --short src/core`
Expected: 输出里没有 `__scenes.spec.ts`

- **Step 4: 变异验证**

`$SP/mutate.mjs`：

```js
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const P = 'src/components/playground'
const mutations = [
  ['收下 calc-size', 'src/core/basisSyntax.ts', 'new Set([\'calc\',', 'new Set([\'calc-size\', \'calc\',', 'src/core/basisSyntax.spec.ts'],
  ['收下 calc-size（只跑 Chrome 夹具那组）', 'src/core/basisSyntax.ts', 'new Set([\'calc\',', 'new Set([\'calc-size\', \'calc\',', 'src/core/basisSyntax.spec.ts -t "真实 Chrome 对拍"'],
  ['收下 var()', 'src/core/basisSyntax.ts', 'new Set([\'calc\',', 'new Set([\'var\', \'calc\',', 'src/core/basisSyntax.spec.ts'],
  ['收下全局关键字', 'src/core/basisSyntax.ts', 'new Set([\'auto\',', 'new Set([\'initial\', \'auto\',', 'src/core/basisSyntax.spec.ts'],
  ['收下无单位数', 'src/core/basisSyntax.ts', 'return value === 0 ? \'static\' : \'rejected\'', 'return \'static\'', 'src/core/basisSyntax.spec.ts'],
  ['新增可收的值却没重测夹具', 'src/core/basisSyntax.spec.ts', '\'5cqw\',', '\'5cqw\',\n  \'1vmax\',', 'src/core/basisSyntax.spec.ts -t "真实 Chrome 对拍"'],
  ['链接解码不过 check', 'src/core/urlCodec.ts', ' && prop.check(value) === null', '', 'src/core/urlCodec.spec.ts'],
  ['链接解码的高度不读表', 'src/core/urlCodec.ts', 'clampToProp(containerProperties, \'height\', height)', 'clamp(height, 120, 600)', 'src/core/urlCodec.spec.ts'],
  ['输入框放行被拒值', `${P}/PropertyField.vue`, 'if (hint.value === null)', 'if (true)', `${P}/ItemControls.spec.ts`],
  ['失焦回车不恢复', `${P}/PropertyField.vue`, 'draft.value = String(props.modelValue)', '', `${P}/ItemControls.spec.ts`],
  ['外部改值不同步草稿', `${P}/PropertyField.vue`, 'draft.value = String(value)', '', `${P}/ItemControls.spec.ts`],
  ['失焦不提交', `${P}/PropertyField.vue`, '@blur="onTextCommit"', '', `${P}/ItemControls.spec.ts`],
  ['回车不提交', `${P}/PropertyField.vue`, '@keydown.enter="onTextCommit"', '', `${P}/ItemControls.spec.ts`],
  ['换盒子不重建字段', `${P}/ItemControls.vue`, ':key="`${selectedItem.id}:${prop.key}`"', ':key="prop.key"', `${P}/ItemControls.spec.ts`],
  ['仅演示区标注挂错', `${P}/PropertyField.vue`, 'v-if="props.prop.demoOnly"', 'v-if="props.prop.kind === \'number\'"', `${P}/ItemControls.spec.ts`],
  ['CSS 区说明不显示', `${P}/CssOutput.vue`, 'v-if="demoOnlyNames"', 'v-if="false"', `${P}/CssOutput.spec.ts`],
  ['滑块不跟状态走', `${P}/PropertyField.vue`, ':value="props.modelValue"', ':value="props.prop.default"', `${P}/ContainerControls.spec.ts`],
  ['手柄的宽度上限不读表', `${P}/StageResizer.vue`, 'clamp(from.width + event.clientX - from.x, widthProp)', 'clamp(from.width + event.clientX - from.x, { min: 200, max: 1200 })', `${P}/StageResizer.spec.ts`],
  ['默认宽高不读表', 'src/core/defaults.ts', 'container: defaultsOf(containerProperties) as FlexContainerState', 'container: { ...defaultsOf(containerProperties), width: 720, height: 320 } as FlexContainerState', 'src/data/flexProperties.spec.ts'],
  ['导出不写宽度', 'src/core/cssEmit.ts', '`width: ${container.width}px`,', '', 'src/core/cssEmit.spec.ts'],
]

const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
let blind = 0
for (const [name, file, find, replace, test] of mutations) {
  const source = readFileSync(file, 'utf8')
  const count = source.split(find).length - 1
  if (count !== 1) {
    console.log(`探针失效  ${name}：查找串出现 ${count} 次`)
    blind++
    continue
  }
  const before = hash(file)
  writeFileSync(file, source.replace(find, () => replace))
  if (hash(file) === before) {
    console.log(`探针失效  ${name}：文件没变`)
    blind++
    continue
  }
  let red = false
  try {
    execSync(`node_modules/.bin/vitest run ${test}`, { stdio: 'pipe' })
  }
  catch {
    red = true
  }
  writeFileSync(file, source)
  if (hash(file) !== before)
    throw new Error(`还原失败：${file}`)
  if (!red)
    blind++
  console.log(`${red ? '红' : '绿 ← 瞎守卫'}  ${name}`)
}
console.log(`${mutations.length} 条变异，${blind} 条没变红或探针失效`)
```

Run: `node $SP/mutate.mjs && git status --short`
Expected: 20 条全部「红」，最后一行 `0 条没变红或探针失效`；`git status` 与跑之前相同（变异全部还原）。
出现「探针失效」先修查找串再重跑；出现「绿」先查守卫，不要改变异。

- **Step 5: 全量验证**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: 全部通过，记下测试总数

- **Step 6: 浏览器核对（先问用户是否开 claude-in-chrome）**

核对前先读 [browser-verification.md](../../browser-verification.md)。清单，一律以 DOM 状态与 console 为准：

1. basis 输入框：打 `50` 出提示、状态不变；按回车、点别处都会恢复并提示「已恢复为 …」
2. 提示文案在设置区窄列里的换行
3. 宽高滑块与拖拽手柄双向同步；滑块的键盘方向键能调尺寸
4. 「仅演示区」标注与 CSS 区顶部说明的排版
5. 带 `initial` basis 的分享链接打开后回默认

---

### Task 8: 文档与红线

**Files:**
- Modify: `CLAUDE.md`（设计红线加第 9 条，用户已同意）
- Modify: `.docs/pitfalls.md`、`.docs/architecture.md`、`.docs/progress.md`
- Modify: 本计划（加状态横幅，复选框改普通列表项）

- **Step 1: CLAUDE.md 设计红线第 9 条**

```markdown
9. **设置区、演示区、CSS 区三处必须一致**：设置区收下的每个值，演示区（单项属性）与导出的 CSS（`flex` 简写）要渲染出同一个布局。
   `flex` 简写遇到某些 basis 会整条失效（grow、shrink 一起丢），单项属性只丢 basis——所以 basis 由属性表的 `check` 把关、分享链接走同一道关；
   新增可输入的值类型前先在真实 Chrome 里重测，[`basisSyntax.chrome.json`](./src/core/basisSyntax.chrome.json) 的守卫钉着。
   → [详见](./.docs/pitfalls.md#flex-简写与单项属性对-basis-的分歧)
```

- **Step 2: pitfalls.md 新增一节「flex 简写与单项属性对 basis 的分歧」**

内容：spec 里的实测表；带回退的替换函数为什么照样拒；`calc-size()` 是按同一原则补上的；
新增可输入的值类型的流程（先重测夹具、再放进 `basisSyntax.spec.ts` 的用例表）。

- **Step 3: architecture.md**

- 「分层」表的纯逻辑一行加上 `basisSyntax`（basis 的语法分类与拒收原因），并说明它是 `data/` 唯一依赖的 core 模块、自身零 import，这样才不成环
- 「八条设计红线」改成「九条」

- **Step 4: progress.md**

- 里程碑表加「M14 三处一致」，写明验证证据（对拍场景数与结果、变异条数、测试总数）
- 「交接」节：待确认项改为已确认并链到 spec 与本计划；「已知代价」里键盘调尺寸改为由宽高滑块承担
- 待处理第 3 条（浏览器排查）里「方案 1 新增的界面」换成 Task 7 Step 6 的清单（若已核对则记结果）

- **Step 5: 本计划收尾**

开头加状态横幅（「已完成，过程记录，不是待办清单」），复选框改成普通列表项，与其余计划文档一致。

---

### Task 9: 提交、推送与部署核对

- **Step 1**：走 `/commit`，与工作区里原有的未提交改动一起提交（用户决定）。拆分提交时逐个在临时 worktree 里验证暂存区：
  直接调 `node_modules/.bin/vitest run` 与 `node_modules/.bin/vue-tsc --noEmit`，并先在干净 HEAD 上跑出基线自证
- **Step 2**：**推送前向用户确认一次**，再快进 `main`、推送 `dev` 与 `main`
- **Step 3**：确认 Pages 部署成功、线上资源哈希与本地构建一致

---

## 执行偏差

实施时对本计划做的改动，每条都有理由：

1. **Task 1**：夹具行数断言 64 → 63——值表逐类相加是 19 + 15 + 3 + 7 + 7 + 2 + 10 = 63，计划数错了
2. **Task 1**：夹具自证用例里的正常值 `100px` → `50px`——`100px` 不在探针值表里，照抄会因 `undefined` 变红
3. **Task 4**：同时删掉 `MetricsTable.spec.ts` 的「basis 非法时说清浏览器怎么处理」——计划漏列，它测的正是被删的文案
4. **Task 5**：`defaultsOf` 改成泛型 `defaultsOf<T>()`——计划里的 `defaultsOf(...) as FlexContainerState` 过不了 vue-tsc（TS2352）；
   变异「默认宽高不读表」的查找串随之改成 `container: defaultsOf<FlexContainerState>(containerProperties)`
5. **Task 6**：「仅演示区只标在…属性名旁」加一条 `badges.length > 0`——照抄的版本在实现之前就绿（0 个标注对 0 个预期）
6. **Task 7**：第 6 步浏览器核对挪到推送之前单独进行，调用 claude-in-chrome 前先问用户
7. **Task 7**：变异脚本加了一步，按输出区分「断言失败」与「编译失败」，只有前者算数

### 终审之后

独立终审（opus）找出两条 Important，已在本计划之外修掉，详见 [spec 的终审补记](../specs/2026-09-23-three-way-consistency-design.md#终审补记2026-09-23)：

8. `basisSyntax.ts` 由「只看最外层函数名」改为保守解析器，新增拒收原因 `math-syntax`；`BasisKind` 收窄为非 export
9. Task 1 的探针从本文档搬进仓库（[basisSyntax.probe.html](../../../src/core/basisSyntax.probe.html)），候选集扩到 1000 个，守卫改为对整个候选集断言
10. 回车判断排除输入法组合
11. 变异清单扩到 30 条
12. 用户选定的终审 Minor 一并修掉：规范写法（`normalize`）与点预设清提示、可访问性三项、「内容尺寸」不链 MDN、拆出 `constants.ts`；变异清单扩到 37 条
13. 浏览器核对在真实 Chrome 里复现了「失焦时提示变长、按住的控件被挤走、点击落空」，改为按住时等松手再恢复；变异清单扩到 38 条

