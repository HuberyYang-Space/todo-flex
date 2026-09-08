# todo-flex 核心引擎与 Playground 实现计划（M1 + M2）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 flex 推导引擎（纯函数、测试全覆盖）与一个可用的 Playground——用户能自由排列组合 flex 全部属性、在真实渲染的演示区看到效果、复制生成的 CSS。

**Architecture:** 严格分层。`src/core/` 下全部是零 DOM 依赖的纯函数（推导引擎、CSS 生成），先写测试再写实现；`src/data/flexProperties.ts` 是属性元信息表，控制面板遍历它生成控件，不手写重复模板；`src/components/playground/` 只负责渲染与事件，演示区使用真实 DOM + 真实 CSS flex，绝不用 JS 计算盒子位置。

**Tech Stack:** Vue 3 (script setup) · Vite · TypeScript 6 · UnoCSS · VueUse · Vitest · happy-dom · @vue/test-utils · prismjs · @antfu/eslint-config

**Spec:** `docs/superpowers/specs/2026-09-08-todo-flex-design.md`

## Global Constraints

- 包管理器固定 **pnpm**。
- **TypeScript 锁定 6.x**，不得升级到 7.x：`@typescript-eslint@8` 要求 `typescript < 6.1.0`，升级会导致整条 lint 链失配。
- **代码注释一律用中文**，简体。
- **演示区必须是真实 DOM + 真实 CSS flex 渲染**。禁止用 JS 计算盒子位置来"模拟"布局——这是站点可信度的根基。
- **`src/core/` 下所有模块零 DOM 依赖**，不得 import 任何浏览器 API 或 vue 响应式 API 之外的东西（推导引擎连 vue 都不 import）。
- **推导引擎故意不模拟 `min-width: auto` 的下限截断**。这个缝隙留给后续 M3 的诊断层去发现并解释，是产品的差异化所在，不要"顺手补上"。
- **控制面板必须由 `src/data/flexProperties.ts` 驱动生成**，禁止为每个属性手写一遍 select/radio 模板。
- 提交遵循 Conventional Commits（`feat:` / `test:` / `refactor:` 等）。**不要添加 `Co-Authored-By` trailer**。
- 每个 task 收尾前跑 `pnpm lint`，必须零 error（antfu 风格由 `--fix` 自动修复的部分先跑 `pnpm lint:fix`）。
- 测试文件与源码同目录，命名 `*.spec.ts`（vitest 的 include 是 `src/**/*.{test,spec}.ts`）。

## 文件结构

M1（纯逻辑，零 DOM）：

| 文件 | 职责 |
| --- | --- |
| `src/core/types.ts` | 状态与推导结果的全部类型定义 |
| `src/core/axis.ts` | 主轴/交叉轴换算工具（direction 决定主轴是宽还是高） |
| `src/core/defaults.ts` | 默认状态与默认盒子的工厂函数 |
| `src/core/resolveBasis.ts` | `flex-basis` 字符串 → 像素值 |
| `src/core/splitLines.ts` | 按 order 排序并分行 |
| `src/core/distribute.ts` | 剩余空间计算 + grow/shrink 分配 |
| `src/core/deriveLayout.ts` | 组装以上各步，输出 `DerivedLayout` 与推导步骤 |
| `src/core/cssEmit.ts` | 状态 → 可复制的 CSS 文本 |

M2（UI）：

| 文件 | 职责 |
| --- | --- |
| `src/data/flexProperties.ts` | 属性元信息表，驱动控制面板生成 |
| `src/composables/useFlexState.ts` | 唯一状态源 + 派生数据 + 增删选中操作 |
| `src/components/playground/DemoStage.vue` | 真实 flex 容器与盒子渲染，点选高亮 |
| `src/components/playground/ContainerControls.vue` | 容器属性控件（表驱动） |
| `src/components/playground/ItemControls.vue` | 选中盒子的属性控件（表驱动） |
| `src/components/playground/ItemList.vue` | 盒子列表与增删 |
| `src/components/playground/CssOutput.vue` | CSS 输出、语法高亮与复制 |
| `src/components/playground/ThePlayground.vue` | 三区布局组装 |
| `src/App.vue` | 挂载 Playground（修改） |

---

### Task 1: 类型定义、轴向工具与默认状态

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/axis.ts`
- Create: `src/core/defaults.ts`
- Test: `src/core/defaults.spec.ts`
- Delete: `src/__tests__/smoke.spec.ts`（工具链自检已完成使命，被真实测试取代）

**Interfaces:**
- Consumes: 无（第一个 task）
- Produces:
  - `FlexContainerState` / `FlexItemState` / `FlexState`（状态类型）
  - `DerivedItem` / `DerivedLine` / `DerivationStep` / `DerivedLayout`（推导结果类型）
  - `isRowDirection(direction: Direction): boolean`
  - `mainAxisSize(container: FlexContainerState): number`
  - `mainAxisGap(container: FlexContainerState): number`
  - `createDefaultItem(id: string): FlexItemState`
  - `createDefaultState(): FlexState`

- [ ] **Step 1: 写失败的测试**

创建 `src/core/defaults.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { isRowDirection, mainAxisGap, mainAxisSize } from './axis'
import { createDefaultItem, createDefaultState } from './defaults'

describe('createDefaultState', () => {
  it('默认是 row 方向、不换行的三盒子布局', () => {
    const state = createDefaultState()
    expect(state.container.direction).toBe('row')
    expect(state.container.wrap).toBe('nowrap')
    expect(state.items).toHaveLength(3)
    expect(state.selectedId).toBeNull()
  })

  it('每个盒子的 id 唯一', () => {
    const ids = createDefaultState().items.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('默认盒子是 flex: 0 1 auto，保留 min-width:auto', () => {
    const item = createDefaultItem('item-1')
    expect(item.grow).toBe(0)
    expect(item.shrink).toBe(1)
    expect(item.basis).toBe('auto')
    expect(item.minWidthAuto).toBe(true)
    expect(item.marginAuto).toBe(false)
  })
})

describe('轴向工具', () => {
  it('row / row-reverse 的主轴是横向', () => {
    expect(isRowDirection('row')).toBe(true)
    expect(isRowDirection('row-reverse')).toBe(true)
    expect(isRowDirection('column')).toBe(false)
    expect(isRowDirection('column-reverse')).toBe(false)
  })

  it('主轴尺寸随 direction 在宽高之间切换', () => {
    const state = createDefaultState()
    state.container.width = 720
    state.container.height = 320
    expect(mainAxisSize(state.container)).toBe(720)
    state.container.direction = 'column'
    expect(mainAxisSize(state.container)).toBe(320)
  })

  it('主轴间距 row 取 column-gap、column 取 row-gap', () => {
    const state = createDefaultState()
    state.container.rowGap = 8
    state.container.columnGap = 16
    expect(mainAxisGap(state.container)).toBe(16)
    state.container.direction = 'column'
    expect(mainAxisGap(state.container)).toBe(8)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/defaults.spec.ts`
Expected: FAIL，报错找不到模块 `./axis` 与 `./defaults`

- [ ] **Step 3: 写实现**

创建 `src/core/types.ts`：

```ts
export type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse'
export type Wrap = 'nowrap' | 'wrap' | 'wrap-reverse'

/** 容器属性。width/height 由演示区拖拽调整，不出现在控制面板的属性表里 */
export interface FlexContainerState {
  display: 'flex' | 'inline-flex'
  direction: Direction
  wrap: Wrap
  justifyContent: string
  alignItems: string
  alignContent: string
  rowGap: number
  columnGap: number
  width: number
  height: number
}

export interface FlexItemState {
  id: string
  grow: number
  shrink: number
  /** 'auto' | 'content' | '0' | '120px' | '30%' */
  basis: string
  order: number
  alignSelf: string
  /** 主轴方向上的内容固有尺寸（px），决定 min-width:auto 的下限与 baseline 位置 */
  size: number
  /** 是否保留 min-width:auto（关闭则写入 min-width:0） */
  minWidthAuto: boolean
  /** 是否给该项加 margin:auto */
  marginAuto: boolean
}

export interface FlexState {
  container: FlexContainerState
  items: FlexItemState[]
  selectedId: string | null
}

export interface DerivedItem {
  id: string
  /** 解析后的 flex-basis（px） */
  basisResolved: number
  /** 假设主轴尺寸：basis 解析值下限截到 0 */
  hypotheticalMainSize: number
  /** 理论最终主轴尺寸 */
  finalMainSize: number
  /** 由 grow 分得（≥ 0） */
  deltaFromGrow: number
  /** 由 shrink 让出（≤ 0） */
  deltaFromShrink: number
  lineIndex: number
}

export interface DerivedLine {
  index: number
  itemIds: string[]
  /** 已占用主轴尺寸，含 gap */
  usedMainSize: number
  /** 正 = 有剩余，负 = 溢出 */
  freeSpace: number
  totalGrow: number
  /** Σ(shrink × basis) */
  totalShrinkWeighted: number
}

export type DerivationStepKind =
  | 'resolveBasis'
  | 'lineBreak'
  | 'freeSpace'
  | 'growDistribute'
  | 'shrinkDistribute'

/** 一条可展示给用户的推导步骤，params 交给 i18n 渲染成公式文案 */
export interface DerivationStep {
  kind: DerivationStepKind
  lineIndex: number
  itemId?: string
  params: Record<string, number>
  messageKey: string
}

export interface DerivedLayout {
  lines: DerivedLine[]
  items: DerivedItem[]
  steps: DerivationStep[]
}
```

创建 `src/core/axis.ts`：

```ts
import type { Direction, FlexContainerState } from './types'

/** row / row-reverse 的主轴是横向 */
export function isRowDirection(direction: Direction): boolean {
  return direction === 'row' || direction === 'row-reverse'
}

/** 主轴上的容器尺寸 */
export function mainAxisSize(container: FlexContainerState): number {
  return isRowDirection(container.direction) ? container.width : container.height
}

/** 主轴方向上相邻项之间的间距 */
export function mainAxisGap(container: FlexContainerState): number {
  return isRowDirection(container.direction) ? container.columnGap : container.rowGap
}
```

创建 `src/core/defaults.ts`：

```ts
import type { FlexItemState, FlexState } from './types'

/** 默认盒子等价于 flex: 0 1 auto，即浏览器的初始值 */
export function createDefaultItem(id: string): FlexItemState {
  return {
    id,
    grow: 0,
    shrink: 1,
    basis: 'auto',
    order: 0,
    alignSelf: 'auto',
    size: 80,
    minWidthAuto: true,
    marginAuto: false,
  }
}

export function createDefaultState(): FlexState {
  return {
    container: {
      display: 'flex',
      direction: 'row',
      wrap: 'nowrap',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      alignContent: 'normal',
      rowGap: 12,
      columnGap: 12,
      width: 720,
      height: 320,
    },
    items: ['item-1', 'item-2', 'item-3'].map(createDefaultItem),
    selectedId: null,
  }
}
```

- [ ] **Step 4: 删除工具链自检测试并跑全量测试**

```bash
rm -rf src/__tests__
pnpm test
```

Expected: PASS，6 个用例全绿

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/core/types.ts src/core/axis.ts src/core/defaults.ts src/core/defaults.spec.ts
git add -u src/__tests__ 2>/dev/null || true
git commit -m "feat(core): 定义 flex 状态类型、轴向工具与默认状态"
```

---

### Task 2: flex-basis 解析

**Files:**
- Create: `src/core/resolveBasis.ts`
- Test: `src/core/resolveBasis.spec.ts`

**Interfaces:**
- Consumes: `FlexItemState` / `FlexContainerState`（Task 1）、`mainAxisSize`（Task 1）
- Produces: `resolveBasis(item: FlexItemState, container: FlexContainerState): number`

- [ ] **Step 1: 写失败的测试**

创建 `src/core/resolveBasis.spec.ts`：

```ts
import type { FlexContainerState, FlexItemState } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { resolveBasis } from './resolveBasis'

function setup(basis: string, size = 80): { item: FlexItemState, container: FlexContainerState } {
  const state = createDefaultState()
  const item = { ...createDefaultItem('x'), basis, size }
  return { item, container: state.container }
}

describe('resolveBasis', () => {
  it('auto 取内容固有尺寸', () => {
    const { item, container } = setup('auto', 120)
    expect(resolveBasis(item, container)).toBe(120)
  })

  it('content 同样取内容固有尺寸', () => {
    const { item, container } = setup('content', 64)
    expect(resolveBasis(item, container)).toBe(64)
  })

  it('0 解析为 0，而不是回退到内容尺寸', () => {
    const { item, container } = setup('0', 80)
    expect(resolveBasis(item, container)).toBe(0)
  })

  it('像素值直接取数值', () => {
    const { item, container } = setup('150px')
    expect(resolveBasis(item, container)).toBe(150)
  })

  it('百分比按容器主轴尺寸换算', () => {
    const { item, container } = setup('25%')
    container.width = 800
    expect(resolveBasis(item, container)).toBe(200)
  })

  it('column 方向下百分比按容器高度换算', () => {
    const { item, container } = setup('50%')
    container.direction = 'column'
    container.height = 300
    expect(resolveBasis(item, container)).toBe(150)
  })

  it('非法值回退到内容固有尺寸', () => {
    const { item, container } = setup('这不是长度', 90)
    expect(resolveBasis(item, container)).toBe(90)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/resolveBasis.spec.ts`
Expected: FAIL，报错找不到模块 `./resolveBasis`

- [ ] **Step 3: 写实现**

创建 `src/core/resolveBasis.ts`：

```ts
import type { FlexContainerState, FlexItemState } from './types'
import { mainAxisSize } from './axis'

/**
 * 把 flex-basis 字符串解析成像素值。
 * 注意：这里不做 min/max 截断——min-width:auto 的下限故意不模拟，
 * 留给诊断层比对理论与实际时发现并解释。
 */
export function resolveBasis(item: FlexItemState, container: FlexContainerState): number {
  const raw = item.basis.trim()

  // auto 与 content 都退回内容固有尺寸
  if (raw === 'auto' || raw === 'content')
    return item.size

  if (raw.endsWith('%')) {
    const percent = Number.parseFloat(raw)
    return Number.isNaN(percent) ? item.size : (mainAxisSize(container) * percent) / 100
  }

  const length = Number.parseFloat(raw)
  return Number.isNaN(length) ? item.size : length
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/core/resolveBasis.spec.ts`
Expected: PASS，7 个用例全绿

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/core/resolveBasis.ts src/core/resolveBasis.spec.ts
git commit -m "feat(core): 实现 flex-basis 解析"
```

---

### Task 3: 按 order 排序与分行

**Files:**
- Create: `src/core/splitLines.ts`
- Test: `src/core/splitLines.spec.ts`

**Interfaces:**
- Consumes: `resolveBasis`（Task 2）、`mainAxisSize` / `mainAxisGap`（Task 1）
- Produces: `splitLines(items: FlexItemState[], container: FlexContainerState): string[][]`（返回每行的 item id 数组，按视觉行序）

- [ ] **Step 1: 写失败的测试**

创建 `src/core/splitLines.spec.ts`：

```ts
import type { FlexItemState } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { splitLines } from './splitLines'

function makeItems(specs: Partial<FlexItemState>[]): FlexItemState[] {
  return specs.map((spec, index) => ({ ...createDefaultItem(`i${index + 1}`), ...spec }))
}

describe('splitLines', () => {
  it('nowrap 时永远只有一行，即使总尺寸超出容器', () => {
    const { container } = createDefaultState()
    container.width = 200
    const items = makeItems([{ size: 150 }, { size: 150 }, { size: 150 }])
    expect(splitLines(items, container)).toEqual([['i1', 'i2', 'i3']])
  })

  it('wrap 时按假设尺寸加 gap 累计断行', () => {
    const { container } = createDefaultState()
    container.wrap = 'wrap'
    container.width = 300
    container.columnGap = 10
    // 120 + 10 + 120 = 250 放得下；再加 10 + 120 = 380 放不下，第三个换行
    const items = makeItems([{ size: 120 }, { size: 120 }, { size: 120 }])
    expect(splitLines(items, container)).toEqual([['i1', 'i2'], ['i3']])
  })

  it('单个盒子超宽时独占一行，不会产生空行', () => {
    const { container } = createDefaultState()
    container.wrap = 'wrap'
    container.width = 100
    const items = makeItems([{ size: 500 }, { size: 40 }])
    expect(splitLines(items, container)).toEqual([['i1'], ['i2']])
  })

  it('order 小的排在前面，并影响分行结果', () => {
    const { container } = createDefaultState()
    container.wrap = 'wrap'
    container.width = 300
    container.columnGap = 0
    const items = makeItems([
      { size: 200, order: 2 },
      { size: 200, order: 1 },
      { size: 50, order: 0 },
    ])
    expect(splitLines(items, container)).toEqual([['i3', 'i2'], ['i1']])
  })

  it('order 相同时保持文档顺序（稳定排序）', () => {
    const { container } = createDefaultState()
    const items = makeItems([{ size: 10 }, { size: 10 }, { size: 10 }])
    expect(splitLines(items, container)).toEqual([['i1', 'i2', 'i3']])
  })

  it('wrap-reverse 反转行的视觉顺序', () => {
    const { container } = createDefaultState()
    container.wrap = 'wrap-reverse'
    container.width = 300
    container.columnGap = 0
    const items = makeItems([{ size: 200 }, { size: 200 }])
    expect(splitLines(items, container)).toEqual([['i2'], ['i1']])
  })

  it('column 方向按容器高度分行', () => {
    const { container } = createDefaultState()
    container.direction = 'column'
    container.wrap = 'wrap'
    container.height = 200
    container.rowGap = 0
    const items = makeItems([{ size: 120 }, { size: 120 }])
    expect(splitLines(items, container)).toEqual([['i1'], ['i2']])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/splitLines.spec.ts`
Expected: FAIL，报错找不到模块 `./splitLines`

- [ ] **Step 3: 写实现**

创建 `src/core/splitLines.ts`：

```ts
import type { FlexContainerState, FlexItemState } from './types'
import { mainAxisGap, mainAxisSize } from './axis'
import { resolveBasis } from './resolveBasis'

/**
 * 按 order 排序后分行，返回每行的 item id。
 * 返回值按「视觉行序」排列：wrap-reverse 会反转行的先后。
 */
export function splitLines(items: FlexItemState[], container: FlexContainerState): string[][] {
  // Array.prototype.sort 是稳定排序，order 相同的项保持文档顺序
  const ordered = [...items].sort((a, b) => a.order - b.order)

  if (container.wrap === 'nowrap')
    return [ordered.map(item => item.id)]

  const limit = mainAxisSize(container)
  const gap = mainAxisGap(container)
  const lines: string[][] = []
  let current: string[] = []
  let used = 0

  for (const item of ordered) {
    const size = Math.max(0, resolveBasis(item, container))
    const nextUsed = current.length === 0 ? size : used + gap + size

    // 当前行已有内容且放不下时才断行，保证单个超宽盒子独占一行而非产生空行
    if (current.length > 0 && nextUsed > limit) {
      lines.push(current)
      current = [item.id]
      used = size
    }
    else {
      current.push(item.id)
      used = nextUsed
    }
  }

  if (current.length > 0)
    lines.push(current)

  return container.wrap === 'wrap-reverse' ? lines.reverse() : lines
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/core/splitLines.spec.ts`
Expected: PASS，7 个用例全绿

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/core/splitLines.ts src/core/splitLines.spec.ts
git commit -m "feat(core): 实现按 order 排序与换行分行"
```

---

### Task 4: 剩余空间与 grow/shrink 分配

**Files:**
- Create: `src/core/distribute.ts`
- Test: `src/core/distribute.spec.ts`

**Interfaces:**
- Consumes: `resolveBasis`（Task 2）、`mainAxisSize` / `mainAxisGap`（Task 1）
- Produces:
  - `computeFreeSpace(lineItems: FlexItemState[], container: FlexContainerState): number`
  - `distributeGrow(lineItems: FlexItemState[], freeSpace: number): Map<string, number>`
  - `distributeShrink(lineItems: FlexItemState[], freeSpace: number, container: FlexContainerState): Map<string, number>`
  - `shrinkWeight(item: FlexItemState, container: FlexContainerState): number`

- [ ] **Step 1: 写失败的测试**

创建 `src/core/distribute.spec.ts`：

```ts
import type { FlexItemState } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { computeFreeSpace, distributeGrow, distributeShrink, shrinkWeight } from './distribute'

function makeItems(specs: Partial<FlexItemState>[]): FlexItemState[] {
  return specs.map((spec, index) => ({ ...createDefaultItem(`i${index + 1}`), ...spec }))
}

describe('computeFreeSpace', () => {
  it('剩余空间 = 容器主轴 - Σ假设尺寸 - Σgap', () => {
    const { container } = createDefaultState()
    container.width = 600
    container.columnGap = 20
    const items = makeItems([{ size: 100 }, { size: 100 }, { size: 100 }])
    // 600 - 300 - 40 = 260
    expect(computeFreeSpace(items, container)).toBe(260)
  })

  it('单个盒子时不计入 gap', () => {
    const { container } = createDefaultState()
    container.width = 500
    container.columnGap = 20
    expect(computeFreeSpace(makeItems([{ size: 100 }]), container)).toBe(400)
  })

  it('内容超出容器时返回负值', () => {
    const { container } = createDefaultState()
    container.width = 200
    container.columnGap = 0
    const items = makeItems([{ size: 150 }, { size: 150 }])
    expect(computeFreeSpace(items, container)).toBe(-100)
  })

  it('基于 basis 而非内容尺寸计算', () => {
    const { container } = createDefaultState()
    container.width = 500
    container.columnGap = 0
    const items = makeItems([{ size: 300, basis: '100px' }, { size: 300, basis: '100px' }])
    expect(computeFreeSpace(items, container)).toBe(300)
  })
})

describe('distributeGrow', () => {
  it('按 grow 占比瓜分剩余空间', () => {
    const items = makeItems([{ grow: 1 }, { grow: 3 }])
    const result = distributeGrow(items, 200)
    expect(result.get('i1')).toBe(50)
    expect(result.get('i2')).toBe(150)
  })

  it('grow 全为 0 时谁都不分，剩余空间原样留下', () => {
    const items = makeItems([{ grow: 0 }, { grow: 0 }])
    const result = distributeGrow(items, 200)
    expect(result.get('i1')).toBe(0)
    expect(result.get('i2')).toBe(0)
  })

  it('负数 grow 按 0 处理', () => {
    const items = makeItems([{ grow: -5 }, { grow: 1 }])
    const result = distributeGrow(items, 100)
    expect(result.get('i1')).toBe(0)
    expect(result.get('i2')).toBe(100)
  })
})

describe('distributeShrink', () => {
  it('按 shrink × basis 加权分摊溢出量，结果为负', () => {
    const { container } = createDefaultState()
    // 权重：1×300 = 300 与 1×100 = 100，合计 400
    // 溢出 -200 → i1 分 -150，i2 分 -50
    const items = makeItems([
      { shrink: 1, basis: '300px' },
      { shrink: 1, basis: '100px' },
    ])
    const result = distributeShrink(items, -200, container)
    expect(result.get('i1')).toBe(-150)
    expect(result.get('i2')).toBe(-50)
  })

  it('shrink 为 0 的项不参与收缩', () => {
    const { container } = createDefaultState()
    const items = makeItems([
      { shrink: 0, basis: '200px' },
      { shrink: 1, basis: '200px' },
    ])
    const result = distributeShrink(items, -100, container)
    expect(result.get('i1')).toBe(0)
    expect(result.get('i2')).toBe(-100)
  })

  it('全部 shrink 为 0 时不收缩，溢出保持', () => {
    const { container } = createDefaultState()
    const items = makeItems([{ shrink: 0 }, { shrink: 0 }])
    const result = distributeShrink(items, -100, container)
    expect(result.get('i1')).toBe(0)
    expect(result.get('i2')).toBe(0)
  })

  it('basis 为 0 的项权重为 0，不参与收缩', () => {
    const { container } = createDefaultState()
    const items = makeItems([
      { shrink: 1, basis: '0' },
      { shrink: 1, basis: '200px' },
    ])
    expect(shrinkWeight(items[0], container)).toBe(0)
    const result = distributeShrink(items, -100, container)
    expect(result.get('i1')).toBe(0)
    expect(result.get('i2')).toBe(-100)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/distribute.spec.ts`
Expected: FAIL，报错找不到模块 `./distribute`

- [ ] **Step 3: 写实现**

创建 `src/core/distribute.ts`：

```ts
import type { FlexContainerState, FlexItemState } from './types'
import { mainAxisGap, mainAxisSize } from './axis'
import { resolveBasis } from './resolveBasis'

/** 假设主轴尺寸：basis 解析值，下限截到 0 */
function hypotheticalSize(item: FlexItemState, container: FlexContainerState): number {
  return Math.max(0, resolveBasis(item, container))
}

/** 剩余空间 = 容器主轴尺寸 - Σ假设尺寸 - Σgap，负值代表溢出 */
export function computeFreeSpace(lineItems: FlexItemState[], container: FlexContainerState): number {
  const totalGap = Math.max(0, lineItems.length - 1) * mainAxisGap(container)
  const used = lineItems.reduce((sum, item) => sum + hypotheticalSize(item, container), 0)
  return mainAxisSize(container) - used - totalGap
}

/** 收缩权重 = shrink × basis，这是 shrink 与 grow 最容易被忽略的差别 */
export function shrinkWeight(item: FlexItemState, container: FlexContainerState): number {
  return Math.max(0, item.shrink) * hypotheticalSize(item, container)
}

/** 剩余空间为正时按 grow 占比分配，返回每项分得的增量（≥ 0） */
export function distributeGrow(lineItems: FlexItemState[], freeSpace: number): Map<string, number> {
  const result = new Map<string, number>()
  const totalGrow = lineItems.reduce((sum, item) => sum + Math.max(0, item.grow), 0)

  for (const item of lineItems) {
    result.set(item.id, totalGrow <= 0 ? 0 : (Math.max(0, item.grow) / totalGrow) * freeSpace)
  }

  return result
}

/** 剩余空间为负时按 shrink × basis 加权分摊，返回每项让出的增量（≤ 0） */
export function distributeShrink(
  lineItems: FlexItemState[],
  freeSpace: number,
  container: FlexContainerState,
): Map<string, number> {
  const result = new Map<string, number>()
  const weights = lineItems.map(item => shrinkWeight(item, container))
  const total = weights.reduce((sum, weight) => sum + weight, 0)

  lineItems.forEach((item, index) => {
    result.set(item.id, total <= 0 ? 0 : (weights[index] / total) * freeSpace)
  })

  return result
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/core/distribute.spec.ts`
Expected: PASS，11 个用例全绿

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/core/distribute.ts src/core/distribute.spec.ts
git commit -m "feat(core): 实现剩余空间计算与 grow/shrink 分配"
```

---

### Task 5: 组装推导引擎并输出推导步骤

**Files:**
- Create: `src/core/deriveLayout.ts`
- Test: `src/core/deriveLayout.spec.ts`

**Interfaces:**
- Consumes: `splitLines`（Task 3）、`computeFreeSpace` / `distributeGrow` / `distributeShrink` / `shrinkWeight`（Task 4）、`resolveBasis`（Task 2）
- Produces: `deriveLayout(state: FlexState): DerivedLayout`

- [ ] **Step 1: 写失败的测试**

创建 `src/core/deriveLayout.spec.ts`：

```ts
import type { FlexItemState } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { deriveLayout } from './deriveLayout'

function stateWith(items: Partial<FlexItemState>[], width = 600, gap = 0) {
  const state = createDefaultState()
  state.container.width = width
  state.container.columnGap = gap
  state.items = items.map((spec, index) => ({ ...createDefaultItem(`i${index + 1}`), ...spec }))
  return state
}

function itemById(layout: ReturnType<typeof deriveLayout>, id: string) {
  const found = layout.items.find(item => item.id === id)
  if (!found)
    throw new Error(`未找到推导结果：${id}`)
  return found
}

describe('deriveLayout', () => {
  it('grow 为 0 时最终尺寸等于 basis，剩余空间留在行上', () => {
    const layout = deriveLayout(stateWith([{ basis: '100px' }, { basis: '100px' }]))
    expect(itemById(layout, 'i1').finalMainSize).toBe(100)
    expect(layout.lines[0].freeSpace).toBe(400)
  })

  it('flex: 1 1 0 时等分容器', () => {
    const layout = deriveLayout(stateWith([
      { grow: 1, shrink: 1, basis: '0' },
      { grow: 1, shrink: 1, basis: '0' },
      { grow: 1, shrink: 1, basis: '0' },
    ]))
    expect(itemById(layout, 'i1').finalMainSize).toBe(200)
    expect(itemById(layout, 'i2').finalMainSize).toBe(200)
    expect(itemById(layout, 'i3').finalMainSize).toBe(200)
  })

  it('flex: 1 1 auto 时按内容尺寸打底再分剩余，不是等分', () => {
    // 这是「flex:1 为什么没等分」的核心：basis auto 保留了内容尺寸
    const layout = deriveLayout(stateWith([
      { grow: 1, basis: 'auto', size: 100 },
      { grow: 1, basis: 'auto', size: 200 },
    ]))
    // 剩余 600-300=300，两项各分 150
    expect(itemById(layout, 'i1').finalMainSize).toBe(250)
    expect(itemById(layout, 'i2').finalMainSize).toBe(350)
  })

  it('gap 计入剩余空间', () => {
    const layout = deriveLayout(stateWith([
      { grow: 1, basis: '0' },
      { grow: 1, basis: '0' },
    ], 600, 40))
    expect(layout.lines[0].freeSpace).toBe(560)
    expect(itemById(layout, 'i1').finalMainSize).toBe(280)
  })

  it('溢出时按 shrink × basis 加权收缩', () => {
    const layout = deriveLayout(stateWith([
      { shrink: 1, basis: '600px' },
      { shrink: 1, basis: '200px' },
    ], 400))
    // 溢出 -400，权重 600:200 → -300 / -100
    expect(itemById(layout, 'i1').finalMainSize).toBe(300)
    expect(itemById(layout, 'i2').finalMainSize).toBe(100)
  })

  it('不模拟 min-width:auto 的下限截断，理论值可以小于内容尺寸', () => {
    // 这个缝隙是留给诊断层发现的，推导引擎必须诚实地给出「理论上会收到多小」
    const layout = deriveLayout(stateWith([
      { shrink: 1, basis: 'auto', size: 400, minWidthAuto: true },
      { shrink: 1, basis: 'auto', size: 400, minWidthAuto: true },
    ], 200))
    expect(itemById(layout, 'i1').finalMainSize).toBe(100)
  })

  it('换行时每行独立计算剩余空间', () => {
    const state = stateWith([{ basis: '200px' }, { basis: '200px' }, { basis: '100px' }], 400)
    state.container.wrap = 'wrap'
    const layout = deriveLayout(state)
    expect(layout.lines).toHaveLength(2)
    expect(layout.lines[0].freeSpace).toBe(0)
    expect(layout.lines[1].freeSpace).toBe(300)
    expect(itemById(layout, 'i3').lineIndex).toBe(1)
  })

  it('输出可展示的推导步骤', () => {
    const layout = deriveLayout(stateWith([
      { grow: 1, basis: '0' },
      { grow: 3, basis: '0' },
    ]))
    const growSteps = layout.steps.filter(step => step.kind === 'growDistribute')
    expect(growSteps).toHaveLength(2)
    expect(growSteps[1].itemId).toBe('i2')
    expect(growSteps[1].params.delta).toBe(450)
    expect(growSteps[1].params.totalGrow).toBe(4)
    expect(layout.steps.some(step => step.kind === 'freeSpace')).toBe(true)
  })

  it('每行都记录 totalGrow 与 totalShrinkWeighted', () => {
    const layout = deriveLayout(stateWith([
      { grow: 2, shrink: 1, basis: '100px' },
      { grow: 1, shrink: 2, basis: '100px' },
    ]))
    expect(layout.lines[0].totalGrow).toBe(3)
    expect(layout.lines[0].totalShrinkWeighted).toBe(300)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/deriveLayout.spec.ts`
Expected: FAIL，报错找不到模块 `./deriveLayout`

- [ ] **Step 3: 写实现**

创建 `src/core/deriveLayout.ts`：

```ts
import type { DerivationStep, DerivedItem, DerivedLine, DerivedLayout, FlexState } from './types'
import { mainAxisSize } from './axis'
import { computeFreeSpace, distributeGrow, distributeShrink, shrinkWeight } from './distribute'
import { resolveBasis } from './resolveBasis'
import { splitLines } from './splitLines'

/**
 * 推导引擎：按 flex 规范算出每个盒子的「理论」主轴尺寸，并记录推导过程。
 * 刻意不模拟 min-width:auto 等下限截断——理论值与浏览器实际值的差，
 * 正是诊断层用来发现「哪条规则介入了」的信号。
 */
export function deriveLayout(state: FlexState): DerivedLayout {
  const { container, items } = state
  const byId = new Map(items.map(item => [item.id, item]))
  const lineIds = splitLines(items, container)
  const containerMain = mainAxisSize(container)

  const lines: DerivedLine[] = []
  const derivedItems: DerivedItem[] = []
  const steps: DerivationStep[] = []

  if (lineIds.length > 1) {
    steps.push({
      kind: 'lineBreak',
      lineIndex: 0,
      params: { lineCount: lineIds.length },
      messageKey: 'derive.lineBreak',
    })
  }

  lineIds.forEach((ids, lineIndex) => {
    const lineItems = ids.map(id => byId.get(id)!)
    const freeSpace = computeFreeSpace(lineItems, container)
    const totalGrow = lineItems.reduce((sum, item) => sum + Math.max(0, item.grow), 0)
    const totalShrinkWeighted = lineItems.reduce((sum, item) => sum + shrinkWeight(item, container), 0)

    steps.push({
      kind: 'freeSpace',
      lineIndex,
      params: { containerMain, used: containerMain - freeSpace, freeSpace },
      messageKey: 'derive.freeSpace',
    })

    const growDeltas = freeSpace > 0 ? distributeGrow(lineItems, freeSpace) : null
    const shrinkDeltas = freeSpace < 0 ? distributeShrink(lineItems, freeSpace, container) : null

    for (const item of lineItems) {
      const basisResolved = resolveBasis(item, container)
      const hypotheticalMainSize = Math.max(0, basisResolved)
      const deltaFromGrow = growDeltas?.get(item.id) ?? 0
      const deltaFromShrink = shrinkDeltas?.get(item.id) ?? 0

      derivedItems.push({
        id: item.id,
        basisResolved,
        hypotheticalMainSize,
        finalMainSize: hypotheticalMainSize + deltaFromGrow + deltaFromShrink,
        deltaFromGrow,
        deltaFromShrink,
        lineIndex,
      })

      steps.push({
        kind: 'resolveBasis',
        lineIndex,
        itemId: item.id,
        params: { basisResolved, size: item.size },
        messageKey: 'derive.resolveBasis',
      })

      if (deltaFromGrow > 0) {
        steps.push({
          kind: 'growDistribute',
          lineIndex,
          itemId: item.id,
          params: { grow: item.grow, totalGrow, freeSpace, delta: deltaFromGrow },
          messageKey: 'derive.growDistribute',
        })
      }

      if (deltaFromShrink < 0) {
        steps.push({
          kind: 'shrinkDistribute',
          lineIndex,
          itemId: item.id,
          params: {
            shrink: item.shrink,
            weight: shrinkWeight(item, container),
            totalShrinkWeighted,
            overflow: freeSpace,
            delta: deltaFromShrink,
          },
          messageKey: 'derive.shrinkDistribute',
        })
      }
    }

    lines.push({
      index: lineIndex,
      itemIds: ids,
      usedMainSize: containerMain - freeSpace,
      freeSpace,
      totalGrow,
      totalShrinkWeighted,
    })
  })

  return { lines, items: derivedItems, steps }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/core/deriveLayout.spec.ts`
Expected: PASS，9 个用例全绿

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/core/deriveLayout.ts src/core/deriveLayout.spec.ts
git commit -m "feat(core): 组装推导引擎并输出推导步骤"
```

---

### Task 6: CSS 文本生成

**Files:**
- Create: `src/core/cssEmit.ts`
- Test: `src/core/cssEmit.spec.ts`

**Interfaces:**
- Consumes: `FlexState`（Task 1）
- Produces: `emitCss(state: FlexState): string`

- [ ] **Step 1: 写失败的测试**

创建 `src/core/cssEmit.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { emitCss } from './cssEmit'
import { createDefaultState } from './defaults'

describe('emitCss', () => {
  it('输出容器规则，gap 用 row column 简写', () => {
    const state = createDefaultState()
    state.container.rowGap = 8
    state.container.columnGap = 16
    const css = emitCss(state)
    expect(css).toContain('display: flex;')
    expect(css).toContain('flex-direction: row;')
    expect(css).toContain('flex-wrap: nowrap;')
    expect(css).toContain('justify-content: flex-start;')
    expect(css).toContain('align-items: stretch;')
    expect(css).toContain('gap: 8px 16px;')
  })

  it('align-content 为 normal 时不输出该行，避免噪音', () => {
    const state = createDefaultState()
    expect(emitCss(state)).not.toContain('align-content')
    state.container.alignContent = 'space-between'
    expect(emitCss(state)).toContain('align-content: space-between;')
  })

  it('每个盒子输出 flex 简写，序号从 1 开始', () => {
    const state = createDefaultState()
    state.items[0].grow = 2
    state.items[0].basis = '120px'
    const css = emitCss(state)
    expect(css).toContain('.item-1 {')
    expect(css).toContain('flex: 2 1 120px;')
    expect(css).toContain('.item-3 {')
  })

  it('只在非默认值时输出 order / align-self / min-width / margin', () => {
    const state = createDefaultState()
    expect(emitCss(state)).not.toContain('order:')
    expect(emitCss(state)).not.toContain('align-self:')
    expect(emitCss(state)).not.toContain('min-width:')
    expect(emitCss(state)).not.toContain('margin:')

    state.items[0].order = 2
    state.items[0].alignSelf = 'center'
    state.items[0].minWidthAuto = false
    state.items[0].marginAuto = true
    const css = emitCss(state)
    expect(css).toContain('order: 2;')
    expect(css).toContain('align-self: center;')
    expect(css).toContain('min-width: 0;')
    expect(css).toContain('margin: auto;')
  })

  it('column 方向下关闭 min-width:auto 输出的是 min-height', () => {
    const state = createDefaultState()
    state.container.direction = 'column'
    state.items[0].minWidthAuto = false
    expect(emitCss(state)).toContain('min-height: 0;')
  })

  it('输出结果可直接粘贴使用（结构快照）', () => {
    expect(emitCss(createDefaultState())).toMatchInlineSnapshot(`
      ".container {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: flex-start;
        align-items: stretch;
        gap: 12px 12px;
      }

      .item-1 {
        flex: 0 1 auto;
      }

      .item-2 {
        flex: 0 1 auto;
      }

      .item-3 {
        flex: 0 1 auto;
      }"
    `)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/cssEmit.spec.ts`
Expected: FAIL，报错找不到模块 `./cssEmit`

- [ ] **Step 3: 写实现**

创建 `src/core/cssEmit.ts`：

```ts
import type { FlexState } from './types'
import { isRowDirection } from './axis'

function block(selector: string, rules: string[]): string {
  return `${selector} {\n${rules.map(rule => `  ${rule};`).join('\n')}\n}`
}

/** 把当前状态转成可以直接粘贴进项目的 CSS */
export function emitCss(state: FlexState): string {
  const { container, items } = state

  const containerRules = [
    `display: ${container.display}`,
    `flex-direction: ${container.direction}`,
    `flex-wrap: ${container.wrap}`,
    `justify-content: ${container.justifyContent}`,
    `align-items: ${container.alignItems}`,
  ]

  // normal 是初始值，输出出来只会增加噪音
  if (container.alignContent !== 'normal')
    containerRules.push(`align-content: ${container.alignContent}`)

  containerRules.push(`gap: ${container.rowGap}px ${container.columnGap}px`)

  const blocks = [block('.container', containerRules)]
  // 主轴方向决定该关掉哪个方向的自动最小尺寸
  const minSizeProp = isRowDirection(container.direction) ? 'min-width' : 'min-height'

  items.forEach((item, index) => {
    const rules = [`flex: ${item.grow} ${item.shrink} ${item.basis}`]

    if (item.order !== 0)
      rules.push(`order: ${item.order}`)
    if (item.alignSelf !== 'auto')
      rules.push(`align-self: ${item.alignSelf}`)
    if (!item.minWidthAuto)
      rules.push(`${minSizeProp}: 0`)
    if (item.marginAuto)
      rules.push('margin: auto')

    blocks.push(block(`.item-${index + 1}`, rules))
  })

  return blocks.join('\n\n')
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/core/cssEmit.spec.ts`
Expected: PASS，6 个用例全绿。若内联快照与实现有细微空白差异，用 `pnpm vitest run src/core/cssEmit.spec.ts -u` 更新后人工确认输出确实可粘贴使用

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/core/cssEmit.ts src/core/cssEmit.spec.ts
git commit -m "feat(core): 实现 CSS 文本生成"
```

---

### Task 7: 属性元信息表

**Files:**
- Create: `src/data/flexProperties.ts`
- Test: `src/data/flexProperties.spec.ts`

**Interfaces:**
- Consumes: `FlexContainerState` / `FlexItemState`（Task 1）
- Produces:
  - `PropertyOption` / `PropertyDef` / `FlexShorthandPreset` 类型
  - `containerProperties: PropertyDef[]`
  - `itemProperties: PropertyDef[]`
  - `flexShorthandPresets: FlexShorthandPreset[]`
  - `visibleOptions(prop: PropertyDef, showAdvanced: boolean): PropertyOption[]`

- [ ] **Step 1: 写失败的测试**

创建 `src/data/flexProperties.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { createDefaultState } from '~/core/defaults'
import { containerProperties, flexShorthandPresets, itemProperties, visibleOptions } from './flexProperties'

const allProperties = [...containerProperties, ...itemProperties]

describe('属性元信息表', () => {
  it('每个属性的 key 唯一', () => {
    const keys = allProperties.map(prop => prop.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('枚举属性的默认值必须出现在选项里', () => {
    for (const prop of allProperties) {
      if (prop.kind === 'enum')
        expect(prop.options.map(option => option.value)).toContain(prop.default)
    }
  })

  it('数值属性的默认值落在取值区间内', () => {
    for (const prop of allProperties) {
      if (prop.kind === 'number') {
        expect(prop.default).toBeGreaterThanOrEqual(prop.min)
        expect(prop.default).toBeLessThanOrEqual(prop.max)
      }
    }
  })

  it('容器属性覆盖状态里所有可控字段（width/height 由拖拽控制，不在表内）', () => {
    const state = createDefaultState()
    const controllable = Object.keys(state.container).filter(key => key !== 'width' && key !== 'height')
    expect(containerProperties.map(prop => prop.key).sort()).toEqual(controllable.sort())
  })

  it('项目属性覆盖盒子状态里除 id 外的所有字段', () => {
    const state = createDefaultState()
    const controllable = Object.keys(state.items[0]).filter(key => key !== 'id')
    expect(itemProperties.map(prop => prop.key).sort()).toEqual(controllable.sort())
  })

  it('每个属性都带 MDN 链接与文案 key', () => {
    for (const prop of allProperties) {
      expect(prop.mdn).toMatch(/^https:\/\/developer\.mozilla\.org\//)
      expect(prop.labelKey.length).toBeGreaterThan(0)
    }
  })

  it('表里的默认值与 createDefaultState 一致', () => {
    const state = createDefaultState()
    for (const prop of containerProperties)
      expect(prop.default).toBe(state.container[prop.key as keyof typeof state.container])
    for (const prop of itemProperties)
      expect(prop.default).toBe(state.items[0][prop.key as keyof typeof state.items[0]])
  })
})

describe('flex 简写预设', () => {
  it('覆盖四种常见取值', () => {
    expect(flexShorthandPresets.map(preset => preset.label)).toEqual(['1', 'auto', 'initial', 'none'])
  })

  it('每个预设都展开成明确的三元组', () => {
    const byLabel = new Map(flexShorthandPresets.map(preset => [preset.label, preset]))
    expect(byLabel.get('1')).toMatchObject({ grow: 1, shrink: 1, basis: '0' })
    expect(byLabel.get('auto')).toMatchObject({ grow: 1, shrink: 1, basis: 'auto' })
    expect(byLabel.get('initial')).toMatchObject({ grow: 0, shrink: 1, basis: 'auto' })
    expect(byLabel.get('none')).toMatchObject({ grow: 0, shrink: 0, basis: 'auto' })
  })

  it('initial 预设与默认盒子一致', () => {
    const initial = flexShorthandPresets.find(preset => preset.label === 'initial')!
    const item = createDefaultState().items[0]
    expect([initial.grow, initial.shrink, initial.basis]).toEqual([item.grow, item.shrink, item.basis])
  })
})

describe('visibleOptions', () => {
  it('默认隐藏标记为 advanced 的近义值', () => {
    const justify = containerProperties.find(prop => prop.key === 'justifyContent')!
    if (justify.kind !== 'enum')
      throw new Error('justifyContent 应当是枚举属性')

    const common = visibleOptions(justify, false).map(option => option.value)
    const all = visibleOptions(justify, true).map(option => option.value)
    expect(common).toContain('space-between')
    expect(common).not.toContain('left')
    expect(all).toContain('left')
    expect(all.length).toBeGreaterThan(common.length)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/data/flexProperties.spec.ts`
Expected: FAIL，报错找不到模块 `./flexProperties`

- [ ] **Step 3: 写实现**

创建 `src/data/flexProperties.ts`：

```ts
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

export type PropertyDef =
  | (PropertyBase & { kind: 'enum', options: PropertyOption[], default: string })
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/data/flexProperties.spec.ts`
Expected: PASS，11 个用例全绿

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/data/flexProperties.ts src/data/flexProperties.spec.ts
git commit -m "feat(data): 添加驱动控制面板的属性元信息表"
```

---

### Task 8: 状态源 composable

**Files:**
- Create: `src/composables/useFlexState.ts`
- Test: `src/composables/useFlexState.spec.ts`

**Interfaces:**
- Consumes: `createDefaultState` / `createDefaultItem`（Task 1）、`deriveLayout`（Task 5）、`emitCss`（Task 6）
- Produces: `useFlexState()` 返回
  - `state: FlexState`（reactive 单例）
  - `selectedItem: ComputedRef<FlexItemState | null>`
  - `derived: ComputedRef<DerivedLayout>`
  - `css: ComputedRef<string>`
  - `addItem(): void` / `removeItem(id: string): void` / `selectItem(id: string | null): void` / `resetState(): void`
  - 常量 `MAX_ITEMS = 8`

- [ ] **Step 1: 写失败的测试**

创建 `src/composables/useFlexState.spec.ts`：

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_ITEMS, useFlexState } from './useFlexState'

describe('useFlexState', () => {
  beforeEach(() => {
    // 状态是模块级单例，每个用例前必须复位
    useFlexState().resetState()
  })

  it('初始为三个盒子且未选中', () => {
    const { state } = useFlexState()
    expect(state.items).toHaveLength(3)
    expect(state.selectedId).toBeNull()
  })

  it('多次调用共享同一份状态', () => {
    useFlexState().state.container.direction = 'column'
    expect(useFlexState().state.container.direction).toBe('column')
  })

  it('新增的盒子 id 不与已删除的重复', () => {
    const { state, addItem, removeItem } = useFlexState()
    removeItem('item-1')
    addItem()
    const ids = state.items.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('item-1')
  })

  it('盒子数量有上限，防止面板与演示区过载', () => {
    const { state, addItem } = useFlexState()
    for (let i = 0; i < 20; i++)
      addItem()
    expect(state.items).toHaveLength(MAX_ITEMS)
  })

  it('至少保留一个盒子', () => {
    const { state, removeItem } = useFlexState()
    for (const id of [...state.items.map(item => item.id)])
      removeItem(id)
    expect(state.items).toHaveLength(1)
  })

  it('删除选中的盒子会清空选中状态', () => {
    const { state, selectItem, removeItem } = useFlexState()
    selectItem('item-2')
    removeItem('item-2')
    expect(state.selectedId).toBeNull()
  })

  it('selectedItem 跟随选中 id', () => {
    const { selectedItem, selectItem } = useFlexState()
    expect(selectedItem.value).toBeNull()
    selectItem('item-2')
    expect(selectedItem.value?.id).toBe('item-2')
  })

  it('derived 与 css 随状态变化重新计算', () => {
    const { state, derived, css } = useFlexState()
    state.container.width = 600
    state.items.forEach((item) => {
      item.grow = 1
      item.basis = '0'
    })
    expect(derived.value.items[0].finalMainSize).toBe(192) // (600 - 24) / 3
    expect(css.value).toContain('flex: 1 1 0;')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/composables/useFlexState.spec.ts`
Expected: FAIL，报错找不到模块 `./useFlexState`

- [ ] **Step 3: 写实现**

创建 `src/composables/useFlexState.ts`：

```ts
import type { FlexItemState } from '~/core/types'
import { computed, reactive } from 'vue'
import { createDefaultItem, createDefaultState } from '~/core/defaults'
import { deriveLayout } from '~/core/deriveLayout'
import { emitCss } from '~/core/cssEmit'

/** 盒子数量上限：再多面板与演示区都会失去可读性 */
export const MAX_ITEMS = 8

const state = reactive(createDefaultState())

// 自增序号保证 id 唯一，删除后再新增不会撞号
let sequence = state.items.length

const selectedItem = computed<FlexItemState | null>(
  () => state.items.find(item => item.id === state.selectedId) ?? null,
)
const derived = computed(() => deriveLayout(state))
const css = computed(() => emitCss(state))

function selectItem(id: string | null): void {
  state.selectedId = id
}

function addItem(): void {
  if (state.items.length >= MAX_ITEMS)
    return
  state.items.push(createDefaultItem(`item-${++sequence}`))
}

function removeItem(id: string): void {
  // 至少留一个盒子，否则演示区没有任何可看的东西
  if (state.items.length <= 1)
    return

  const index = state.items.findIndex(item => item.id === id)
  if (index === -1)
    return

  state.items.splice(index, 1)
  if (state.selectedId === id)
    state.selectedId = null
}

function resetState(): void {
  Object.assign(state, createDefaultState())
  sequence = state.items.length
}

/** 全站唯一的状态源 */
export function useFlexState() {
  return { state, selectedItem, derived, css, selectItem, addItem, removeItem, resetState }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/composables/useFlexState.spec.ts`
Expected: PASS，8 个用例全绿

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/composables/useFlexState.ts src/composables/useFlexState.spec.ts
git commit -m "feat(composables): 添加唯一状态源 useFlexState"
```

---

### Task 9: 演示区组件

**Files:**
- Create: `src/components/playground/DemoStage.vue`
- Test: `src/components/playground/DemoStage.spec.ts`

**Interfaces:**
- Consumes: `useFlexState`（Task 8）、`isRowDirection`（Task 1）
- Produces: `DemoStage` 组件。DOM 约定：容器带 `data-testid="stage"`，每个盒子带 `data-testid="stage-item"` 与 `data-item-id="<id>"`，选中的盒子带 class `is-selected`

- [ ] **Step 1: 写失败的测试**

创建 `src/components/playground/DemoStage.spec.ts`：

```ts
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import DemoStage from './DemoStage.vue'

describe('demoStage', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('按状态渲染出对应数量的盒子', () => {
    const wrapper = mount(DemoStage)
    expect(wrapper.findAll('[data-testid="stage-item"]')).toHaveLength(3)
  })

  it('容器样式直接来自状态，保证是真实 CSS 渲染', () => {
    const { state } = useFlexState()
    state.container.direction = 'column'
    state.container.justifyContent = 'space-between'
    const wrapper = mount(DemoStage)
    const style = wrapper.get('[data-testid="stage"]').attributes('style')!
    expect(style).toContain('flex-direction: column')
    expect(style).toContain('justify-content: space-between')
  })

  it('盒子样式写出 flex 三个分量', () => {
    const { state } = useFlexState()
    state.items[0].grow = 2
    state.items[0].basis = '120px'
    const wrapper = mount(DemoStage)
    const style = wrapper.findAll('[data-testid="stage-item"]')[0].attributes('style')!
    expect(style).toContain('flex-grow: 2')
    expect(style).toContain('flex-basis: 120px')
  })

  it('关闭 min-width:auto 时写入 min-width: 0px', () => {
    const { state } = useFlexState()
    state.items[0].minWidthAuto = false
    const wrapper = mount(DemoStage)
    expect(wrapper.findAll('[data-testid="stage-item"]')[0].attributes('style')).toContain('min-width: 0px')
  })

  it('点击盒子会选中它', async () => {
    const wrapper = mount(DemoStage)
    await wrapper.findAll('[data-testid="stage-item"]')[1].trigger('click')
    expect(useFlexState().state.selectedId).toBe('item-2')
  })

  it('选中的盒子带 is-selected 标记', async () => {
    const wrapper = mount(DemoStage)
    useFlexState().selectItem('item-3')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-testid="stage-item"]')[2].classes()).toContain('is-selected')
  })

  it('回车键与点击等价，保证键盘可达', async () => {
    const wrapper = mount(DemoStage)
    await wrapper.findAll('[data-testid="stage-item"]')[0].trigger('keydown.enter')
    expect(useFlexState().state.selectedId).toBe('item-1')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/DemoStage.spec.ts`
Expected: FAIL，报错找不到模块 `./DemoStage.vue`

- [ ] **Step 3: 写实现**

创建 `src/components/playground/DemoStage.vue`：

```vue
<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { FlexItemState } from '~/core/types'
import { computed } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { isRowDirection } from '~/core/axis'

const { state, selectItem } = useFlexState()

const isRow = computed(() => isRowDirection(state.container.direction))

// 容器样式全部来自状态，交给浏览器真实排版——不做任何位置计算
const containerStyle = computed<CSSProperties>(() => ({
  display: state.container.display,
  flexDirection: state.container.direction,
  flexWrap: state.container.wrap,
  justifyContent: state.container.justifyContent,
  alignItems: state.container.alignItems,
  alignContent: state.container.alignContent,
  rowGap: `${state.container.rowGap}px`,
  columnGap: `${state.container.columnGap}px`,
  width: `${state.container.width}px`,
  height: `${state.container.height}px`,
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

function label(index: number): string {
  return String.fromCharCode(65 + index)
}
</script>

<template>
  <div
    data-testid="stage"
    class="relative overflow-hidden panel"
    :style="containerStyle"
  >
    <div
      v-for="(item, index) in state.items"
      :key="item.id"
      data-testid="stage-item"
      :data-item-id="item.id"
      class="stage-item"
      :class="{ 'is-selected': state.selectedId === item.id }"
      tabindex="0"
      :style="itemStyle(item)"
      @click="selectItem(item.id)"
      @keydown.enter="selectItem(item.id)"
    >
      <div class="content" :style="contentStyle(item)">
        {{ label(index) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-item {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.stage-item:focus-visible,
.stage-item.is-selected {
  border-color: var(--accent-2);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-2) 45%, transparent);
  outline: none;
}

.content {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono, monospace);
}
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/components/playground/DemoStage.spec.ts`
Expected: PASS，7 个用例全绿

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/components/playground/DemoStage.vue src/components/playground/DemoStage.spec.ts
git commit -m "feat(playground): 添加真实 CSS 渲染的演示区"
```

---

### Task 10: 容器属性控件（表驱动）

**Files:**
- Create: `src/components/playground/PropertyField.vue`
- Create: `src/components/playground/ContainerControls.vue`
- Test: `src/components/playground/ContainerControls.spec.ts`

**Interfaces:**
- Consumes: `containerProperties` / `visibleOptions` / `PropertyDef`（Task 7）、`useFlexState`（Task 8）
- Produces:
  - `PropertyField` 组件，props: `{ prop: PropertyDef, modelValue: string | number | boolean, showAdvanced: boolean }`，emit: `update:modelValue`
  - `ContainerControls` 组件。DOM 约定：枚举选项按钮带 `data-testid="option"` 与 `data-value="<值>"`，「更多值」按钮带 `data-testid="toggle-advanced"`

- [ ] **Step 1: 写失败的测试**

创建 `src/components/playground/ContainerControls.spec.ts`：

```ts
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import { containerProperties } from '~/data/flexProperties'
import ContainerControls from './ContainerControls.vue'

describe('containerControls', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('为表里每个容器属性都渲染一组控件', () => {
    const wrapper = mount(ContainerControls)
    for (const prop of containerProperties)
      expect(wrapper.text()).toContain(prop.cssName)
  })

  it('点击枚举选项写回状态', async () => {
    const wrapper = mount(ContainerControls)
    await wrapper.get('[data-value="column"]').trigger('click')
    expect(useFlexState().state.container.direction).toBe('column')
  })

  it('默认不展示 advanced 选项，展开后可见', async () => {
    const wrapper = mount(ContainerControls)
    expect(wrapper.find('[data-value="left"]').exists()).toBe(false)
    await wrapper.get('[data-testid="toggle-advanced"]').trigger('click')
    expect(wrapper.find('[data-value="left"]').exists()).toBe(true)
  })

  it('数值控件写回状态且为数字类型', async () => {
    const wrapper = mount(ContainerControls)
    const input = wrapper.get('input[type="range"]')
    await input.setValue('24')
    const { state } = useFlexState()
    expect(state.container.rowGap).toBe(24)
    expect(typeof state.container.rowGap).toBe('number')
  })

  it('当前值对应的选项带 is-active 标记', () => {
    useFlexState().state.container.justifyContent = 'center'
    const wrapper = mount(ContainerControls)
    expect(wrapper.get('[data-value="center"]').classes()).toContain('is-active')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/ContainerControls.spec.ts`
Expected: FAIL，报错找不到模块 `./ContainerControls.vue`

- [ ] **Step 3: 写实现**

创建 `src/components/playground/PropertyField.vue`：

```vue
<script setup lang="ts">
import type { PropertyDef } from '~/data/flexProperties'
import { visibleOptions } from '~/data/flexProperties'

const props = defineProps<{
  prop: PropertyDef
  modelValue: string | number | boolean
  showAdvanced: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
}>()

function onNumberInput(event: Event): void {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value))
}

function onTextInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="mb-3">
    <div class="mb-1 flex items-center justify-between text-xs op-70">
      <a :href="props.prop.mdn" target="_blank" rel="noopener" class="font-mono hover:underline">
        {{ props.prop.cssName }}
      </a>
      <span v-if="props.prop.kind === 'number'" class="font-mono">{{ props.modelValue }}</span>
    </div>

    <div v-if="props.prop.kind === 'enum'" class="flex flex-wrap gap-1">
      <button
        v-for="option in visibleOptions(props.prop, props.showAdvanced)"
        :key="option.value"
        data-testid="option"
        :data-value="option.value"
        class="option"
        :class="{ 'is-active': props.modelValue === option.value }"
        @click="emit('update:modelValue', option.value)"
      >
        {{ option.value }}
      </button>
    </div>

    <input
      v-else-if="props.prop.kind === 'number'"
      type="range"
      class="w-full"
      :min="props.prop.min"
      :max="props.prop.max"
      :step="props.prop.step"
      :value="props.modelValue"
      @input="onNumberInput"
    >

    <div v-else-if="props.prop.kind === 'text'" class="flex flex-wrap gap-1">
      <button
        v-for="preset in props.prop.presets"
        :key="preset"
        data-testid="option"
        :data-value="preset"
        class="option"
        :class="{ 'is-active': props.modelValue === preset }"
        @click="emit('update:modelValue', preset)"
      >
        {{ preset }}
      </button>
      <input
        class="w-20 border border-bd rounded-1 bg-transparent px-2 py-1 text-xs font-mono"
        :value="props.modelValue"
        @input="onTextInput"
      >
    </div>

    <label v-else class="flex cursor-pointer items-center gap-2 text-xs">
      <input
        type="checkbox"
        :checked="Boolean(props.modelValue)"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      >
      <span>{{ props.modelValue ? '开启' : '关闭' }}</span>
    </label>
  </div>
</template>

<style scoped>
.option {
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  color: inherit;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.option:hover {
  border-color: var(--accent);
}

.option.is-active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
</style>
```

创建 `src/components/playground/ContainerControls.vue`：

```vue
<script setup lang="ts">
import type { FlexContainerState } from '~/core/types'
import { ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { containerProperties } from '~/data/flexProperties'
import PropertyField from './PropertyField.vue'

const { state } = useFlexState()
const showAdvanced = ref(false)

function valueOf(key: string): string | number | boolean {
  return state.container[key as keyof FlexContainerState]
}

function update(key: string, value: string | number | boolean): void {
  // 属性表的 key 与状态字段一一对应，这里做一次宽松写入
  ;(state.container as Record<string, unknown>)[key] = value
}
</script>

<template>
  <section>
    <header class="mb-2 flex items-center justify-between">
      <h2 class="text-sm font-bold">
        容器属性
      </h2>
      <button
        data-testid="toggle-advanced"
        class="text-xs op-60 hover:op-100"
        @click="showAdvanced = !showAdvanced"
      >
        {{ showAdvanced ? '收起更多值' : '更多值' }}
      </button>
    </header>

    <PropertyField
      v-for="prop in containerProperties"
      :key="prop.key"
      :prop="prop"
      :show-advanced="showAdvanced"
      :model-value="valueOf(prop.key)"
      @update:model-value="update(prop.key, $event)"
    />
  </section>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/components/playground/ContainerControls.spec.ts`
Expected: PASS，5 个用例全绿

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/components/playground/PropertyField.vue src/components/playground/ContainerControls.vue src/components/playground/ContainerControls.spec.ts
git commit -m "feat(playground): 添加表驱动的容器属性控件"
```

---

### Task 11: 选中盒子的属性控件与盒子列表

**Files:**
- Create: `src/components/playground/ItemControls.vue`
- Create: `src/components/playground/ItemList.vue`
- Test: `src/components/playground/ItemControls.spec.ts`

**Interfaces:**
- Consumes: `itemProperties`（Task 7）、`useFlexState` / `MAX_ITEMS`（Task 8）、`PropertyField`（Task 10）
- Produces:
  - `ItemControls` 组件。标题带 `data-testid="item-title"`，未选中时显示提示文案 `data-testid="item-empty"`，flex 简写预设按钮带 `data-testid="flex-preset"` 与 `data-preset="<label>"`
  - `ItemList` 组件。每行带 `data-testid="item-row"`，新增按钮 `data-testid="add-item"`，删除按钮 `data-testid="remove-item"`

- [ ] **Step 1: 写失败的测试**

创建 `src/components/playground/ItemControls.spec.ts`：

```ts
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_ITEMS, useFlexState } from '~/composables/useFlexState'
import ItemControls from './ItemControls.vue'
import ItemList from './ItemList.vue'

describe('itemControls', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('未选中盒子时给出提示而不是空白面板', () => {
    const wrapper = mount(ItemControls)
    expect(wrapper.find('[data-testid="item-empty"]').exists()).toBe(true)
  })

  it('选中后渲染该盒子的属性控件', async () => {
    const wrapper = mount(ItemControls)
    useFlexState().selectItem('item-2')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="item-empty"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('flex-grow')
    expect(wrapper.text()).toContain('flex-basis')
  })

  it('改动只作用于当前选中的盒子', async () => {
    const { state, selectItem } = useFlexState()
    const wrapper = mount(ItemControls)
    selectItem('item-2')
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-value="0"]').trigger('click')
    expect(state.items[1].basis).toBe('0')
    expect(state.items[0].basis).toBe('auto')
  })

  it('flex 简写预设一次回填三个分量', async () => {
    const { state, selectItem } = useFlexState()
    const wrapper = mount(ItemControls)
    selectItem('item-1')
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-preset="1"]').trigger('click')
    expect(state.items[0]).toMatchObject({ grow: 1, shrink: 1, basis: '0' })

    await wrapper.get('[data-preset="none"]').trigger('click')
    expect(state.items[0]).toMatchObject({ grow: 0, shrink: 0, basis: 'auto' })
  })

  it('当前三元组与某个预设吻合时该预设高亮', async () => {
    const { state, selectItem } = useFlexState()
    const wrapper = mount(ItemControls)
    selectItem('item-1')
    state.items[0].grow = 1
    state.items[0].shrink = 1
    state.items[0].basis = 'auto'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-preset="auto"]').classes()).toContain('is-active')
    expect(wrapper.get('[data-preset="none"]').classes()).not.toContain('is-active')
  })
})

describe('itemList', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('列出全部盒子', () => {
    expect(mount(ItemList).findAll('[data-testid="item-row"]')).toHaveLength(3)
  })

  it('新增按钮追加盒子', async () => {
    const wrapper = mount(ItemList)
    await wrapper.get('[data-testid="add-item"]').trigger('click')
    expect(useFlexState().state.items).toHaveLength(4)
  })

  it('到达上限后新增按钮禁用', async () => {
    const { addItem } = useFlexState()
    for (let i = 0; i < MAX_ITEMS; i++)
      addItem()
    const wrapper = mount(ItemList)
    expect(wrapper.get('[data-testid="add-item"]').attributes('disabled')).toBeDefined()
  })

  it('删除按钮移除对应盒子', async () => {
    const wrapper = mount(ItemList)
    await wrapper.findAll('[data-testid="remove-item"]')[0].trigger('click')
    const { state } = useFlexState()
    expect(state.items).toHaveLength(2)
    expect(state.items.map(item => item.id)).not.toContain('item-1')
  })

  it('点击行选中该盒子', async () => {
    const wrapper = mount(ItemList)
    await wrapper.findAll('[data-testid="item-row"]')[2].trigger('click')
    expect(useFlexState().state.selectedId).toBe('item-3')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/ItemControls.spec.ts`
Expected: FAIL，报错找不到模块 `./ItemControls.vue`

- [ ] **Step 3: 写实现**

创建 `src/components/playground/ItemControls.vue`：

```vue
<script setup lang="ts">
import type { FlexItemState } from '~/core/types'
import type { FlexShorthandPreset } from '~/data/flexProperties'
import { ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { flexShorthandPresets, itemProperties } from '~/data/flexProperties'
import PropertyField from './PropertyField.vue'

const { selectedItem } = useFlexState()
const showAdvanced = ref(false)

function valueOf(item: FlexItemState, key: string): string | number | boolean {
  return item[key as keyof FlexItemState]
}

function update(item: FlexItemState, key: string, value: string | number | boolean): void {
  ;(item as Record<string, unknown>)[key] = value
}

/** flex 简写是一次写三个分量，这里直接回填，让用户看到简写到底展开成了什么 */
function applyPreset(item: FlexItemState, preset: FlexShorthandPreset): void {
  item.grow = preset.grow
  item.shrink = preset.shrink
  item.basis = preset.basis
}

function isPresetActive(item: FlexItemState, preset: FlexShorthandPreset): boolean {
  return item.grow === preset.grow && item.shrink === preset.shrink && item.basis === preset.basis
}
</script>

<template>
  <section>
    <header class="mb-2 flex items-center justify-between">
      <h2 data-testid="item-title" class="text-sm font-bold">
        盒子属性<template v-if="selectedItem"> · {{ selectedItem.id }}</template>
      </h2>
    </header>

    <p v-if="!selectedItem" data-testid="item-empty" class="text-xs op-60">
      点击演示区里的任意盒子来编辑它的属性
    </p>

    <template v-else>
      <div class="mb-3">
        <div class="mb-1 text-xs op-70">
          <span class="font-mono">flex</span> 简写
        </div>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="preset in flexShorthandPresets"
            :key="preset.label"
            data-testid="flex-preset"
            :data-preset="preset.label"
            class="preset"
            :class="{ 'is-active': isPresetActive(selectedItem, preset) }"
            @click="applyPreset(selectedItem, preset)"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>

      <PropertyField
        v-for="prop in itemProperties"
        :key="prop.key"
        :prop="prop"
        :show-advanced="showAdvanced"
        :model-value="valueOf(selectedItem, prop.key)"
        @update:model-value="update(selectedItem, prop.key, $event)"
      />
    </template>
  </section>
</template>

<style scoped>
.preset {
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  color: inherit;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.preset:hover {
  border-color: var(--accent-2);
}

.preset.is-active {
  border-color: var(--accent-2);
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
}
</style>
```

创建 `src/components/playground/ItemList.vue`：

```vue
<script setup lang="ts">
import { MAX_ITEMS, useFlexState } from '~/composables/useFlexState'

const { state, addItem, removeItem, selectItem } = useFlexState()

function label(index: number): string {
  return String.fromCharCode(65 + index)
}
</script>

<template>
  <section>
    <header class="mb-2 flex items-center justify-between">
      <h2 class="text-sm font-bold">
        盒子（{{ state.items.length }}/{{ MAX_ITEMS }}）
      </h2>
      <button
        data-testid="add-item"
        class="btn text-xs"
        :disabled="state.items.length >= MAX_ITEMS"
        @click="addItem()"
      >
        新增
      </button>
    </header>

    <ul class="flex flex-col gap-1">
      <li
        v-for="(item, index) in state.items"
        :key="item.id"
        data-testid="item-row"
        class="flex cursor-pointer items-center justify-between border border-bd rounded-1 px-2 py-1 text-xs"
        :class="{ 'border-accent text-accent': state.selectedId === item.id }"
        @click="selectItem(item.id)"
      >
        <span class="font-mono">{{ label(index) }} · flex: {{ item.grow }} {{ item.shrink }} {{ item.basis }}</span>
        <button
          data-testid="remove-item"
          class="op-60 hover:op-100"
          :disabled="state.items.length <= 1"
          @click.stop="removeItem(item.id)"
        >
          删除
        </button>
      </li>
    </ul>
  </section>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/components/playground/ItemControls.spec.ts`
Expected: PASS，10 个用例全绿

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/components/playground/ItemControls.vue src/components/playground/ItemList.vue src/components/playground/ItemControls.spec.ts
git commit -m "feat(playground): 添加盒子属性控件与盒子列表"
```

---

### Task 12: CSS 输出与复制

**Files:**
- Create: `src/components/playground/CssOutput.vue`
- Test: `src/components/playground/CssOutput.spec.ts`

**Interfaces:**
- Consumes: `useFlexState`（Task 8）、`prismjs`
- Produces: `CssOutput` 组件。代码区 `data-testid="css-code"`，复制按钮 `data-testid="copy-css"`

- [ ] **Step 1: 写失败的测试**

创建 `src/components/playground/CssOutput.spec.ts`：

```ts
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import CssOutput from './CssOutput.vue'

describe('cssOutput', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('渲染当前状态对应的 CSS', () => {
    const wrapper = mount(CssOutput)
    const code = wrapper.get('[data-testid="css-code"]').text()
    expect(code).toContain('display: flex')
    expect(code).toContain('.item-1')
  })

  it('状态变化后 CSS 同步更新', async () => {
    const { state } = useFlexState()
    const wrapper = mount(CssOutput)
    state.container.justifyContent = 'space-evenly'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="css-code"]').text()).toContain('justify-content: space-evenly')
  })

  it('点击复制把 CSS 写入剪贴板', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const wrapper = mount(CssOutput)
    await wrapper.get('[data-testid="copy-css"]').trigger('click')

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0][0]).toContain('display: flex')
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/CssOutput.spec.ts`
Expected: FAIL，报错找不到模块 `./CssOutput.vue`

- [ ] **Step 3: 写实现**

创建 `src/components/playground/CssOutput.vue`：

```vue
<script setup lang="ts">
import Prism from 'prismjs'
import { computed, ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'

// css 是 Prism 核心自带的语言，无需额外 import 语法包
const { css } = useFlexState()
const copied = ref(false)

const highlighted = computed(() => Prism.highlight(css.value, Prism.languages.css, 'css'))

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(css.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <section class="panel p-3">
    <header class="mb-2 flex items-center justify-between">
      <h2 class="text-sm font-bold">
        CSS
      </h2>
      <button data-testid="copy-css" class="btn text-xs" @click="copy()">
        {{ copied ? '已复制' : '复制' }}
      </button>
    </header>

    <pre
      data-testid="css-code"
      class="overflow-x-auto text-xs font-mono leading-relaxed"
    ><code v-html="highlighted" /></pre>
  </section>
</template>
```

> 注：`v-html` 的输入是 Prism 对本地生成的 CSS 字符串做的高亮结果，不含用户输入的任意 HTML，这里不存在注入面。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/components/playground/CssOutput.spec.ts`
Expected: PASS，3 个用例全绿

- [ ] **Step 5: lint 并提交**

```bash
pnpm lint:fix && pnpm lint
git add src/components/playground/CssOutput.vue src/components/playground/CssOutput.spec.ts
git commit -m "feat(playground): 添加 CSS 输出与复制"
```

---

### Task 13: 组装 Playground 并接入应用

**Files:**
- Create: `src/components/playground/ThePlayground.vue`
- Modify: `src/App.vue`（整体替换为挂载 Playground 的骨架）
- Test: `src/components/playground/ThePlayground.spec.ts`

**Interfaces:**
- Consumes: `DemoStage`（Task 9）、`ContainerControls`（Task 10）、`ItemControls` / `ItemList`（Task 11）、`CssOutput`（Task 12）、`useFlexState`（Task 8）
- Produces: `ThePlayground` 组件，含容器尺寸滑块（`data-testid="stage-width"` / `data-testid="stage-height"`）与重置按钮（`data-testid="reset"`）

- [ ] **Step 1: 写失败的测试**

创建 `src/components/playground/ThePlayground.spec.ts`：

```ts
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import ThePlayground from './ThePlayground.vue'

describe('thePlayground', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('同时渲染操作区、演示区与 CSS 输出', () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.find('[data-testid="stage"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="css-code"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('容器属性')
    expect(wrapper.text()).toContain('盒子属性')
  })

  it('容器宽度滑块改变演示区尺寸', async () => {
    const wrapper = mount(ThePlayground)
    await wrapper.get('[data-testid="stage-width"]').setValue('480')
    expect(useFlexState().state.container.width).toBe(480)
    expect(wrapper.get('[data-testid="stage"]').attributes('style')).toContain('width: 480px')
  })

  it('在演示区选中盒子后，属性面板切换到该盒子', async () => {
    const wrapper = mount(ThePlayground)
    await wrapper.findAll('[data-testid="stage-item"]')[1].trigger('click')
    expect(wrapper.get('[data-testid="item-title"]').text()).toContain('item-2')
    expect(wrapper.find('[data-testid="item-empty"]').exists()).toBe(false)
  })

  it('重置按钮恢复默认状态', async () => {
    const { state } = useFlexState()
    state.container.direction = 'column'
    const wrapper = mount(ThePlayground)
    await wrapper.get('[data-testid="reset"]').trigger('click')
    expect(state.container.direction).toBe('row')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/ThePlayground.spec.ts`
Expected: FAIL，报错找不到模块 `./ThePlayground.vue`

- [ ] **Step 3: 写实现**

创建 `src/components/playground/ThePlayground.vue`：

```vue
<script setup lang="ts">
import { useFlexState } from '~/composables/useFlexState'
import ContainerControls from './ContainerControls.vue'
import CssOutput from './CssOutput.vue'
import DemoStage from './DemoStage.vue'
import ItemControls from './ItemControls.vue'
import ItemList from './ItemList.vue'

const { state, resetState } = useFlexState()

function setWidth(event: Event): void {
  state.container.width = Number((event.target as HTMLInputElement).value)
}

function setHeight(event: Event): void {
  state.container.height = Number((event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="grid mx-auto max-w-360 w-full gap-4 p-4 lg:grid-cols-[320px_1fr]">
    <!-- 操作区 -->
    <aside class="panel h-fit flex flex-col gap-5 p-3">
      <ContainerControls />
      <ItemList />
      <ItemControls />
      <button data-testid="reset" class="btn text-xs" @click="resetState()">
        重置为默认状态
      </button>
    </aside>

    <!-- 演示区 + CSS 输出 -->
    <main class="flex flex-col gap-4">
      <div class="panel p-3">
        <div class="mb-3 flex flex-wrap items-center gap-4 text-xs">
          <label class="flex items-center gap-2">
            <span class="op-70">容器宽</span>
            <input
              data-testid="stage-width"
              type="range"
              min="200"
              max="1200"
              step="10"
              :value="state.container.width"
              @input="setWidth"
            >
            <span class="w-12 font-mono">{{ state.container.width }}px</span>
          </label>
          <label class="flex items-center gap-2">
            <span class="op-70">容器高</span>
            <input
              data-testid="stage-height"
              type="range"
              min="120"
              max="600"
              step="10"
              :value="state.container.height"
              @input="setHeight"
            >
            <span class="w-12 font-mono">{{ state.container.height }}px</span>
          </label>
        </div>

        <div class="overflow-auto">
          <DemoStage />
        </div>
      </div>

      <CssOutput />
    </main>
  </div>
</template>
```

修改 `src/App.vue`，整体替换为：

```vue
<script setup lang="ts">
import ThePlayground from '~/components/playground/ThePlayground.vue'
</script>

<template>
  <div class="min-h-full font-sans">
    <header class="mx-auto max-w-360 w-full flex items-center justify-between p-4">
      <div>
        <h1 class="text-lg font-bold font-mono">
          todo-flex
        </h1>
        <p class="text-xs op-60">
          看得见的 CSS Flexbox
        </p>
      </div>
      <button class="btn text-xs" @click="toggleDark()">
        {{ isDark ? '暗色' : '亮色' }}
      </button>
    </header>

    <ThePlayground />
  </div>
</template>
```

- [ ] **Step 4: 跑全量验证**

```bash
pnpm vitest run src/components/playground/ThePlayground.spec.ts
pnpm test
pnpm lint:fix && pnpm lint
pnpm build
```

Expected:
- ThePlayground 4 个用例全绿
- 全量测试全绿（累计 94 个用例）
- lint 零 error
- `vue-tsc --noEmit` 通过且 `vite build` 成功

- [ ] **Step 5: 提交**

```bash
# 构建会刷新 auto-imports.d.ts / components.d.ts 等生成文件，一并纳入
git add -A
git commit -m "feat(playground): 组装三区布局并接入应用"
```

---

## 完成标准

M1 + M2 全部交付后，站点应当满足：

1. `pnpm test` 全绿，`src/core/` 与 `src/data/` 下的纯函数有完整用例覆盖。
2. `pnpm lint` 零 error，`pnpm build` 通过类型检查与构建。
3. 打开 `pnpm dev`，可以：改容器全部属性 → 演示区真实渲染跟随变化；点选盒子 → 编辑它的 item 级属性；增删盒子；拖动滑块改容器尺寸并观察换行与收缩；复制生成的 CSS。
4. 演示区没有任何一处由 JS 计算盒子位置——全部交给浏览器排版。

## 下一步（不在本计划内）

M3「透明化核心」：观测层（`useMeasure`，用 ResizeObserver + offsetLeft，**禁用 getBoundingClientRect**）、诊断层（理论 vs 实际比对）、明细表、剩余空间与轴向 SVG 叠加层、容器拖拽手柄。这是站点的差异化所在，将单独出一份计划。
