# M5 陷阱内容层与滚动叙事 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 todo-flex 加上 5 个 CSS Flexbox 陷阱板块，每个用「现象 → 归因 → 修复」三拍滚动叙事讲清楚，并能一键把该陷阱的布局状态载入 Playground 复现。

**Architecture:** 陷阱数据是纯 patch（只写相对默认状态改动的字段），由 `core/trapPatch.ts` 的纯函数合并成完整 `FlexState` 并算出属性差异；陷阱演示区 `TrapStage` 是不带观测层的独立组件（真实 DOM + 真实 CSS flex）；三拍由 ScrollTrigger 的 pin 把滚动进度映射成离散拍号驱动，窄屏与 reduced-motion 下整体降级为静态堆叠；一键复现直接改 `useFlexState` 单例，地址栏由既有的 `useShareUrl` 自动跟上。

**Tech Stack:** Vue 3 script setup · TypeScript · GSAP ScrollTrigger · UnoCSS · prismjs · Vitest + @vue/test-utils + happy-dom

**Spec:** `docs/superpowers/specs/2026-09-11-traps-and-scroll-narrative-design.md`

## Global Constraints

以下约束来自项目 CLAUDE.md 与 spec，**每个 task 都隐含包含**：

- 代码注释、提交信息、对话回复一律用**简体中文**（代码标识符除外）。
- 包管理器固定 **pnpm**。TypeScript 锁定 6.x，不得升级到 7.x。已有依赖不得自行升级。
- 路径别名 `~/` → `src/`。
- **自动导入**：`auto-imports.d.ts` / `components.d.ts` 是生成物，不要手改。本计划的代码一律**显式写 import**（与 `useFlexState.ts` / `useFlip.ts` 现有写法一致），不依赖自动导入，这样测试环境与构建环境行为一致。
- 代码风格由 `@antfu/eslint-config` 决定，格式问题一律交给 `pnpm lint:fix`，**不要手动排版**。
- 测试文件与源码同目录，命名 `*.spec.ts`。
- **红线 1**：演示区必须是真实 DOM + 真实 CSS flex 渲染，禁止用 JS 计算盒子位置模拟布局。
- **红线 2**：`src/core/` 下所有模块零 DOM 依赖，连 vue 都不 import。
- **红线 6**：演示区的描边一律用 `outline`，**禁止 `border` 与 `padding`**（两者都占布局空间，会让实际尺寸偏离推导值）。
- **红线 7**：演示区的 item **禁止 `overflow: hidden`**（会让 `min-width: auto` 失效，陷阱 1 就演不出来了）。
- **提交走 `/commit` skill**，不要手写 `git add` + `git commit` 绕过它。当前工作分支是 `dev`。每个 task 末尾给出的是**建议的提交信息**，实际提交时把它交给 `/commit` skill。
- **完成前必须给证据**：每个 task 末尾跑 `pnpm test`，全部 task 结束后跑 `pnpm lint` + `pnpm build`，把输出贴出来。

---

## 文件结构

**新建：**

| 文件 | 职责 |
| --- | --- |
| `src/core/trapPatch.ts` | patch 合并成完整 `FlexState`、两份 state 相减出属性差异。纯函数，零 DOM |
| `src/core/trapPatch.spec.ts` | 上者的测试 |
| `src/data/traps.ts` | 5 个陷阱的数据定义（状态 patch + 三拍文案），纯数据 |
| `src/data/traps.spec.ts` | 陷阱数据的守卫测试 |
| `src/composables/useTrapScroll.ts` | ScrollTrigger 封装：滚动进度 → 拍号（带滞回）+ 降级判断 |
| `src/composables/useTrapScroll.spec.ts` | 上者的测试（主要测纯函数部分） |
| `src/components/traps/TrapStage.vue` | 陷阱专用精简演示区，接 props 渲染真实 flex |
| `src/components/traps/TrapStage.spec.ts` | 上者的测试 |
| `src/components/traps/TrapDiff.vue` | 归因拍的属性差异表 |
| `src/components/traps/TrapDiff.spec.ts` | 上者的测试 |
| `src/components/traps/TrapSection.vue` | 单个陷阱板块：三拍状态机 + 一键复现按钮 |
| `src/components/traps/TrapSection.spec.ts` | 上者的测试 |
| `src/components/traps/TrapsSection.vue` | 陷阱区容器，遍历 traps |

**修改：**

| 文件 | 改动 |
| --- | --- |
| `src/core/types.ts` | 追加 `TrapItemPatch` / `TrapVariant` / `TrapBeat` / `Trap` / `PropertyDiff` 五个类型 |
| `src/composables/useFlexState.ts` | 新增导出 `loadState(next: FlexState)` |
| `src/App.vue` | 给 `ThePlayground` 加 `id="playground"`，其后挂上 `TrapsSection` |

---

## Task 1: 陷阱类型与 patch 合并 / 差异提取

**Files:**
- Modify: `src/core/types.ts`（文件末尾追加）
- Create: `src/core/trapPatch.ts`
- Test: `src/core/trapPatch.spec.ts`

**Interfaces:**
- Consumes: `createDefaultState()` / `createDefaultItem(id)` from `src/core/defaults.ts`；`FlexState` / `FlexContainerState` / `FlexItemState` from `src/core/types.ts`
- Produces:
  - `resolveVariant(trap: Trap, which: 'before' | 'after'): FlexState`
  - `diffStates(before: FlexState, after: FlexState): PropertyDiff[]`
  - `CONTAINER_KEYS: readonly (keyof FlexContainerState)[]`（导出仅供测试断言覆盖完整）
  - `ITEM_KEYS: readonly (keyof Omit<FlexItemState, 'id'>)[]`（同上）
  - 类型 `Trap` / `TrapVariant` / `TrapItemPatch` / `TrapBeat` / `PropertyDiff`

- [ ] **Step 1: 在 `src/core/types.ts` 末尾追加陷阱相关类型**

```ts
/** 陷阱状态的一处局部改动。item 按索引定位——陷阱数据不关心 id 是怎么生成的 */
export interface TrapItemPatch {
  index: number
  patch: Partial<Omit<FlexItemState, 'id'>>
}

/**
 * 一层状态改动。只写要改的字段，其余从上一层继承。
 * 陷阱大多只差一两个字段，写完整 state 会被噪音淹掉真正的差异点，
 * 而「差异点是什么」恰恰是陷阱要教的东西。
 */
export interface TrapVariant {
  container?: Partial<FlexContainerState>
  /** 盒子数量。给了就按这个数量重建 items，不给则沿用上一层 */
  itemCount?: number
  items?: TrapItemPatch[]
}

export interface TrapBeat {
  title: string
  body: string
  /** 可选的展示用代码块，交给 prismjs 高亮 */
  code?: string
}

export interface Trap {
  id: string
  title: string
  /** 一句话钩子，放在板块标题下 */
  hook: string
  /** 这个陷阱的公共起点，打在 createDefaultState() 上 */
  base: TrapVariant
  /** 现象态 = default + base + before */
  before: TrapVariant
  /** 修复态 = default + base + after */
  after: TrapVariant
  /** 恰好三拍：现象 / 归因 / 修复 */
  beats: [TrapBeat, TrapBeat, TrapBeat]
}

/** 归因拍展示的一条属性差异。值一律转成字符串，格式化成人话是展示层的事 */
export interface PropertyDiff {
  scope: 'container' | 'item'
  /** scope 为 item 时才有 */
  itemIndex?: number
  key: string
  from: string
  to: string
}
```

- [ ] **Step 2: 写失败的测试 `src/core/trapPatch.spec.ts`**

```ts
import type { Trap } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultState } from './defaults'
import { CONTAINER_KEYS, diffStates, ITEM_KEYS, resolveVariant } from './trapPatch'

/** 造一个最小可用的陷阱，只有被测字段是真的 */
function makeTrap(partial: Partial<Trap>): Trap {
  return {
    id: 'test',
    title: '测试陷阱',
    hook: '钩子',
    base: {},
    before: {},
    after: {},
    beats: [
      { title: '现象', body: '' },
      { title: '归因', body: '' },
      { title: '修复', body: '' },
    ],
    ...partial,
  }
}

describe('resolveVariant', () => {
  it('不带任何 patch 时就是默认状态', () => {
    expect(resolveVariant(makeTrap({}), 'before')).toEqual(createDefaultState())
  })

  it('按 default → base → 变体的顺序叠加，后者覆盖前者', () => {
    const trap = makeTrap({
      base: { container: { width: 480, justifyContent: 'center' } },
      before: { container: { width: 300 } },
    })

    const state = resolveVariant(trap, 'before')

    expect(state.container.width).toBe(300) // 变体覆盖 base
    expect(state.container.justifyContent).toBe('center') // base 保留
    expect(state.container.height).toBe(320) // 默认值保留
  })

  it('item patch 按索引落到对应盒子，其余盒子不受影响', () => {
    const trap = makeTrap({
      base: { items: [{ index: 0, patch: { grow: 1, size: 320 } }] },
    })

    const state = resolveVariant(trap, 'before')

    expect(state.items[0].grow).toBe(1)
    expect(state.items[0].size).toBe(320)
    expect(state.items[1].grow).toBe(0)
    expect(state.items[1].size).toBe(80)
  })

  it('itemCount 大于默认数量时补出新盒子，id 不重复', () => {
    const trap = makeTrap({ base: { itemCount: 4, items: [{ index: 3, patch: { size: 100 } }] } })

    const state = resolveVariant(trap, 'before')

    expect(state.items).toHaveLength(4)
    expect(state.items[3].size).toBe(100)
    expect(new Set(state.items.map(item => item.id)).size).toBe(4)
  })

  it('itemCount 小于默认数量时裁掉多余的盒子', () => {
    const state = resolveVariant(makeTrap({ base: { itemCount: 2 } }), 'before')

    expect(state.items).toHaveLength(2)
  })

  it('before 与 after 互不污染——解析 after 不会带上 before 的改动', () => {
    const trap = makeTrap({
      before: { container: { wrap: 'nowrap' } },
      after: { container: { wrap: 'wrap' } },
    })

    expect(resolveVariant(trap, 'before').container.wrap).toBe('nowrap')
    expect(resolveVariant(trap, 'after').container.wrap).toBe('wrap')
  })

  it('返回的是新对象，反复调用不会互相影响', () => {
    const trap = makeTrap({ base: { items: [{ index: 0, patch: { grow: 1 } }] } })

    const first = resolveVariant(trap, 'before')
    first.items[0].grow = 99

    expect(resolveVariant(trap, 'before').items[0].grow).toBe(1)
  })
})

describe('diffStates', () => {
  it('两份状态完全相同时没有任何差异', () => {
    expect(diffStates(createDefaultState(), createDefaultState())).toEqual([])
  })

  it('容器属性的差异带上 container 作用域', () => {
    const before = createDefaultState()
    const after = createDefaultState()
    after.container.wrap = 'wrap'

    expect(diffStates(before, after)).toEqual([
      { scope: 'container', key: 'wrap', from: 'nowrap', to: 'wrap' },
    ])
  })

  it('item 属性的差异带上索引', () => {
    const before = createDefaultState()
    const after = createDefaultState()
    after.items[1].minWidthAuto = false

    expect(diffStates(before, after)).toEqual([
      { scope: 'item', itemIndex: 1, key: 'minWidthAuto', from: 'true', to: 'false' },
    ])
  })

  it('base 里已经改过、before 与 after 又一致的字段不算差异', () => {
    // 这是 diff 必须拿两份完整 state 相减、而不是直读 patch 的原因
    const trap = makeTrap({
      base: { container: { width: 480 } },
      before: { items: [{ index: 0, patch: { minWidthAuto: true } }] },
      after: { items: [{ index: 0, patch: { minWidthAuto: false } }] },
    })

    const diffs = diffStates(resolveVariant(trap, 'before'), resolveVariant(trap, 'after'))

    expect(diffs).toEqual([
      { scope: 'item', itemIndex: 0, key: 'minWidthAuto', from: 'true', to: 'false' },
    ])
  })

  it('顺序确定：容器差异在前，item 差异按索引升序在后', () => {
    const before = createDefaultState()
    const after = createDefaultState()
    after.items[2].grow = 1
    after.items[0].grow = 1
    after.container.wrap = 'wrap'

    expect(diffStates(before, after).map(diff => [diff.scope, diff.itemIndex])).toEqual([
      ['container', undefined],
      ['item', 0],
      ['item', 2],
    ])
  })

  it('盒子数量不同时只比对两边都有的那些，不崩', () => {
    const before = createDefaultState()
    const after = createDefaultState()
    after.items = after.items.slice(0, 2)

    expect(() => diffStates(before, after)).not.toThrow()
    expect(diffStates(before, after)).toEqual([])
  })
})

describe('差异表的字段清单', () => {
  it('CONTAINER_KEYS 覆盖了 FlexContainerState 的全部字段', () => {
    expect([...CONTAINER_KEYS].sort()).toEqual(
      Object.keys(createDefaultState().container).sort(),
    )
  })

  it('ITEM_KEYS 覆盖了 FlexItemState 除 id 外的全部字段', () => {
    const itemKeys = Object.keys(createDefaultState().items[0]).filter(key => key !== 'id')
    expect([...ITEM_KEYS].sort()).toEqual(itemKeys.sort())
  })
})
```

- [ ] **Step 3: 运行测试确认它失败**

Run: `pnpm vitest run src/core/trapPatch.spec.ts`
Expected: FAIL，报错类似 `Failed to resolve import "./trapPatch"`

- [ ] **Step 4: 写实现 `src/core/trapPatch.ts`**

```ts
import type {
  FlexContainerState,
  FlexItemState,
  FlexState,
  PropertyDiff,
  Trap,
  TrapVariant,
} from './types'
import { createDefaultItem, createDefaultState } from './defaults'

/**
 * 差异表的行序。显式列出而不是 `Object.keys(state.container)`——
 * 后者的顺序依赖对象字面量的书写顺序，哪天调一下 createDefaultState 的字段排列，
 * 归因拍的行序就跟着无声无息地变了。测试里断言这份清单覆盖完整，漏字段会红。
 */
export const CONTAINER_KEYS = [
  'display',
  'direction',
  'wrap',
  'justifyContent',
  'alignItems',
  'alignContent',
  'rowGap',
  'columnGap',
  'width',
  'height',
] as const satisfies readonly (keyof FlexContainerState)[]

export const ITEM_KEYS = [
  'grow',
  'shrink',
  'basis',
  'order',
  'alignSelf',
  'size',
  'minWidthAuto',
  'marginAuto',
] as const satisfies readonly (keyof Omit<FlexItemState, 'id'>)[]

/** 把一层变体叠到已有状态上，返回新对象——入参一律不改 */
function applyVariant(state: FlexState, variant: TrapVariant): FlexState {
  const container = { ...state.container, ...variant.container }

  // 给了 itemCount 就按这个数量重建：多则裁掉，少则用默认盒子补齐
  const source = variant.itemCount === undefined
    ? state.items
    : Array.from(
        { length: variant.itemCount },
        (_, index) => state.items[index] ?? createDefaultItem(`item-${index + 1}`),
      )

  const items = source.map((item, index) => {
    const patch = variant.items?.find(entry => entry.index === index)?.patch
    return patch ? { ...item, ...patch } : { ...item }
  })

  return { container, items, selectedId: state.selectedId }
}

/** 默认状态 → base → 指定变体，逐层叠出一份完整可用的 FlexState */
export function resolveVariant(trap: Trap, which: 'before' | 'after'): FlexState {
  return applyVariant(applyVariant(createDefaultState(), trap.base), trap[which])
}

/**
 * 两份完整状态相减。
 *
 * **必须拿解析后的完整 state 相减，不能直读 patch**：base 里可能已经含有
 * 与 after 相同的字段，直读 patch 会报出根本不存在的假差异。
 *
 * 值一律 String 化，格式化成人话（`minWidthAuto: true` → `min-width: auto`）
 * 是展示层的事——core 不碰文案。
 */
export function diffStates(before: FlexState, after: FlexState): PropertyDiff[] {
  const diffs: PropertyDiff[] = []

  for (const key of CONTAINER_KEYS) {
    const from = before.container[key]
    const to = after.container[key]
    if (from !== to)
      diffs.push({ scope: 'container', key, from: String(from), to: String(to) })
  }

  const count = Math.min(before.items.length, after.items.length)
  for (let index = 0; index < count; index++) {
    for (const key of ITEM_KEYS) {
      const from = before.items[index][key]
      const to = after.items[index][key]
      if (from !== to)
        diffs.push({ scope: 'item', itemIndex: index, key, from: String(from), to: String(to) })
    }
  }

  return diffs
}
```

- [ ] **Step 5: 运行测试确认全绿**

Run: `pnpm vitest run src/core/trapPatch.spec.ts`
Expected: PASS，15 个测试全过

- [ ] **Step 6: 跑一遍全量测试，确认没碰坏别处**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 7: 提交**

走 `/commit` skill，建议提交信息：

```
feat(core): 新增陷阱状态的 patch 合并与差异提取

陷阱大多只跟默认状态差一两个字段，写完整 state 会被噪音淹掉真正的差异点。
改用分层 patch，并让差异从两份解析后的完整状态相减得出——base 里可能已含有
与 after 相同的字段，直读 patch 会报出并不存在的假差异。
```

---

## Task 2: 五个陷阱的数据定义

**Files:**
- Create: `src/data/traps.ts`
- Test: `src/data/traps.spec.ts`

**Interfaces:**
- Consumes: `Trap` from `src/core/types.ts`；`resolveVariant` / `diffStates` from `src/core/trapPatch.ts`（仅测试用）
- Produces: `traps: Trap[]`（5 条，顺序即页面展示顺序）

**背景**：数值全部来自 spec 第 8 节，已手工验算过。默认状态是容器 720×320、gap 12、3 个 `size: 80` 的盒子（`grow: 0, shrink: 1, basis: 'auto', minWidthAuto: true`）。

- [ ] **Step 1: 写失败的测试 `src/data/traps.spec.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { diffStates, resolveVariant } from '~/core/trapPatch'
import { traps } from './traps'

describe('陷阱数据', () => {
  it('恰好五个陷阱，id 互不重复', () => {
    expect(traps).toHaveLength(5)
    expect(new Set(traps.map(trap => trap.id)).size).toBe(5)
  })

  it.each(traps)('$id 的 before 与 after 都能解析成合法状态', (trap) => {
    for (const which of ['before', 'after'] as const) {
      const state = resolveVariant(trap, which)
      expect(state.items.length).toBeGreaterThan(0)
      expect(new Set(state.items.map(item => item.id)).size).toBe(state.items.length)
      expect(state.container.width).toBeGreaterThan(0)
      expect(state.container.height).toBeGreaterThan(0)
    }
  })

  it.each(traps)('$id 的 before → after 至少有一条差异', (trap) => {
    // 防止写出「改了但没改」的陷阱：归因拍会因此变成一张空表
    const diffs = diffStates(resolveVariant(trap, 'before'), resolveVariant(trap, 'after'))
    expect(diffs.length).toBeGreaterThan(0)
  })

  it.each(traps)('$id 恰好三拍且每拍都有文案', (trap) => {
    expect(trap.beats).toHaveLength(3)
    for (const beat of trap.beats) {
      expect(beat.title.length).toBeGreaterThan(0)
      expect(beat.body.length).toBeGreaterThan(0)
    }
  })

  it.each(traps)('$id 有标题与钩子文案', (trap) => {
    expect(trap.title.length).toBeGreaterThan(0)
    expect(trap.hook.length).toBeGreaterThan(0)
  })

  it('陷阱一的现象态确实会溢出容器', () => {
    // 480 的容器里塞下 320 + 80 + 80 + 两道 12 的 gap = 504
    const trap = traps.find(item => item.id === 'min-width-auto')!
    const state = resolveVariant(trap, 'before')
    const content = state.items.reduce((sum, item) => sum + item.size, 0)
    const gaps = state.container.columnGap * (state.items.length - 1)

    expect(content + gaps).toBeGreaterThan(state.container.width)
  })

  it('陷阱三的差异恰好是 flex 简写展开的那三个属性', () => {
    const trap = traps.find(item => item.id === 'flex-shorthand')!
    const diffs = diffStates(resolveVariant(trap, 'before'), resolveVariant(trap, 'after'))

    expect(new Set(diffs.map(diff => diff.key))).toEqual(new Set(['grow', 'shrink', 'basis']))
  })

  it('陷阱三关掉了自动最小尺寸，免得跟陷阱一串味', () => {
    // 不关的话 flex: 1 的结果会被 min-width:auto 从 152 撑回 200，修复态就演不出来了
    const trap = traps.find(item => item.id === 'flex-shorthand')!
    const state = resolveVariant(trap, 'after')

    expect(state.items.every(item => !item.minWidthAuto)).toBe(true)
  })

  it('陷阱四的修复态确实需要换行', () => {
    // 4 × 100 + 3 × 12 = 436 > 360，nowrap 时必然溢出、wrap 时必然分行
    const trap = traps.find(item => item.id === 'align-content-single-line')!
    const state = resolveVariant(trap, 'after')
    const content = state.items.reduce((sum, item) => sum + item.size, 0)
    const gaps = state.container.columnGap * (state.items.length - 1)

    expect(state.container.wrap).toBe('wrap')
    expect(content + gaps).toBeGreaterThan(state.container.width)
  })

  it('陷阱五的容器设了 space-between，否则无从失效', () => {
    const trap = traps.find(item => item.id === 'margin-auto')!

    expect(resolveVariant(trap, 'before').container.justifyContent).toBe('space-between')
    expect(resolveVariant(trap, 'after').container.justifyContent).toBe('space-between')
  })

  it('陷阱五的现象态留有 456px 剩余空间给 auto margin 吃', () => {
    // 文案里「456px」「每个 228px」就是从这儿算出来的，改了 base 数值这条会先红
    const trap = traps.find(item => item.id === 'margin-auto')!
    const state = resolveVariant(trap, 'before')
    const content = state.items.reduce((sum, item) => sum + item.size, 0)
    const gaps = state.container.columnGap * (state.items.length - 1)

    expect(state.container.width - content - gaps).toBe(456)
    expect(state.items[0].marginAuto).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `pnpm vitest run src/data/traps.spec.ts`
Expected: FAIL，报错类似 `Failed to resolve import "./traps"`

- [ ] **Step 3: 写实现 `src/data/traps.ts`**

```ts
import type { Trap } from '~/core/types'

/**
 * 五个陷阱，顺序即页面展示顺序。
 *
 * 状态一律写成相对 `createDefaultState()` 的 patch，只列改动的字段。
 * 默认状态是：容器 720×320、gap 12、三个 size 80 的盒子（flex: 0 1 auto，min-width: auto 开着）。
 *
 * 数值都是算过的，改动前先把 `traps.spec.ts` 里那几条现象守卫测试看一遍——
 * 它们钉住的是「这个陷阱还演不演得出来」，不是格式。
 */
export const traps: Trap[] = [
  {
    id: 'min-width-auto',
    title: 'min-width: auto 让 flex: 1 不肯收缩',
    hook: '明明写了 flex: 1，盒子却撑爆容器——Flexbox 最高频的一个坑。',
    base: {
      container: { width: 480 },
      items: [{ index: 0, patch: { grow: 1, basis: '0', size: 320 } }],
    },
    before: { items: [{ index: 0, patch: { minWidthAuto: true } }] },
    after: { items: [{ index: 0, patch: { minWidthAuto: false } }] },
    beats: [
      {
        title: '现象',
        body: 'A 写着 flex: 1 1 0，按理该老实分剩余空间。可它偏偏卡在 320px 上不动，三个盒子加起来 504px，把 480px 的容器顶出去 24px。',
      },
      {
        title: '归因',
        body: 'flex item 的 min-width 初始值不是 0，是 auto——意思是「不得小于内容的最小尺寸」。A 的内容固有尺寸正好 320px，收缩在这里被截停，flex-shrink 算出来的值根本没机会落地。',
        code: '/* 浏览器实际在用的是这个 */\n.item {\n  flex: 1 1 0;\n  min-width: auto; /* ← 初始值，不是 0 */\n}',
      },
      {
        title: '修复',
        body: '显式写 min-width: 0 把这道下限撤掉，A 才落回推导值 296px，容器不再溢出。主轴是纵向时，要改的是 min-height。',
      },
    ],
  },
  {
    id: 'basis-source',
    title: 'flex-basis 才是主轴尺寸的起点',
    hook: '三个盒子都写了 flex-grow: 1，为什么分出来还是不一样宽？',
    base: {
      items: [
        { index: 0, patch: { grow: 1, size: 200 } },
        { index: 1, patch: { grow: 1 } },
        { index: 2, patch: { grow: 1 } },
      ],
    },
    before: {
      items: [
        { index: 0, patch: { basis: 'auto' } },
        { index: 1, patch: { basis: 'auto' } },
        { index: 2, patch: { basis: 'auto' } },
      ],
    },
    after: {
      items: [
        { index: 0, patch: { basis: '0' } },
        { index: 1, patch: { basis: '0' } },
        { index: 2, patch: { basis: '0' } },
      ],
    },
    beats: [
      {
        title: '现象',
        body: '三个盒子的 flex-grow 都是 1，理应雨露均沾。实际却是 312 / 192 / 192——A 平白多出 120px。',
      },
      {
        title: '归因',
        body: 'flex-grow 分的是「剩余空间」，不是「全部空间」。basis 为 auto 时每个盒子先按各自的内容尺寸占位（200 / 80 / 80），剩下的 336px 才拿去均分，每人 112px。起点不同，终点自然不同。',
      },
      {
        title: '修复',
        body: '把 basis 改成 0，等于宣布「谁都不许先占位」，整个 696px 都是剩余空间，三个盒子这才精确均分到 232px。想要等宽，要动的是 basis 而不是 grow。',
      },
    ],
  },
  {
    id: 'flex-shorthand',
    title: 'flex 简写背后是三个属性',
    hook: 'flex: none 和 flex: 1 只差一个词，排出来天差地别。',
    base: {
      container: { width: 480 },
      items: [
        { index: 0, patch: { size: 200, minWidthAuto: false } },
        { index: 1, patch: { size: 200, minWidthAuto: false } },
        { index: 2, patch: { size: 200, minWidthAuto: false } },
      ],
    },
    before: {
      items: [
        { index: 0, patch: { grow: 0, shrink: 0, basis: 'auto' } },
        { index: 1, patch: { grow: 0, shrink: 0, basis: 'auto' } },
        { index: 2, patch: { grow: 0, shrink: 0, basis: 'auto' } },
      ],
    },
    after: {
      items: [
        { index: 0, patch: { grow: 1, shrink: 1, basis: '0' } },
        { index: 1, patch: { grow: 1, shrink: 1, basis: '0' } },
        { index: 2, patch: { grow: 1, shrink: 1, basis: '0' } },
      ],
    },
    beats: [
      {
        title: '现象',
        body: 'flex: none 的三个盒子各占 200px，加起来 624px，硬生生把 480px 的容器撑破，一点都不肯让。',
      },
      {
        title: '归因',
        body: 'flex 是三个属性的简写，换一个关键字等于同时换掉 grow / shrink / basis 三个值。none 的意思是「既不长也不缩」，所以哪怕容器装不下，它也纹丝不动。',
        code: 'flex: 1        →  1 1 0     可长可缩，忽略内容尺寸\nflex: auto     →  1 1 auto  可长可缩，但从内容尺寸起算\nflex: initial  →  0 1 auto  不长只缩（这是默认值）\nflex: none     →  0 0 auto  既不长也不缩',
      },
      {
        title: '修复',
        body: 'flex: 1 展开是 1 1 0——允许伸长、允许收缩、且不拿内容尺寸当起点。三个盒子这才各自落到 152px，正好填满容器。',
      },
    ],
  },
  {
    id: 'align-content-single-line',
    title: 'align-content 在单行容器上完全无效',
    hook: '改了 align-content 却毫无反应？先看看 flex-wrap。',
    base: {
      container: { width: 360, alignContent: 'center' },
      itemCount: 4,
      items: [
        { index: 0, patch: { size: 100, shrink: 0 } },
        { index: 1, patch: { size: 100, shrink: 0 } },
        { index: 2, patch: { size: 100, shrink: 0 } },
        { index: 3, patch: { size: 100, shrink: 0 } },
      ],
    },
    before: { container: { wrap: 'nowrap' } },
    after: { container: { wrap: 'wrap' } },
    beats: [
      {
        title: '现象',
        body: 'align-content 从头到尾都写着 center，可无论怎么改都看不出任何变化——四个盒子挤在一行里溢出容器，纹丝不动。这就是最常见的那句「我改了，但它没反应」。',
      },
      {
        title: '归因',
        body: 'align-content 管的是「多行之间在交叉轴上怎么排」。nowrap 的容器永远只有一行，没有「行与行之间」可言，规范因此规定这个属性在单行容器上完全不生效——不是写错了，是压根没有作用对象。',
      },
      {
        title: '修复',
        body: '把 flex-wrap 改成 wrap，四个盒子排成两行，align-content: center 当场生效，两行整体在交叉轴上居中。属性本身一直是对的，缺的是让它有意义的前提。',
      },
    ],
  },
  {
    id: 'margin-auto',
    title: 'margin: auto 一旦生效，justify-content 就靠边站',
    hook: 'justify-content 写着 space-between，三个盒子的位置却完全不是那么回事。',
    base: { container: { justifyContent: 'space-between' } },
    before: { items: [{ index: 0, patch: { marginAuto: true } }] },
    after: { items: [{ index: 0, patch: { marginAuto: false } }] },
    beats: [
      {
        title: '现象',
        body: 'space-between 本该把 A 顶在左边缘、C 顶在右边缘、B 摆在正中。实际却是 A 被推到离左边 228px 的地方，B 一路飘到右侧紧挨着 C——属性明明写了，却像没写一样。',
      },
      {
        title: '归因',
        body: '规范规定的顺序是：auto margin 先分，justify-content 后分。A 的 margin: auto 在主轴上是左右各一个，456px 的剩余空间被这两个 auto margin 对半吃光（每个 228px），轮到 justify-content 时已经无空间可分——它不是被覆盖，是被饿死了。',
      },
      {
        title: '修复',
        body: '关掉那个 margin: auto，剩余空间重新回到 justify-content 手里，space-between 立刻恢复。顺带一提：auto margin 在交叉轴上同样有效，这也是为什么它能盖过 align-items 把盒子居中。',
      },
    ],
  },
]
```

- [ ] **Step 4: 运行测试确认全绿**

Run: `pnpm vitest run src/data/traps.spec.ts`
Expected: PASS

- [ ] **Step 5: 跑全量测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 6: 提交**

走 `/commit` skill，建议提交信息：

```
feat(data): 新增五个 Flexbox 陷阱的状态与文案

每个陷阱配一组守卫测试钉住「现象还演不演得出来」——比如陷阱一的现象态
必须真的溢出、陷阱三必须关掉自动最小尺寸，否则 flex: 1 的结果会被撑回去、
跟陷阱一串味。这类断言单靠类型检查发现不了。
```

---

## Task 3: 状态源新增 loadState

**Files:**
- Modify: `src/composables/useFlexState.ts`
- Test: `src/composables/useFlexState.spec.ts`（已存在，追加用例）

**Interfaces:**
- Consumes: 模块级单例 `state`、模块级变量 `sequence`（都在 `useFlexState.ts` 内部）
- Produces: `useFlexState().loadState(next: FlexState): void`

**背景**：`useFlexState` 只在**模块加载那一刻**读一次 `location.search`，之后没有任何人监听地址栏。所以陷阱区的「载入 Playground 复现」只写 URL 是不会生效的，必须直接改单例。反过来地址栏不用管——`useShareUrl` 一直 watch 着 state，300ms 后自己就同步过去了。

- [ ] **Step 1: 先看一眼现有测试的写法**

Run: `cat src/composables/useFlexState.spec.ts`
目的：确认 `beforeEach` 里是怎么重置单例的，新用例要跟着同一套模式走（单例在测试之间会串味）。

- [ ] **Step 2: 在 `src/composables/useFlexState.spec.ts` 末尾追加失败的测试**

放在最外层 `describe` 内部、与已有用例并列：

```ts
describe('loadState', () => {
  beforeEach(() => {
    // 状态是模块级单例，每个用例前必须复位
    useFlexState().resetState()
  })

  it('整体替换状态，容器与盒子都换成传入的那一份', () => {
    const { state, loadState } = useFlexState()
    const next = createDefaultState()
    next.container.width = 480
    next.container.justifyContent = 'space-between'
    next.items[0].grow = 1

    loadState(next)

    expect(state.container.width).toBe(480)
    expect(state.container.justifyContent).toBe('space-between')
    expect(state.items[0].grow).toBe(1)
  })

  it('载入 id 不连续的状态后，新增盒子不与现有的撞号', () => {
    const { state, loadState, addItem } = useFlexState()
    const next = createDefaultState()
    // 模拟「删掉中间那个盒子」之后的状态：id 跳号
    next.items = [next.items[0], next.items[2]]

    loadState(next)
    addItem()

    expect(state.items.map(item => item.id)).toEqual(['item-1', 'item-3', 'item-4'])
    expect(new Set(state.items.map(item => item.id)).size).toBe(state.items.length)
  })

  it('载入后修改原对象不会再影响单例', () => {
    const { state, loadState } = useFlexState()
    const next = createDefaultState()

    loadState(next)
    next.container.width = 999
    next.items[0].grow = 99

    expect(state.container.width).not.toBe(999)
    expect(state.items[0].grow).not.toBe(99)
  })
})
```

若文件顶部还没 import `createDefaultState`，补上：

```ts
import { createDefaultState } from '~/core/defaults'
```

- [ ] **Step 3: 运行测试确认它失败**

Run: `pnpm vitest run src/composables/useFlexState.spec.ts`
Expected: FAIL，报错类似 `loadState is not a function`

- [ ] **Step 4: 实现**

在 `src/composables/useFlexState.ts` 里 `resetState` 函数**上方**加：

```ts
/**
 * 下一个可用的自增序号：取现有 id 的数字后缀最大值。
 *
 * 不能图省事用 `state.items.length`——载入进来的状态未必是 item-1..item-N 连续编号，
 * 一旦中间有跳号（[item-1, item-3]），长度算出来是 2，下一个 addItem 就生成 item-3 直接撞上。
 * resetState 那边入参恒定是 createDefaultState()，不存在这个问题，所以保持原样不动。
 */
function maxSequence(items: FlexItemState[]): number {
  return items.reduce((max, item) => {
    const suffix = Number(item.id.replace(/^item-/, ''))
    return Number.isFinite(suffix) ? Math.max(max, suffix) : max
  }, 0)
}
```

然后在 `resetState` **下方**加：

```ts
/**
 * 整体替换布局状态。陷阱区的「载入 Playground 复现」用它。
 *
 * 不走地址栏：本模块只在加载那一刻读一次 `location.search`，之后没有任何人监听它，
 * 光写 URL 是不会生效的。改 state 反而够了——`useShareUrl` 一直 watch 着，
 * 300ms 后地址栏自己就跟上了。
 *
 * 深拷贝一次再赋值：入参多半是 `resolveVariant()` 每次新造的对象，但调用方
 * 万一传了个会复用的引用进来，单例就会跟外面那份悄悄共享 items。
 */
function loadState(next: FlexState): void {
  Object.assign(state, structuredClone(next))
  // 从载入的 id 里推下一个序号，不能用 length —— 见 maxSequence 的注释
  sequence = maxSequence(state.items)
}
```

然后把它加进返回值：

```ts
export function useFlexState() {
  return { state, selectedItem, derived, css, selectItem, addItem, removeItem, resetState, loadState }
}
```

- [ ] **Step 5: 运行测试确认全绿**

Run: `pnpm vitest run src/composables/useFlexState.spec.ts`
Expected: PASS

- [ ] **Step 6: 跑全量测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 7: 提交**

走 `/commit` skill，建议提交信息：

```
feat(playground): 状态源支持整体载入一份布局

陷阱区的一键复现要用。不走地址栏是因为状态源只在模块加载那一刻读一次
location.search，之后没人监听它，光写 URL 不会生效；改 state 反倒够了,
useShareUrl 一直 watch 着，地址栏会自己跟上。
```

---

## Task 4: 陷阱演示区 TrapStage

**Files:**
- Create: `src/components/traps/TrapStage.vue`
- Test: `src/components/traps/TrapStage.spec.ts`

**Interfaces:**
- Consumes: `FlexState` / `FlexItemState` from `src/core/types.ts`；`isRowDirection` from `src/core/axis.ts`；`itemLabel` from `src/core/labels.ts`
- Produces: 组件 `TrapStage`，props `{ state: FlexState }`。根元素带 `data-testid="trap-stage"`，每个盒子带 `data-testid="trap-stage-item"` 与 `:data-item-id`

**背景**：这是 `DemoStage` 的精简版——**不挂观测层、不挂 Flip、不画叠加层、没有 resize 手柄**，因为那三者都是单例语义，多开实例会互相覆盖。视觉上也刻意区别于 Playground：用扁平方块，不做等距实体块（后者的顶面会画到容器外，在小演示里更碍眼，而且陷阱区的主角是「现象」不是质感）。

- [ ] **Step 1: 写失败的测试 `src/components/traps/TrapStage.spec.ts`**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createDefaultState } from '~/core/defaults'
import TrapStage from './TrapStage.vue'

describe('trapStage', () => {
  it('按状态里的盒子数量渲染', () => {
    const state = createDefaultState()

    const wrapper = mount(TrapStage, { props: { state } })

    expect(wrapper.findAll('[data-testid="trap-stage-item"]')).toHaveLength(3)
  })

  it('容器样式来自状态，不做任何位置计算', () => {
    const state = createDefaultState()
    state.container.direction = 'column'
    state.container.justifyContent = 'space-between'
    state.container.width = 480

    const wrapper = mount(TrapStage, { props: { state } })
    const style = wrapper.get('[data-testid="trap-stage"]').attributes('style')

    expect(style).toContain('flex-direction: column')
    expect(style).toContain('justify-content: space-between')
    expect(style).toContain('width: 480px')
  })

  it('盒子样式带上 flex 三件套与 order', () => {
    const state = createDefaultState()
    state.items[0].grow = 2
    state.items[0].shrink = 0
    state.items[0].basis = '120px'
    state.items[0].order = 3

    const wrapper = mount(TrapStage, { props: { state } })
    const style = wrapper.findAll('[data-testid="trap-stage-item"]')[0].attributes('style')

    expect(style).toContain('flex-grow: 2')
    expect(style).toContain('flex-shrink: 0')
    expect(style).toContain('flex-basis: 120px')
    expect(style).toContain('order: 3')
  })

  it('关掉自动最小尺寸时，写的是主轴方向上的那一个', () => {
    const state = createDefaultState()
    state.items[0].minWidthAuto = false

    const row = mount(TrapStage, { props: { state } })
    expect(row.findAll('[data-testid="trap-stage-item"]')[0].attributes('style')).toContain('min-width: 0px')

    state.container.direction = 'column'
    const column = mount(TrapStage, { props: { state } })
    expect(column.findAll('[data-testid="trap-stage-item"]')[0].attributes('style')).toContain('min-height: 0px')
  })

  it('开着 margin: auto 的盒子写上 margin', () => {
    const state = createDefaultState()
    state.items[1].marginAuto = true

    const wrapper = mount(TrapStage, { props: { state } })

    expect(wrapper.findAll('[data-testid="trap-stage-item"]')[1].attributes('style')).toContain('margin: auto')
    expect(wrapper.findAll('[data-testid="trap-stage-item"]')[0].attributes('style')).not.toContain('margin: auto')
  })

  it('内容占位块撑出主轴方向上的内容尺寸', () => {
    const state = createDefaultState()
    state.items[0].size = 320

    const wrapper = mount(TrapStage, { props: { state } })

    expect(wrapper.findAll('.trap-content')[0].attributes('style')).toContain('width: 320px')
  })

  it('盒子标签与 Playground 用同一套命名', () => {
    const wrapper = mount(TrapStage, { props: { state: createDefaultState() } })

    expect(wrapper.findAll('[data-testid="trap-stage-item"]').map(item => item.text())).toEqual(['A', 'B', 'C'])
  })

  it('props 变化时跟着重新渲染', async () => {
    const wrapper = mount(TrapStage, { props: { state: createDefaultState() } })
    const next = createDefaultState()
    next.container.justifyContent = 'center'

    await wrapper.setProps({ state: next })

    expect(wrapper.get('[data-testid="trap-stage"]').attributes('style')).toContain('justify-content: center')
  })
})
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `pnpm vitest run src/components/traps/TrapStage.spec.ts`
Expected: FAIL，报错类似 `Failed to resolve import "./TrapStage.vue"`

- [ ] **Step 3: 写实现 `src/components/traps/TrapStage.vue`**

```vue
<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { FlexItemState, FlexState } from '~/core/types'
import { computed } from 'vue'
import { isRowDirection } from '~/core/axis'
import { itemLabel } from '~/core/labels'

/**
 * 陷阱专用的精简演示区。
 *
 * 与 DemoStage 的分工：那边是全站唯一的真实布局来源，挂着观测层、Flip 与叠加层，
 * 三者都是单例语义，多开实例必然互相覆盖。这边只管把一份给定的状态排出来给人看，
 * 所以一个都不挂——陷阱区要的是「现象」，不是可被测量的实况。
 *
 * 红线 1 照旧成立：容器样式全部来自状态，位置一律交给浏览器真实排版。
 */
const props = defineProps<{ state: FlexState }>()

const isRow = computed(() => isRowDirection(props.state.container.direction))

const containerStyle = computed<CSSProperties>(() => ({
  display: props.state.container.display,
  flexDirection: props.state.container.direction,
  flexWrap: props.state.container.wrap,
  justifyContent: props.state.container.justifyContent,
  alignItems: props.state.container.alignItems,
  alignContent: props.state.container.alignContent,
  rowGap: `${props.state.container.rowGap}px`,
  columnGap: `${props.state.container.columnGap}px`,
  width: `${props.state.container.width}px`,
  height: `${props.state.container.height}px`,
}))

function itemStyle(item: FlexItemState): CSSProperties {
  return {
    flexGrow: item.grow,
    flexShrink: item.shrink,
    flexBasis: item.basis,
    order: item.order,
    alignSelf: item.alignSelf,
    // 关掉自动最小尺寸时，要关的是主轴方向上的那一个
    ...(item.minWidthAuto ? {} : { [isRow.value ? 'minWidth' : 'minHeight']: '0px' }),
    ...(item.marginAuto ? { margin: 'auto' } : {}),
  }
}

// 内容占位块撑出 min-content 尺寸，这样 min-width:auto 的下限才有真实来源
function contentStyle(item: FlexItemState): CSSProperties {
  return isRow.value ? { width: `${item.size}px` } : { height: `${item.size}px` }
}
</script>

<template>
  <!-- 溢出是陷阱一与陷阱三要给人看的现象，所以外层滚动、内层绝不裁剪 -->
  <div class="max-w-full overflow-auto">
    <div
      data-testid="trap-stage"
      class="trap-stage rounded-3"
      :style="containerStyle"
    >
      <div
        v-for="(item, index) in props.state.items"
        :key="item.id"
        data-testid="trap-stage-item"
        :data-item-id="item.id"
        class="trap-stage-item"
        :style="itemStyle(item)"
      >
        <div class="trap-content" :style="contentStyle(item)">
          {{ itemLabel(index) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * 描边一律用 outline，绝不用 border，也不加 padding——两者都占布局空间，
 * 会让盒子的实际尺寸比推导值多出一圈，陷阱里那些精确到个位数的数字就对不上了（红线 6）。
 */
.trap-stage {
  flex-shrink: 0;
  background: color-mix(in srgb, var(--accent) 4%, var(--panel));
  outline: 1px solid color-mix(in srgb, var(--border) 90%, var(--accent));
  outline-offset: -1px;
}

.trap-stage-item {
  display: flex;

  /*
   * 绝不能加 overflow: hidden。自动最小尺寸只在主轴 overflow 为 visible 时生效，
   * 一旦裁剪 min-width:auto 立刻失效，陷阱一就演不出来了（红线 7）。
   * 盒子被压得比内容还窄时，内容溢出正是要给人看的现象。
   */
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  outline: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: -1px;

  /*
   * 扁平方块，不做 Playground 那套等距实体块：
   * 立体块的顶面会画到容器外，在陷阱区这种小尺寸演示里更碍眼，
   * 而这里的主角是「现象」不是质感。
   */
  background: color-mix(in srgb, var(--accent) 30%, var(--panel));

  /* 状态在拍与拍之间离散切换，这道过渡就是「修复」那一下的全部动效 */
  transition:
    width 0.28s ease,
    height 0.28s ease,
    flex-basis 0.28s ease;
}

.trap-content {
  display: flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--fg) 88%, transparent);
  font-family: var(--font-mono, monospace);
  font-size: 13px;
}

@media (prefers-reduced-motion: reduce) {
  .trap-stage-item {
    transition: none;
  }
}
</style>
```

- [ ] **Step 4: 运行测试确认全绿**

Run: `pnpm vitest run src/components/traps/TrapStage.spec.ts`
Expected: PASS，8 个测试全过

- [ ] **Step 5: 跑全量测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 6: 提交**

走 `/commit` skill，建议提交信息：

```
feat(traps): 新增陷阱专用的精简演示区

不挂观测层、Flip 与叠加层——那三者都是单例语义，跟着 DemoStage 走，
多开实例必然互相覆盖。视觉也刻意用扁平方块而非等距实体块：
后者的顶面会画到容器外，小尺寸演示里更碍眼。
```

---

## Task 5: 归因拍的属性差异表 TrapDiff

**Files:**
- Create: `src/components/traps/TrapDiff.vue`
- Test: `src/components/traps/TrapDiff.spec.ts`

**Interfaces:**
- Consumes: `PropertyDiff` from `src/core/types.ts`；`itemLabel` from `src/core/labels.ts`
- Produces: 组件 `TrapDiff`，props `{ diffs: PropertyDiff[] }`。每行带 `data-testid="trap-diff-row"`

**背景**：`diffStates` 输出的是原始字段名与 String 化的值（`minWidthAuto: 'true' → 'false'`），用户认的是 CSS 属性名和它的实际取值（`min-width: auto → 0`）。这一层翻译属于展示层，core 不碰文案。

- [ ] **Step 1: 写失败的测试 `src/components/traps/TrapDiff.spec.ts`**

```ts
import type { PropertyDiff } from '~/core/types'
import { CONTAINER_KEYS, ITEM_KEYS } from '~/core/trapPatch'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrapDiff from './TrapDiff.vue'

function rows(diffs: PropertyDiff[]): string[] {
  return mount(TrapDiff, { props: { diffs } })
    .findAll('[data-testid="trap-diff-row"]')
    .map(row => row.text().replace(/\s+/g, ' ').trim())
}

describe('trapDiff', () => {
  it('每条差异一行', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'container', key: 'wrap', from: 'nowrap', to: 'wrap' },
      { scope: 'item', itemIndex: 0, key: 'grow', from: '0', to: '1' },
    ]

    expect(rows(diffs)).toHaveLength(2)
  })

  it('字段名翻译成 CSS 属性名', () => {
    const diffs: PropertyDiff[] = [{ scope: 'container', key: 'wrap', from: 'nowrap', to: 'wrap' }]

    expect(rows(diffs)[0]).toContain('flex-wrap')
  })

  it('minWidthAuto 的布尔值翻译成 auto 与 0', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'item', itemIndex: 0, key: 'minWidthAuto', from: 'true', to: 'false' },
    ]

    const row = rows(diffs)[0]
    expect(row).toContain('min-width')
    expect(row).toContain('auto')
    expect(row).toContain('0')
    expect(row).not.toContain('true')
  })

  it('marginAuto 的布尔值同样翻译成 auto 与 0', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'item', itemIndex: 0, key: 'marginAuto', from: 'true', to: 'false' },
    ]

    expect(rows(diffs)[0]).not.toContain('true')
    expect(rows(diffs)[0]).toContain('margin')
  })

  it('像素类字段带上单位', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'container', key: 'width', from: '720', to: '480' },
    ]

    expect(rows(diffs)[0]).toContain('720px')
    expect(rows(diffs)[0]).toContain('480px')
  })

  it('item 差异标出盒子标签，与演示区叫同一个名字', () => {
    const diffs: PropertyDiff[] = [
      { scope: 'item', itemIndex: 1, key: 'grow', from: '0', to: '1' },
    ]

    expect(rows(diffs)[0]).toContain('B')
  })

  it('容器差异标为容器而不是某个盒子', () => {
    const diffs: PropertyDiff[] = [{ scope: 'container', key: 'wrap', from: 'nowrap', to: 'wrap' }]

    expect(rows(diffs)[0]).toContain('容器')
  })

  it('没有差异时不渲染任何行', () => {
    expect(rows([])).toHaveLength(0)
  })

  it('推导层可能产出的每个字段都有对应的中文/CSS 译名', () => {
    // 类型绑定挡得住「漏写一条」，挡不住「译成了空串或原样返回字段名」，所以这条还得跑一遍
    const keys = [...CONTAINER_KEYS, ...ITEM_KEYS]
    // display/direction/wrap/grow/shrink/basis/order 的译名包含字段名本身（如 flex-grow 包含 grow）
    // 这些情况下 not.toContain 会误报，需要排除
    const keysWithoutIdentityLabels = keys.filter(
      k => !['display', 'direction', 'wrap', 'grow', 'shrink', 'basis', 'order'].includes(k),
    )

    for (const key of keysWithoutIdentityLabels) {
      const diff: PropertyDiff = { scope: 'container', key: key as any, from: 'a', to: 'b' }
      const label = mount(TrapDiff, { props: { diffs: [diff] } })
        .get('[data-testid="trap-diff-row"]')
        .text()

      expect(label, `${key} 没有译名`).not.toContain(key)
    }
  })
})
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `pnpm vitest run src/components/traps/TrapDiff.spec.ts`
Expected: FAIL，报错类似 `Failed to resolve import "./TrapDiff.vue"`

- [ ] **Step 3: 写实现 `src/components/traps/TrapDiff.vue`**

```vue
<script setup lang="ts">
import type { PropertyDiff } from '~/core/types'
import type { CONTAINER_KEYS, ITEM_KEYS } from '~/core/trapPatch'
import { itemLabel } from '~/core/labels'

/**
 * 归因拍的属性差异表：把「到底改了哪一行」摆出来。
 *
 * 数据来自 `diffStates()` 两份完整状态相减，不是手写的——
 * 手写的文案会跟实际渲染悄悄脱节，而这张表恰恰是用来取信于人的。
 */
defineProps<{ diffs: PropertyDiff[] }>()

/**
 * 差异表可能遇到的全部字段名。直接从推导层那两份清单派生——
 * 将来给容器或盒子加字段时，这里漏一条会**编译报错**，
 * 而不是等到界面上露出 `alignSelf` 这种内部字段名才被发现。
 */
type DiffKey = typeof CONTAINER_KEYS[number] | typeof ITEM_KEYS[number]

/** 内部字段名 → 用户认得的 CSS 属性名 */
const KEY_LABELS: Record<DiffKey, string> = {
  display: 'display',
  direction: 'flex-direction',
  wrap: 'flex-wrap',
  justifyContent: 'justify-content',
  alignItems: 'align-items',
  alignContent: 'align-content',
  rowGap: 'row-gap',
  columnGap: 'column-gap',
  width: '容器宽度',
  height: '容器高度',
  grow: 'flex-grow',
  shrink: 'flex-shrink',
  basis: 'flex-basis',
  order: 'order',
  alignSelf: 'align-self',
  size: '内容尺寸',
  minWidthAuto: 'min-width',
  marginAuto: 'margin',
}

/** 带像素单位的字段。只关心展示，不参与任何计算 */
const PX_KEYS = new Set(['width', 'height', 'rowGap', 'columnGap', 'size'])

function keyLabel(key: string): string {
  return KEY_LABELS[key as DiffKey] ?? key
}

/**
 * 值翻译成人话。
 * `minWidthAuto` / `marginAuto` 在状态里是布尔，但用户看到的 CSS 是 `auto` 与 `0`——
 * 直接把 true/false 摆出来，这张表就白做了。
 */
function valueLabel(key: string, raw: string): string {
  if (key === 'minWidthAuto' || key === 'marginAuto')
    return raw === 'true' ? 'auto' : '0'
  if (PX_KEYS.has(key))
    return `${raw}px`
  return raw
}

function scopeLabel(diff: PropertyDiff): string {
  return diff.scope === 'container' ? '容器' : `盒子 ${itemLabel(diff.itemIndex ?? 0)}`
}
</script>

<template>
  <ul class="flex flex-col gap-1 text-xs font-mono">
    <li
      v-for="diff in diffs"
      :key="`${diff.scope}-${diff.itemIndex ?? ''}-${diff.key}`"
      data-testid="trap-diff-row"
      class="flex flex-wrap items-center gap-2 rounded-2 bg-panel px-2 py-1"
    >
      <span class="op-60">{{ scopeLabel(diff) }}</span>
      <span class="font-bold">{{ keyLabel(diff.key) }}</span>
      <span class="op-60 line-through">{{ valueLabel(diff.key, diff.from) }}</span>
      <span class="op-40">→</span>
      <span class="text-accent font-bold">{{ valueLabel(diff.key, diff.to) }}</span>
    </li>
  </ul>
</template>
```

- [ ] **Step 4: 运行测试确认全绿**

Run: `pnpm vitest run src/components/traps/TrapDiff.spec.ts`
Expected: PASS，8 个测试全过

- [ ] **Step 5: 跑全量测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 6: 提交**

走 `/commit` skill，建议提交信息：

```
feat(traps): 新增归因拍的属性差异表

表里的内容由两份完整状态相减算出，不是手写——手写的文案会跟实际渲染
悄悄脱节，而这张表恰恰是用来取信于人的。布尔字段翻译成用户认得的
CSS 取值（min-width: auto / 0），这层翻译属于展示层，core 不碰文案。
```

---

## Task 6: 滚动驱动 useTrapScroll

**Files:**
- Create: `src/composables/useTrapScroll.ts`
- Test: `src/composables/useTrapScroll.spec.ts`

**Interfaces:**
- Consumes: `gsap` 与 `gsap/ScrollTrigger`（已是项目依赖，版本 `^3.15.0`）
- Produces:
  - `BEAT_COUNT = 3`
  - `beatFromProgress(progress: number, current: number): number`（纯函数，导出供测试）
  - `prefersReducedMotion(): boolean`
  - `shouldDegrade(): boolean`
  - `useTrapScroll(el: Ref<HTMLElement | undefined>): { beat: Ref<number>, degraded: Ref<boolean> }`

**背景**：三拍之间是离散的 CSS 属性变化（`min-width: auto` → `0` 没有中间态），所以 scrub 的连续插值在这里无处可用——只把滚动进度映射成拍号。**滞回必不可少**：不加的话，手指停在 1/3 边界附近轻轻一抖，拍号就会疯狂跳。

- [ ] **Step 1: 写失败的测试 `src/composables/useTrapScroll.spec.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { beatFromProgress, BEAT_COUNT, prefersReducedMotion, shouldDegrade } from './useTrapScroll'

describe('beatFromProgress', () => {
  it('三拍平分整段进度', () => {
    expect(BEAT_COUNT).toBe(3)
    expect(beatFromProgress(0, 0)).toBe(0)
    expect(beatFromProgress(0.5, 1)).toBe(1)
    expect(beatFromProgress(0.9, 2)).toBe(2)
  })

  it('进度跑满时停在最后一拍，不越界', () => {
    expect(beatFromProgress(1, 2)).toBe(2)
    expect(beatFromProgress(1.2, 2)).toBe(2)
  })

  it('进度为负时停在第一拍', () => {
    expect(beatFromProgress(-0.3, 0)).toBe(0)
  })

  it('刚过边界一点点不换拍——滞回把抖动挡在外面', () => {
    // 边界在 1/3 ≈ 0.3333，滞回带宽 0.04，所以 0.34 还不够
    expect(beatFromProgress(0.34, 0)).toBe(0)
  })

  it('越过滞回带才换拍', () => {
    expect(beatFromProgress(0.40, 0)).toBe(1)
  })

  it('往回滚同样要越过滞回带才退拍', () => {
    expect(beatFromProgress(0.32, 1)).toBe(1)
    expect(beatFromProgress(0.28, 1)).toBe(0)
  })

  it('第二道边界上的滞回与第一道一致', () => {
    expect(beatFromProgress(0.68, 1)).toBe(1)
    expect(beatFromProgress(0.72, 1)).toBe(2)
    expect(beatFromProgress(0.65, 2)).toBe(2)
    expect(beatFromProgress(0.62, 2)).toBe(1)
  })

  it('一步跨过多拍时直接落到目标拍，不用逐拍挪', () => {
    expect(beatFromProgress(0.95, 0)).toBe(2)
  })
})

describe('降级判断', () => {
  function stubMatchMedia(matcher: (query: string) => boolean): void {
    vi.stubGlobal('window', {
      ...globalThis.window,
      matchMedia: (query: string) => ({ matches: matcher(query) }),
    })
  }

  it('系统开着「减少动态效果」时降级', () => {
    stubMatchMedia(query => query.includes('prefers-reduced-motion'))

    expect(prefersReducedMotion()).toBe(true)
    expect(shouldDegrade()).toBe(true)

    vi.unstubAllGlobals()
  })

  it('窄屏时降级——pin 在移动端会被地址栏伸缩带着抖', () => {
    stubMatchMedia(query => query.includes('max-width'))

    expect(prefersReducedMotion()).toBe(false)
    expect(shouldDegrade()).toBe(true)

    vi.unstubAllGlobals()
  })

  it('宽屏且未开减少动效时不降级', () => {
    stubMatchMedia(() => false)

    expect(shouldDegrade()).toBe(false)

    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `pnpm vitest run src/composables/useTrapScroll.spec.ts`
Expected: FAIL，报错类似 `Failed to resolve import "./useTrapScroll"`

- [ ] **Step 3: 写实现 `src/composables/useTrapScroll.ts`**

```ts
import type { Ref } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { onMounted, onUnmounted, ref } from 'vue'

gsap.registerPlugin(ScrollTrigger)

/** 现象 / 归因 / 修复 */
export const BEAT_COUNT = 3

/** 每个陷阱 pin 住的滚动距离，200% 即约三屏 */
const PIN_DISTANCE = '+=200%'

/** 降级的视口宽度上限（px）。窄屏不做 pin */
const MOBILE_MAX_WIDTH = 767

/**
 * 拍与拍之间的滞回带宽。
 *
 * 不加这个的话，手指停在 1/3 边界附近轻轻一抖，拍号就会在两拍之间疯狂跳——
 * 演示区跟着来回换状态，看着像坏了。只有确实越过「边界 ± 这个值」才换拍。
 */
const HYSTERESIS = 0.04

/**
 * 滚动进度 → 拍号，带滞回。
 *
 * 三拍之间是离散的属性变化（`min-width: auto` → `0` 根本没有中间态），
 * 所以这里只做映射，不做任何连续插值。
 */
export function beatFromProgress(progress: number, current: number): number {
  const clamped = Math.min(Math.max(progress, 0), 1)
  const raw = Math.min(BEAT_COUNT - 1, Math.floor(clamped * BEAT_COUNT))
  if (raw === current)
    return current

  // 往前翻看的是目标拍的下边界，往回退看的是当前拍的下边界
  const boundary = raw > current ? raw / BEAT_COUNT : (raw + 1) / BEAT_COUNT
  const crossed = raw > current
    ? clamped >= boundary + HYSTERESIS
    : clamped <= boundary - HYSTERESIS

  return crossed ? raw : current
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 是否走降级形态。两个条件任一命中即降级，**只维护这一套降级**：
 * - 系统开着「减少动态效果」
 * - 窄屏（iOS Safari 的地址栏伸缩会让 pin 的 vh 抖，是经典坑）
 */
export function shouldDegrade(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return true
  return prefersReducedMotion() || window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches
}

/**
 * 把一个陷阱板块 pin 在视口里，用滚动距离推进三拍。
 *
 * 降级时一个 ScrollTrigger 都不建，拍号停在 0，由调用方改渲染成三拍全展开的静态堆叠。
 */
export function useTrapScroll(el: Ref<HTMLElement | undefined>): {
  beat: Ref<number>
  degraded: Ref<boolean>
} {
  const beat = ref(0)
  // 先按降级算：服务端与测试环境没有 window，挂载后才有资格判断
  const degraded = ref(true)
  let trigger: ScrollTrigger | undefined

  onMounted(() => {
    degraded.value = shouldDegrade()
    if (degraded.value || !el.value)
      return

    trigger = ScrollTrigger.create({
      trigger: el.value,
      start: 'top top',
      end: PIN_DISTANCE,
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        beat.value = beatFromProgress(self.progress, beat.value)
      },
    })
  })

  onUnmounted(() => {
    trigger?.kill()
    trigger = undefined
  })

  return { beat, degraded }
}
```

- [ ] **Step 4: 运行测试确认全绿**

Run: `pnpm vitest run src/composables/useTrapScroll.spec.ts`
Expected: PASS，11 个测试全过

- [ ] **Step 5: 跑全量测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 6: 提交**

走 `/commit` skill，建议提交信息：

```
feat(traps): 新增三拍叙事的滚动驱动

scrub 只用来读进度，不做连续插值——三拍之间是离散的属性变化，
min-width: auto 到 0 根本没有中间态。进度映射到拍号时必须带滞回，
否则手指停在边界附近轻轻一抖，拍号就会在两拍之间疯狂跳。
窄屏与 reduced-motion 共用同一套降级：一个 ScrollTrigger 都不建。
```

---

## Task 7: 单个陷阱板块 TrapSection

**Files:**
- Create: `src/components/traps/TrapSection.vue`
- Test: `src/components/traps/TrapSection.spec.ts`

**Interfaces:**
- Consumes: `Trap` from `src/core/types.ts`；`resolveVariant` / `diffStates` from `src/core/trapPatch.ts`；`useTrapScroll` / `prefersReducedMotion` from `src/composables/useTrapScroll.ts`；`useFlexState` from `src/composables/useFlexState.ts`；组件 `TrapStage` / `TrapDiff`
- Produces: 组件 `TrapSection`，props `{ trap: Trap }`。测试锚点：`data-testid="trap-section"` / `"trap-beat"` / `"trap-load-before"` / `"trap-load-after"`

**背景（三条都别改反）**：

1. **第 2 拍演示区必须不动**（仍渲染 `before`）。归因是在解释眼前这个现象，一边解释一边把现象换掉就讲不通了。
2. `TrapDiff` 放进第 2 拍那张卡片**内部**，跟着卡片一起淡入淡出，不单独控制可见性。
3. 一键复现**不写地址栏**，直接 `loadState`——原因见 Task 3。

- [ ] **Step 1: 写失败的测试 `src/components/traps/TrapSection.spec.ts`**

```ts
import type { Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as trapScroll from '~/composables/useTrapScroll'
import { useFlexState } from '~/composables/useFlexState'
import { traps } from '~/data/traps'
import TrapSection from './TrapSection.vue'

/*
 * 整个 useTrapScroll 换成假的，不走 importOriginal——
 * 真模块会连带加载 gsap/ScrollTrigger，happy-dom 里没有排版引擎，白白冒险。
 * 它自己的逻辑已经在 useTrapScroll.spec.ts 里单独测过了。
 *
 * ref 在 mock 工厂内部创建、再顺手多导出两个下划线开头的口子给测试用。
 * 不在工厂外面建：vi.mock 会被提升到所有 import 之前，那时外层变量还没初始化。
 */
vi.mock('~/composables/useTrapScroll', async () => {
  const vue = await import('vue')
  const beat = vue.ref(0)
  const degraded = vue.ref(false)

  return {
    BEAT_COUNT: 3,
    useTrapScroll: () => ({ beat, degraded }),
    prefersReducedMotion: () => false,
    shouldDegrade: () => false,
    beatFromProgress: (progress: number) => progress,
    __beat: beat,
    __degraded: degraded,
  }
})

// 拿到 mock 内部那两个 ref，好在 mount 之后推进拍号
const { __beat: beatRef, __degraded: degradedRef } = trapScroll as unknown as {
  __beat: Ref<number>
  __degraded: Ref<boolean>
}

const trap = traps.find(item => item.id === 'min-width-auto')!

function mountSection() {
  return mount(TrapSection, { props: { trap } })
}

describe('trapSection', () => {
  beforeEach(() => {
    beatRef.value = 0
    degradedRef.value = false
    useFlexState().resetState()
    vi.restoreAllMocks()
  })

  it('渲染陷阱标题与钩子', () => {
    const text = mountSection().text()

    expect(text).toContain(trap.title)
    expect(text).toContain(trap.hook)
  })

  it('三拍的文案都在 DOM 里，靠 class 标出当前拍', () => {
    const wrapper = mountSection()
    const beats = wrapper.findAll('[data-testid="trap-beat"]')

    expect(beats).toHaveLength(3)
    expect(beats[0].classes()).toContain('is-active')
    expect(beats[1].classes()).not.toContain('is-active')
  })

  it('拍号变化时当前拍跟着换', async () => {
    const wrapper = mountSection()

    beatRef.value = 1
    await wrapper.vm.$nextTick()

    const beats = wrapper.findAll('[data-testid="trap-beat"]')
    expect(beats[0].classes()).not.toContain('is-active')
    expect(beats[1].classes()).toContain('is-active')
  })

  it('前两拍演示区停在现象态——归因不能把正在解释的现象换掉', async () => {
    const wrapper = mountSection()
    const atFirstBeat = firstItemStyle(wrapper)

    beatRef.value = 1
    await wrapper.vm.$nextTick()

    expect(firstItemStyle(wrapper)).toBe(atFirstBeat)
    // 现象态的自动最小尺寸是开着的，不该出现修复态才有的那行
    expect(firstItemStyle(wrapper)).not.toContain('min-width: 0px')
  })

  it('第三拍演示区切到修复态', async () => {
    const wrapper = mountSection()

    beatRef.value = 2
    await wrapper.vm.$nextTick()

    // 陷阱一的修复态关掉了自动最小尺寸，盒子样式上会多出 min-width: 0px
    const first = wrapper.findAll('[data-testid="trap-stage-item"]')[0]
    expect(first.attributes('style')).toContain('min-width: 0px')
  })

  it('差异表只出现在归因那一拍的卡片里', () => {
    const wrapper = mountSection()
    const beats = wrapper.findAll('[data-testid="trap-beat"]')

    expect(beats[1].find('[data-testid="trap-diff-row"]').exists()).toBe(true)
    expect(beats[0].find('[data-testid="trap-diff-row"]').exists()).toBe(false)
    expect(beats[2].find('[data-testid="trap-diff-row"]').exists()).toBe(false)
  })

  it('载入现象按钮把现象态写进全局状态', async () => {
    const scrollIntoView = vi.fn()
    vi.spyOn(document, 'getElementById').mockReturnValue({ scrollIntoView } as unknown as HTMLElement)
    const { state } = useFlexState()

    await mountSection().get('[data-testid="trap-load-before"]').trigger('click')

    expect(state.container.width).toBe(480)
    expect(state.items[0].minWidthAuto).toBe(true)
    expect(state.items[0].size).toBe(320)
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('载入修复按钮把修复态写进全局状态', async () => {
    vi.spyOn(document, 'getElementById').mockReturnValue({ scrollIntoView: vi.fn() } as unknown as HTMLElement)
    const { state } = useFlexState()

    await mountSection().get('[data-testid="trap-load-after"]').trigger('click')

    expect(state.items[0].minWidthAuto).toBe(false)
  })

  it('Playground 不在页面上时照样载入状态，只是不滚动', async () => {
    vi.spyOn(document, 'getElementById').mockReturnValue(null)
    const { state } = useFlexState()

    await mountSection().get('[data-testid="trap-load-before"]').trigger('click')

    // 滚不过去不该连累载入——没抛错，状态也确实换了
    expect(state.container.width).toBe(480)
  })

  it('降级形态下三拍各配一个演示区，全部展开', async () => {
    degradedRef.value = true
    const wrapper = mountSection()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid="trap-stage"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="trap-beat"]')).toHaveLength(3)
  })

  it('正常形态下只有一个演示区', () => {
    expect(mountSection().findAll('[data-testid="trap-stage"]')).toHaveLength(1)
  })
})

/** 取第一个盒子的行内样式，用来判断演示区当前渲染的是哪一态 */
function firstItemStyle(wrapper: ReturnType<typeof mountSection>): string | undefined {
  return wrapper.findAll('[data-testid="trap-stage-item"]')[0].attributes('style')
}
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `pnpm vitest run src/components/traps/TrapSection.spec.ts`
Expected: FAIL，报错类似 `Failed to resolve import "./TrapSection.vue"`

- [ ] **Step 3: 写实现 `src/components/traps/TrapSection.vue`**

```vue
<script setup lang="ts">
import type { FlexState, Trap } from '~/core/types'
import Prism from 'prismjs'
import { computed, ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { prefersReducedMotion, useTrapScroll } from '~/composables/useTrapScroll'
import { diffStates, resolveVariant } from '~/core/trapPatch'
import TrapDiff from './TrapDiff.vue'
import TrapStage from './TrapStage.vue'

const props = defineProps<{ trap: Trap }>()

const sectionEl = ref<HTMLElement>()
const { beat, degraded } = useTrapScroll(sectionEl)
const { loadState } = useFlexState()

const beforeState = computed(() => resolveVariant(props.trap, 'before'))
const afterState = computed(() => resolveVariant(props.trap, 'after'))
const diffs = computed(() => diffStates(beforeState.value, afterState.value))

/**
 * 前两拍一律停在现象态。
 * 归因是在解释眼前这个现象，一边解释一边把现象换掉，话就说不通了。
 */
const stageState = computed(() => (beat.value < 2 ? beforeState.value : afterState.value))

/** 降级时每一拍各配一个演示区：前两拍现象、最后一拍修复 */
function stateForBeat(index: number): FlexState {
  return index < 2 ? beforeState.value : afterState.value
}

function highlight(code: string): string {
  return Prism.highlight(code, Prism.languages.css, 'css')
}

/**
 * 载入 Playground 复现。
 *
 * 直接改全局状态，不写地址栏——状态源只在模块加载那一刻读一次 location.search，
 * 之后没人监听它。地址栏会由 useShareUrl 在 300ms 后自动跟上。
 */
function reproduce(which: 'before' | 'after'): void {
  loadState(which === 'before' ? beforeState.value : afterState.value)
  document.getElementById('playground')?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  })
}
</script>

<template>
  <section
    ref="sectionEl"
    data-testid="trap-section"
    class="trap-section w-full"
    :class="degraded ? 'py-12' : 'h-screen flex items-center'"
  >
    <div class="mx-auto max-w-360 w-full flex flex-col gap-6 p-4">
      <header class="flex flex-col gap-1">
        <h2 class="text-xl font-bold">
          {{ trap.title }}
        </h2>
        <p class="text-sm op-70">
          {{ trap.hook }}
        </p>
      </header>

      <!-- 正常形态：一个演示区随拍切状态，三张卡片叠在同一格里淡入淡出 -->
      <div v-if="!degraded" class="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div class="panel p-3">
          <TrapStage :state="stageState" />
        </div>

        <div class="beats grid">
          <article
            v-for="(item, index) in trap.beats"
            :key="item.title"
            data-testid="trap-beat"
            class="beat panel flex flex-col gap-3 p-4"
            :class="{ 'is-active': beat === index }"
          >
            <h3 class="flex items-center gap-2 text-sm font-bold">
              <span class="text-accent font-mono">{{ index + 1 }}</span>
              {{ item.title }}
            </h3>
            <p class="text-sm leading-relaxed op-80">
              {{ item.body }}
            </p>
            <pre
              v-if="item.code"
              class="overflow-x-auto rounded-2 bg-panel p-2 text-xs leading-relaxed font-mono"
            ><code v-html="highlight(item.code)" /></pre>
            <TrapDiff v-if="index === 1" :diffs="diffs" />
          </article>
        </div>
      </div>

      <!-- 降级形态：三拍全展开，各配一个演示区。不 pin、不劫持滚动 -->
      <div v-else class="flex flex-col gap-8">
        <article
          v-for="(item, index) in trap.beats"
          :key="item.title"
          data-testid="trap-beat"
          class="beat is-active flex flex-col gap-3"
        >
          <h3 class="flex items-center gap-2 text-sm font-bold">
            <span class="text-accent font-mono">{{ index + 1 }}</span>
            {{ item.title }}
          </h3>
          <p class="text-sm leading-relaxed op-80">
            {{ item.body }}
          </p>
          <pre
            v-if="item.code"
            class="overflow-x-auto rounded-2 bg-panel p-2 text-xs leading-relaxed font-mono"
          ><code v-html="highlight(item.code)" /></pre>
          <TrapDiff v-if="index === 1" :diffs="diffs" />
          <div class="panel p-3">
            <TrapStage :state="stateForBeat(index)" />
          </div>
        </article>
      </div>

      <footer class="flex flex-wrap gap-2">
        <button data-testid="trap-load-before" class="btn text-xs" @click="reproduce('before')">
          载入现象到 Playground
        </button>
        <button data-testid="trap-load-after" class="btn text-xs" @click="reproduce('after')">
          载入修复到 Playground
        </button>
      </footer>
    </div>
  </section>
</template>

<style scoped>
/*
 * 三张卡片叠在同一个网格单元里：pin 住的是一屏，三拍轮流占据同一块地方，
 * 卡片才不会把这一屏撑爆。非当前拍要关掉指针事件，否则会挡住底下那张的按钮。
 */
.beats > .beat {
  grid-area: 1 / 1;
}

.beat {
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
  pointer-events: none;
}

.beat.is-active {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .beat {
    transition: none;
  }
}
</style>
```

- [ ] **Step 4: 运行测试确认全绿**

Run: `pnpm vitest run src/components/traps/TrapSection.spec.ts`
Expected: PASS，12 个测试全过

- [ ] **Step 5: 跑全量测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 6: 提交**

走 `/commit` skill，建议提交信息：

```
feat(traps): 新增单个陷阱板块的三拍叙事

前两拍演示区一律停在现象态——归因是在解释眼前这个现象，一边解释一边
把现象换掉，话就说不通了。三张卡片叠在同一个网格单元里轮流淡入，
pin 住的那一屏才不会被撑爆；非当前拍关掉指针事件，免得挡住按钮。
```

---

## Task 8: 陷阱区容器与页面接入

**Files:**
- Create: `src/components/traps/TrapsSection.vue`
- Modify: `src/App.vue`
- Test: `src/components/traps/TrapsSection.spec.ts`

**Interfaces:**
- Consumes: `traps` from `src/data/traps.ts`；组件 `TrapSection`
- Produces: 组件 `TrapsSection`（无 props）

- [ ] **Step 1: 写失败的测试 `src/components/traps/TrapsSection.spec.ts`**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { traps } from '~/data/traps'
import TrapsSection from './TrapsSection.vue'

// 同 TrapSection.spec.ts：不让 gsap/ScrollTrigger 进 happy-dom
vi.mock('~/composables/useTrapScroll', async () => {
  const vue = await import('vue')
  return {
    BEAT_COUNT: 3,
    useTrapScroll: () => ({ beat: vue.ref(0), degraded: vue.ref(true) }),
    prefersReducedMotion: () => true,
    shouldDegrade: () => true,
    beatFromProgress: (progress: number) => progress,
  }
})

describe('trapsSection', () => {
  it('五个陷阱各渲染一个板块', () => {
    const wrapper = mount(TrapsSection)

    expect(wrapper.findAll('[data-testid="trap-section"]')).toHaveLength(traps.length)
  })

  it('板块顺序与数据定义一致', () => {
    const wrapper = mount(TrapsSection)
    const titles = wrapper.findAll('[data-testid="trap-section"]').map(section => section.text())

    for (const [index, trap] of traps.entries())
      expect(titles[index]).toContain(trap.title)
  })

  it('区块带标题，让人知道下面是什么', () => {
    expect(mount(TrapsSection).text()).toContain('五个常见陷阱')
  })
})
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `pnpm vitest run src/components/traps/TrapsSection.spec.ts`
Expected: FAIL，报错类似 `Failed to resolve import "./TrapsSection.vue"`

- [ ] **Step 3: 写实现 `src/components/traps/TrapsSection.vue`**

```vue
<script setup lang="ts">
import { traps } from '~/data/traps'
import TrapSection from './TrapSection.vue'
</script>

<template>
  <div class="w-full">
    <header class="mx-auto max-w-360 w-full flex flex-col gap-1 p-4 pt-12">
      <h2 class="text-2xl font-bold">
        五个常见陷阱
      </h2>
      <p class="text-sm op-70">
        每个都是「现象 → 归因 → 修复」三拍，随滚动推进。看完可以一键载回上面的 Playground 自己调。
      </p>
    </header>

    <TrapSection v-for="trap in traps" :key="trap.id" :trap="trap" />
  </div>
</template>
```

- [ ] **Step 4: 运行测试确认全绿**

Run: `pnpm vitest run src/components/traps/TrapsSection.spec.ts`
Expected: PASS

- [ ] **Step 5: 接入 `src/App.vue`**

改两处：给 `ThePlayground` 加 `id`，其后挂上 `TrapsSection`。

`<script setup>` 里补 import：

```ts
import TrapsSection from '~/components/traps/TrapsSection.vue'
```

模板里把 `<ThePlayground />` 那一行换成：

```vue
    <!-- id 是陷阱区「载入 Playground 复现」的滚动锚点 -->
    <ThePlayground id="playground" />

    <TrapsSection />
```

- [ ] **Step 6: 跑全量测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 7: 类型检查与 lint**

Run: `pnpm tscheck`
Expected: 无输出（无类型错误）

Run: `pnpm lint:fix && pnpm lint`
Expected: 无错误

- [ ] **Step 8: 构建**

Run: `pnpm build`
Expected: 构建成功，产出 `dist`

- [ ] **Step 9: 提交**

走 `/commit` skill，建议提交信息：

```
feat(traps): 陷阱区接入页面

Playground 加上 id 作为「载入复现」的滚动锚点，陷阱区挂在它下面。
```

---

## Task 9: 真实浏览器核对

**Files:** 无代码改动（除非发现缺陷）

**背景**：happy-dom 没有排版引擎，**以下几条单元测试原理上抓不到**——M3 就有三个 bug 是这么暴露的（装饰性 border 参与布局导致全量误报、`overflow: hidden` 让 `min-width: auto` 完全失效、拖拽手柄的 `preventDefault()` 连带抑制焦点转移）。

**动手前先问用户是否需要浏览器验证**（项目约定：不要自行调用 claude-in-chrome）。

**环境坑（CLAUDE.md 里每一条都实际踩过，别再踩）：**

- 用 `http://127.0.0.1:<port>` 而不是 `localhost`——本机另一个项目占着 `[::1]:5175`。认一下页面标题是不是 `todo-flex`。
- 探活一律加 `--noproxy '*'`：本机有 HTTP 代理，`curl http://127.0.0.1:<port>` 会被拦成 502，看着像服务没起来。
- **先同步读一次 `document.visibilityState`**。窗口一旦不可见：rAF 停发、GSAP 与 CSS transition 冻在第一帧、页面完全不重绘（截图拿到的是旧画面）、`await` 一个 rAF 循环会永不 resolve 直接把 `Runtime.evaluate` 拖到超时。
- 量静态尺寸前先注入 `transition: none !important`，否则读到的是冻住的过渡中间值。
- 要刷新就把刷新和读数拆成两次调用——`await` 长 `setTimeout` 跨过 `location.reload()` 会报「Inspected target navigated or closed」。改了源码靠 Vite HMR 就够，多数时候不需要 reload。
- dev server 头一次用后台任务起有可能立刻被 SIGTERM（exit 143）带走，内存充足时直接重启一次即可。

- [ ] **Step 1: 起 dev server**

Run: `pnpm dev`
记下实际端口（Vite 被占用时会自动递增）。

- [ ] **Step 2: 探活**

Run: `curl -s --noproxy '*' -o /dev/null -w '%{http_code}' http://127.0.0.1:<port>/`
Expected: `200`

- [ ] **Step 3: 核对五个陷阱的「现象」确实被浏览器排出来了**

这是本 task 的重点——这些数字纯函数算得出来，但**浏览器认不认**只有浏览器说了算。

逐个滚到陷阱板块，读演示区里每个盒子的实际尺寸（用 `getComputedStyle` 或 `offsetWidth`，**不要用 `getBoundingClientRect()`**），核对：

| 陷阱 | 现象态应该看到 | 修复态应该看到 |
| --- | --- | --- |
| `min-width-auto` | A 停在 320px，三盒总宽 504 > 容器 480，**明显溢出** | A 落到 296px，总宽正好 480 |
| `basis-source` | 三盒 312 / 192 / 192，**明显不等宽** | 三盒各 232，等宽 |
| `flex-shorthand` | 三盒各 200，总宽 624 > 容器 480，**溢出且不收缩** | 三盒各 152，正好填满 |
| `align-content-single-line` | 四盒挤在**一行**里溢出，`align-content: center` 毫无效果 | 排成**两行**，两行整体在交叉轴居中 |
| `margin-auto` | B、C 紧贴 A，右侧空出一大片，space-between **失效** | 三盒推到两端，间隔均分 |

- [ ] **Step 4: 核对三拍推进**

慢慢滚过一个陷阱板块，确认：板块确实被 pin 在视口里；三张卡片依次淡入；**第 2 拍演示区不动**（仍是现象态）；第 3 拍盒子当场重排；往回滚能在现象与修复之间反复对比；**拍号在边界附近不抖**（滞回生效）。

- [ ] **Step 5: 核对降级**

把窗口宽度拉到 768px 以下，刷新，确认：不再 pin，三拍垂直堆叠全部展开，各带一个演示区，差异表常驻。

然后在系统里打开「减少动态效果」，宽屏刷新，确认同样走降级形态且完全静止。

- [ ] **Step 6: 核对一键复现**

点某个陷阱的「载入现象到 Playground」，确认：页面平滑滚回 Playground；Playground 的盒子布局与陷阱演示区**逐字段一致**；明细表数字跟着更新；**约 300ms 后地址栏出现对应短码**；把该链接复制到新标签页打开能还原同一画面。

再点「载入修复」，确认状态跟着换。

- [ ] **Step 7: 把核对结果写进 CLAUDE.md 的「当前进度」**

把 M5 从「下一件是」改成已完成，记下浏览器实测过的条目，以及任何本次发现的坑。若发现缺陷，先修再记。

- [ ] **Step 8: 提交**

走 `/commit` skill，建议提交信息：

```
docs: 记下 M5 的浏览器实测结果
```

---

## 自审记录

**Spec 覆盖核对**（spec 章节 → 落地任务）：

| Spec 章节 | 落地位置 |
| --- | --- |
| 2.1 抽出无状态 TrapStage | Task 4 |
| 2.2 扁平方块不搬等距块 CSS | Task 4（`.trap-stage-item` 样式与注释） |
| 2.3 pin + 离散三拍 | Task 6（`beatFromProgress`）+ Task 7（`beat` 驱动渲染） |
| 2.4 一个 TrapStage 随拍切、第 2 拍不动 | Task 7（`stageState` 的 `beat.value < 2`）+ 对应测试 |
| 2.5 直接改单例不走跳转 | Task 3（`loadState`）+ Task 7（`reproduce`） |
| 2.6 diff 从两份完整 state 相减 | Task 1（`diffStates` + 「假差异」那条测试） |
| 2.7 陷阱 2 改为 basis auto vs 0 | Task 2（`basis-source`） |
| 3 模块划分 | 文件结构表，13 新建 + 3 修改 |
| 4 数据模型 | Task 1 Step 1 |
| 5 三拍与演示区关系 | Task 7 |
| 6 ScrollTrigger 与降级 | Task 6 + Task 7 的两套模板 |
| 7 一键复现 | Task 3 + Task 7 |
| 8 五个陷阱状态 | Task 2 |
| 9 信息架构改动 | Task 8 Step 5 |
| 10 测试策略 | 各 task 的测试 + Task 9 |
| 11 未定项（陷阱区目录） | 有意不实现，等 Task 9 滚过一遍再决定 |

**类型一致性核对**：`resolveVariant` / `diffStates` / `CONTAINER_KEYS` / `ITEM_KEYS`（Task 1 定义）→ Task 2、7 使用，签名一致；`loadState`（Task 3）→ Task 7 使用；`beat` / `degraded`（Task 6）→ Task 7 解构，名字一致；`TrapStage` 的 `data-testid` 在 Task 4 定义、Task 7 测试里引用，拼写一致。
