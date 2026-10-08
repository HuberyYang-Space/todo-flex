# 公式展开 Implementation Plan

> **状态：2026-10-08 已按本计划实施完毕并上线。这是过程记录，不是待办清单。** 进度以 git 历史与
> [progress.md 的公式展开节](../../progress.md#公式展开2026-10-08)为准；执行中对本计划的偏差与终审修复也记在那一节。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在底部「理论 vs 实际」面板加一个「推导过程」标签页，把选中盒子从 basis 到最终尺寸的理论推导逐步摊成四列表格（步骤 | 公式 | 代入 | 结果），末行对照浏览器实际值与诊断。

**Architecture:** 推导引擎 `distributeShrink` 补记冻结循环的每一轮并挂到 `DerivedLine.shrinkRounds`；`src/core/explain.ts` 的纯函数 `explainItem` 只读 `deriveLayout` 的输出、把它编排成以 `kind` 区分的步骤数组（只有数值）；展示层 `DerivationSteps.vue` 把步骤映射成中文文案，`ComparePanel.vue` 用 WAI-ARIA tabs 承载明细表与推导页，诊断经 `useDiagnostics()` 两页共用。

**Tech Stack:** Vue 3.5 `<script setup>` + TypeScript 6 + vitest 5 + happy-dom + @vue/test-utils + UnoCSS + @vueuse/core 14；新增 devDependency fast-check。

**Spec:** [2026-10-08-formula-expansion-design.md](../specs/2026-10-08-formula-expansion-design.md)——执行者先读 spec 再读本计划。

## Global Constraints

- 代码注释、界面文案、提交信息一律简体中文；**不要徒增注释**，只写代码表达不出的「为什么」。
- `src/core/` 零 DOM、零 vue 依赖；core 模块之间的 import 显式写。
- 推导引擎**不模拟 `min-width: auto`**（CLAUDE.md 红线 3），本计划不碰这条。
- vue、@vueuse/core 的 API 与 `src/composables/` 的导出由自动导入注入，组件由 unplugin-vue-components 注入，**组件与 composable 里不手写这些 import**。`auto-imports.d.ts` / `components.d.ts` 是生成物，跑测试或类型检查时会被重写，跟着引入它们的那个提交走。
- 包管理器 pnpm；TypeScript 锁 6.x，已有依赖不升级；fast-check 取最新稳定版（写计划时为 4.10.2）。
- 每个任务结束走 `/commit` skill 提交（不手写 `git commit`，不加 Co-Authored-By），工作分支 `dev`，**不推送**。
- 观测层禁止 `getBoundingClientRect()`（红线 5）；浏览器探针里拿它做标准答案不受此限。
- 数字显示：结果 1 位小数加 `px`；负号用 `−`（U+2212）；grow / shrink 因子保留 2 位小数。叠加层标签保留现有的 `-`，不改（标签宽度估算按码位分档，换成 U+2212 会让估值偏宽 4px）。
- 浏览器验证以 DOM 与 console 为准，不以截图为准。

## Review Focus

1. **选中的盒子被删掉**：`removeItem` 会清空 `selectedId`，推导页应回到空状态提示、不抛错 → Task 6 的测试。
2. **观测还没产生**（首帧、刚增删盒子）：实际行写 `—`，不打 ✓ → Task 6 的测试。
3. **`flex-direction: column`**：主轴是 `height`，gap 取 `rowGap` 而不是 `columnGap` → Task 3 的测试。
4. **`order` 打乱 + `wrap-reverse`**：分行累加按 order 顺序，「第 N 行」按视觉行序，「下一个放不下的盒子」取 order 顺序上的下一个 → Task 3 的测试。
5. **停在推导页时改属性**：表格必须实时跟着变，不能停在旧值 → Task 6 的测试。

---

## 文件结构

| 文件 | 动作 | 职责 |
| --- | --- | --- |
| `src/core/labels.ts` | 改 | 增 `roundTenth` / `formatNumber` / `px`：全站唯一的数字显示格式 |
| `src/core/types.ts` | 改 | 增 `ShrinkRound`、`BasisForm`、`ExplainStep`；`DerivedLine` 增 `shrinkRounds` |
| `src/core/distribute.ts` | 改 | `distributeShrink` 返回 `{ deltas, rounds }` |
| `src/core/deriveLayout.ts` | 改 | 把轮次挂到行上 |
| `src/core/explain.ts` | 新 | `explainItem`：只编排不重算 |
| `src/core/explain.spec.ts` | 新 | 各步骤的单元测试 + fast-check 随机守卫 |
| `src/composables/useDiagnostics.ts` | 新 | 诊断计算与文案，明细表与推导页共用 |
| `src/components/playground/DiagnosisText.vue` | 新 | 一条诊断的图标 + 文案（属性名不断行） |
| `src/components/playground/MetricsTable.vue` | 改 | 改用 `useDiagnostics` 与 `DiagnosisText`，行为不变 |
| `src/components/playground/DerivationSteps.vue` | 新 | 推导页四列表格 |
| `src/components/playground/ComparePanel.vue` | 新 | 底部面板 + 两个标签页 |
| `src/components/playground/ThePlayground.vue` | 改 | 底部面板换成 `<ComparePanel />` |
| `src/components/playground/OverlayLayer.vue` | 改 | 本地 `round` 换成 `roundTenth` |

---

### Task 1: 数字显示格式合成一处

**Files:**
- Modify: `src/core/labels.ts`
- Modify: `src/core/labels.spec.ts`
- Modify: `src/components/playground/MetricsTable.vue`（删掉本地 `px`，改用 `~/core/labels` 的）
- Modify: `src/components/playground/OverlayLayer.vue:103-105`（删掉本地 `round`，改用 `roundTenth`）

**Interfaces:**
- Produces: `roundTenth(value: number): number`、`formatNumber(value: number, digits?: number): string`、`px(value: number): string`，都从 `~/core/labels` 导出。

- **Step 1: 写失败的测试**

在 `src/core/labels.spec.ts` 末尾追加，并把首行 import 改成 `import { formatNumber, itemLabel, px, roundTenth } from './labels'`：

```ts
describe('数字显示', () => {
  it('保留 1 位小数', () => {
    expect(roundTenth(306.666)).toBe(306.7)
    expect(px(306.666)).toBe('306.7px')
  })

  it('负数用数学负号 U+2212，读作减号而不是连字符', () => {
    expect(formatNumber(-47.647)).toBe('−47.6')
    expect(px(-190)).toBe('−190px')
  })

  it('舍入到 0 的负数不显示成 −0', () => {
    expect(formatNumber(-0.04)).toBe('0')
  })

  it('因子可以多留一位小数', () => {
    expect(formatNumber(0.333, 2)).toBe('0.33')
    expect(formatNumber(1, 2)).toBe('1')
  })
})
```

- **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/labels.spec.ts`
Expected: FAIL，`roundTenth` / `formatNumber` / `px` 未导出。

- **Step 3: 实现**

`src/core/labels.ts` 追加：

```ts
export function roundTenth(value: number): number {
  return Math.round(value * 10) / 10
}

/** 推导表里负数紧跟在 × 与 − 后面，连字符会被读成另一个减号 */
export function formatNumber(value: number, digits = 1): string {
  const scale = 10 ** digits
  const rounded = Math.round(value * scale) / scale
  return rounded < 0 ? `−${-rounded}` : `${rounded === 0 ? 0 : rounded}`
}

export function px(value: number): string {
  return `${formatNumber(value)}px`
}
```

`MetricsTable.vue`：删掉本地 `function px(...)`，在 `import { itemLabel } from '~/core/labels'` 那行改成 `import { itemLabel, px } from '~/core/labels'`。

`OverlayLayer.vue`：删掉第 103–105 行的 `function round(...)`，import 那行改成 `import { itemLabel, roundTenth } from '~/core/labels'`，文件内所有 `round(` 调用改成 `roundTenth(`（共 5 处：第 64 行两处、第 94 行两处、第 95 行一处）。

- **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/core/labels.spec.ts src/components/playground/MetricsTable.spec.ts src/components/playground/OverlayLayer.spec.ts`
Expected: 全部 PASS。

- **Step 5: 提交**

走 `/commit`，提交信息：`refactor: 数字显示格式合成一处，负数改用数学负号`

---

### Task 2: 引擎记下冻结循环的每一轮

**Files:**
- Modify: `src/core/types.ts`（增 `ShrinkRound`，`DerivedLine` 增 `shrinkRounds`）
- Modify: `src/core/distribute.ts:45-87`
- Modify: `src/core/deriveLayout.ts:33,52-62`
- Test: `src/core/distribute.spec.ts`、`src/core/deriveLayout.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ShrinkRound {
    overflow: number
    factorSum: number
    effective: number
    weightSum: number
    frozen: { id: string, share: number }[]
  }
  // DerivedLine 新增：shrinkRounds: ShrinkRound[]
  export function distributeShrink(lineItems: FlexItemState[], freeSpace: number, container: FlexContainerState, fontSize?: number): { deltas: Map<string, number>, rounds: ShrinkRound[] }
  ```

- **Step 1: 改现有用例的取值方式，并写新的失败测试**

`distribute.spec.ts` 的 `describe('distributeShrink')` 里，现有每处 `distributeShrink(...)` 的结果都改成取 `.deltas`（例如 `const result = distributeShrink(items, -200, container).deltas`、`distributeShrink(items, -300, container).deltas.get('i1')`）。然后在该 describe 末尾追加：

```ts
  it('没有盒子被压到 0 以下时只有一轮，冻结名单为空', () => {
    const { container } = createDefaultState()
    const items = makeItems([{ shrink: 1, basis: '300px' }, { shrink: 1, basis: '100px' }])

    expect(distributeShrink(items, -200, container).rounds).toEqual([
      { overflow: -200, factorSum: 2, effective: -200, weightSum: 400, frozen: [] },
    ])
  })

  it('被压到 0 以下的盒子冻结在 0，记下它原本应让出的量，剩下的溢出进入下一轮', () => {
    const { container } = createDefaultState()
    // 权重 10×10 = 100 与 1×300 = 300：第 1 轮 i1 应让 −50，basis 只有 10，冻结；溢出剩 −190 全由 i2 消化
    const items = makeItems([{ shrink: 10, basis: '10px' }, { shrink: 1, basis: '300px' }])
    const { deltas, rounds } = distributeShrink(items, -200, container)

    expect(rounds).toEqual([
      { overflow: -200, factorSum: 11, effective: -200, weightSum: 400, frozen: [{ id: 'i1', share: -50 }] },
      { overflow: -190, factorSum: 1, effective: -190, weightSum: 300, frozen: [] },
    ])
    expect(deltas.get('i1')).toBe(-10)
    expect(deltas.get('i2')).toBe(-190)
  })

  it('Σshrink 小于 1 时记下打折后的分摊量', () => {
    const { container } = createDefaultState()
    const items = makeItems([{ shrink: 0.5, basis: '900px' }])

    expect(distributeShrink(items, -300, container).rounds).toEqual([
      { overflow: -300, factorSum: 0.5, effective: -150, weightSum: 450, frozen: [] },
    ])
  })

  it('权重全为 0 时一轮也不记', () => {
    const { container } = createDefaultState()
    expect(distributeShrink(makeItems([{ shrink: 0 }, { shrink: 0 }]), -100, container).rounds).toEqual([])
  })
```

`deriveLayout.spec.ts` 末尾（`describe('deriveLayout')` 内）追加：

```ts
  it('收缩的行带上冻结循环的每一轮，伸展的行为空', () => {
    const shrinking = deriveLayout(stateWith([{ shrink: 10, basis: '10px' }, { shrink: 1, basis: '300px' }], 110))
    expect(shrinking.lines[0].shrinkRounds.map(round => round.frozen)).toEqual([[{ id: 'i1', share: -50 }], []])

    const growing = deriveLayout(stateWith([{ grow: 1, basis: '100px' }]))
    expect(growing.lines[0].shrinkRounds).toEqual([])
  })
```

- **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/distribute.spec.ts src/core/deriveLayout.spec.ts`
Expected: FAIL（`.deltas` / `.rounds` / `shrinkRounds` 为 undefined）。

- **Step 3: 实现**

`src/core/types.ts`，在 `DerivedLine` 之前加：

```ts
/** 冻结循环的一轮（规范 §9.7）。公式展开要逐轮讲，只有最终结果就讲不出谁先被冻住 */
export interface ShrinkRound {
  /** 本轮开始时还要消化的溢出（负） */
  overflow: number
  /** 本轮未冻结项的 Σshrink；小于 1 时实际分摊量被打折 */
  factorSum: number
  effective: number
  /** 本轮未冻结项的 Σ(shrink × basis) */
  weightSum: number
  /** 本轮被冻结在 0 的项与它们原本应让出的量；最后一轮为空 */
  frozen: { id: string, share: number }[]
}
```

`DerivedLine` 末尾加字段：

```ts
  /** 不收缩的行为空数组 */
  shrinkRounds: ShrinkRound[]
```

`src/core/distribute.ts` 的 `distributeShrink` 整体替换为（数值算法不变，只多记轮次）：

```ts
export function distributeShrink(
  lineItems: FlexItemState[],
  freeSpace: number,
  container: FlexContainerState,
  fontSize = DEFAULT_FONT_SIZE,
): { deltas: Map<string, number>, rounds: ShrinkRound[] } {
  const deltas = new Map<string, number>()
  const rounds: ShrinkRound[] = []
  const frozen = new Set<string>()
  let remaining = freeSpace

  while (remaining < 0) {
    const active = lineItems.filter(item => !frozen.has(item.id))
    const total = active.reduce((sum, item) => sum + shrinkWeight(item, container, fontSize), 0)
    if (total <= 0)
      break

    const factorSum = active.reduce((sum, item) => sum + Math.max(0, item.shrink), 0)
    const effective = factorSum < 1 ? Math.max(remaining, freeSpace * factorSum) : remaining
    const share = (item: FlexItemState): number => (shrinkWeight(item, container, fontSize) / total) * effective
    const violators = active.filter(item => hypotheticalSize(item, container, fontSize) + share(item) < 0)
    rounds.push({
      overflow: remaining,
      factorSum,
      effective,
      weightSum: total,
      frozen: violators.map(item => ({ id: item.id, share: share(item) })),
    })

    if (violators.length === 0) {
      for (const item of active)
        deltas.set(item.id, share(item))
      break
    }

    for (const item of violators) {
      const size = hypotheticalSize(item, container, fontSize)
      frozen.add(item.id)
      deltas.set(item.id, -size)
      remaining += size
    }
  }

  for (const item of lineItems) {
    const delta = deltas.get(item.id) ?? 0
    // 权重为 0 的项算出来是 -0，不规范成 0 会一路显示到界面上
    deltas.set(item.id, delta === 0 ? 0 : delta)
  }

  return { deltas, rounds }
}
```

文件首行 import 改为 `import type { FlexContainerState, FlexItemState, ShrinkRound } from './types'`。函数上方原有的 JSDoc 保留。

`src/core/overlay.spec.ts` 第 8 行起的 `makeLines` 手写了 `DerivedLine` 字面量，补上 `shrinkRounds: []`，否则 `pnpm tscheck` 报缺字段。

`src/core/deriveLayout.ts`：

```ts
    const shrinkResult = freeSpace < 0 ? distributeShrink(lineItems, freeSpace, container, fontSize) : null
```

替换原第 33 行；循环里 `shrinkDeltas?.get(item.id)` 改为 `shrinkResult?.deltas.get(item.id)`；`lines.push({...})` 里在 `totalShrinkWeighted,` 之后加 `shrinkRounds: shrinkResult?.rounds ?? [],`。

- **Step 4: 跑测试确认通过**

Run: `pnpm test && pnpm tscheck`
Expected: 全部 PASS（其他用 `toEqual` 比对整行 `DerivedLine` 的测试若因多出 `shrinkRounds` 变红，给期望值补上 `shrinkRounds: []` 或改用 `toMatchObject`——逐个看，不要一刀切）。

- **Step 5: 提交**

走 `/commit`，提交信息：`feat(core): 收缩分配记下冻结循环的每一轮，供公式展开逐轮讲解`

---

### Task 3: `explainItem` 把推导编排成步骤

**Files:**
- Modify: `src/core/types.ts`（增 `BasisForm`、`ExplainStep`）
- Create: `src/core/explain.ts`
- Create: `src/core/explain.spec.ts`

**Interfaces:**
- Consumes: Task 2 的 `DerivedLine.shrinkRounds`。
- Produces:
  ```ts
  export type BasisForm = 'content' | 'length' | 'percent' | 'font' | 'unit'
  export type ExplainStep =
    | { kind: 'basis', form: BasisForm, raw: string, value: number, unit: string, factor: number, result: number }
    | { kind: 'basis-runtime', raw: string }
    | { kind: 'unresolvable', blockers: string[] }
    | { kind: 'line', lineNumber: number, lineCount: number, terms: number[], gap: number, next: number | null, limit: number }
    | { kind: 'free', container: number, terms: number[], gap: number, result: number }
    | { kind: 'balanced' }
    | { kind: 'grow', grow: number, totalGrow: number, free: number, result: number }
    | { kind: 'shrink-weight', shrink: number, basis: number, result: number }
    | { kind: 'freeze', round: number, overflow: number, frozen: { id: string, share: number, basis: number }[], remaining: number }
    | { kind: 'shrink-total', terms: number[], result: number }
    | { kind: 'shrink-share', weight: number, weightSum: number, overflow: number, factorSum: number, initialOverflow: number, result: number }
    | { kind: 'no-shrink' }
    | { kind: 'final', basis: number, delta: number, result: number }
  export function explainItem(state: FlexState, layout: DerivedLayout, itemId: string): ExplainStep[]
  ```
  步骤顺序：`basis` →（多行时）`line` → `free` → 以下之一：`grow` / `balanced` / `shrink-weight` +（若有）`freeze`… +（未被冻结时）`shrink-total` + `shrink-share` 或 `no-shrink` → `final`。
  算不出理论值时只有 `basis`（或 `basis-runtime`）+ `unresolvable` 两步。

- **Step 1: 写失败的测试**

`src/core/explain.spec.ts`：

```ts
import type { ExplainStep, FlexItemState } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultItem, createDefaultState } from './defaults'
import { deriveLayout } from './deriveLayout'
import { explainItem } from './explain'

function stateWith(items: Partial<FlexItemState>[], container: Partial<ReturnType<typeof createDefaultState>['container']> = {}) {
  const state = createDefaultState()
  Object.assign(state.container, container)
  state.items = items.map((spec, index) => ({ ...createDefaultItem(`i${index + 1}`), ...spec }))
  return state
}

function explain(state: ReturnType<typeof stateWith>, id: string, fontSize?: number): ExplainStep[] {
  return explainItem(state, deriveLayout(state, fontSize), id)
}

const kinds = (steps: ExplainStep[]) => steps.map(step => step.kind)

describe('explainItem', () => {
  it('伸展：basis → 本行剩余 → grow 分配 → 理论最终', () => {
    const state = stateWith([
      { basis: '30%', grow: 1 },
      { basis: '150px', grow: 1 },
      { basis: '150px', grow: 0 },
    ], { width: 720, columnGap: 12 })

    expect(explain(state, 'i1')).toEqual([
      { kind: 'basis', form: 'percent', raw: '30%', value: 30, unit: '%', factor: 720, result: 216 },
      { kind: 'free', container: 720, terms: [216, 150, 150], gap: 12, result: 180 },
      { kind: 'grow', grow: 1, totalGrow: 2, free: 180, result: 90 },
      { kind: 'final', basis: 216, delta: 90, result: 306 },
    ])
  })

  it('收缩：先给权重与权重和，再按权重分摊溢出', () => {
    const state = stateWith([{ basis: '300px' }, { basis: '400px' }], { width: 600, columnGap: 0 })
    const steps = explain(state, 'i1')

    expect(kinds(steps)).toEqual(['basis', 'free', 'shrink-weight', 'shrink-total', 'shrink-share', 'final'])
    expect(steps[2]).toEqual({ kind: 'shrink-weight', shrink: 1, basis: 300, result: 300 })
    expect(steps[3]).toEqual({ kind: 'shrink-total', terms: [300, 400], result: 700 })
    expect(steps[4]).toMatchObject({ kind: 'shrink-share', weight: 300, weightSum: 700, overflow: -100, factorSum: 2, initialOverflow: -100 })
    expect((steps[4] as { result: number }).result).toBeCloseTo(-300 / 7)
  })

  it('本盒子在第 1 轮被冻结：列出冻结那一轮后直接给最终，不再有分摊行', () => {
    const state = stateWith([{ shrink: 10, basis: '10px' }, { shrink: 1, basis: '300px' }], { width: 110, columnGap: 0 })

    expect(explain(state, 'i1').slice(2)).toEqual([
      { kind: 'shrink-weight', shrink: 10, basis: 10, result: 100 },
      { kind: 'freeze', round: 1, overflow: -200, frozen: [{ id: 'i1', share: -50, basis: 10 }], remaining: -190 },
      { kind: 'final', basis: 10, delta: -10, result: 0 },
    ])
  })

  it('别的盒子被冻结：冻结轮之后按剩下的盒子重算权重和', () => {
    const state = stateWith([{ shrink: 10, basis: '10px' }, { shrink: 1, basis: '300px' }], { width: 110, columnGap: 0 })

    expect(explain(state, 'i2').slice(3)).toEqual([
      { kind: 'freeze', round: 1, overflow: -200, frozen: [{ id: 'i1', share: -50, basis: 10 }], remaining: -190 },
      { kind: 'shrink-total', terms: [300], result: 300 },
      { kind: 'shrink-share', weight: 300, weightSum: 300, overflow: -190, factorSum: 1, initialOverflow: -200, result: -190 },
      { kind: 'final', basis: 300, delta: -190, result: 110 },
    ])
  })

  it('Σgrow 小于 1：步骤里带着 Σgrow，界面据此换公式', () => {
    const state = stateWith([{ basis: '100px', grow: 0.5 }], { width: 600 })
    expect(explain(state, 'i1')[2]).toEqual({ kind: 'grow', grow: 0.5, totalGrow: 0.5, free: 500, result: 250 })
  })

  it('Σshrink 小于 1：分摊行带着 Σshrink 与初始溢出', () => {
    const state = stateWith([{ basis: '900px', shrink: 0.5 }], { width: 600 })
    expect(explain(state, 'i1')[4]).toEqual({ kind: 'shrink-share', weight: 450, weightSum: 450, overflow: -300, factorSum: 0.5, initialOverflow: -300, result: -150 })
  })

  it('剩余恰好为 0：不伸不缩', () => {
    const state = stateWith([{ basis: '100px' }, { basis: '200px' }], { width: 300, columnGap: 0 })
    expect(kinds(explain(state, 'i1'))).toEqual(['basis', 'free', 'balanced', 'final'])
  })

  it('权重全为 0：溢出留在行上，不收缩', () => {
    const state = stateWith([{ basis: '400px', shrink: 0 }, { basis: '400px', shrink: 0 }], { width: 600, columnGap: 0 })
    expect(kinds(explain(state, 'i1'))).toEqual(['basis', 'free', 'shrink-weight', 'no-shrink', 'final'])
  })

  it('basis 的五种写法各给出换算依据', () => {
    const state = stateWith([
      { basis: 'auto', size: 80 },
      { basis: '0' },
      { basis: '2em' },
      { basis: '1in' },
    ], { width: 1200 })
    const layout = deriveLayout(state, 20)

    expect(explainItem(state, layout, 'i1')[0]).toEqual({ kind: 'basis', form: 'content', raw: 'auto', value: 80, unit: '', factor: 1, result: 80 })
    expect(explainItem(state, layout, 'i2')[0]).toEqual({ kind: 'basis', form: 'length', raw: '0', value: 0, unit: '', factor: 1, result: 0 })
    expect(explainItem(state, layout, 'i3')[0]).toEqual({ kind: 'basis', form: 'font', raw: '2em', value: 2, unit: 'em', factor: 20, result: 40 })
    expect(explainItem(state, layout, 'i4')[0]).toEqual({ kind: 'basis', form: 'unit', raw: '1in', value: 1, unit: 'in', factor: 96, result: 96 })
  })

  it('多行时加一步分行：给出本行累加，以及下一个放不下的盒子', () => {
    const state = stateWith(Array.from({ length: 4 }, () => ({ basis: '300px' })), { width: 720, columnGap: 12, wrap: 'wrap' })

    expect(explain(state, 'i1')[1]).toEqual({ kind: 'line', lineNumber: 1, lineCount: 2, terms: [300, 300], gap: 12, next: 300, limit: 720 })
    expect(explain(state, 'i3')[1]).toEqual({ kind: 'line', lineNumber: 2, lineCount: 2, terms: [300, 300], gap: 12, next: null, limit: 720 })
  })

  it('wrap-reverse：行号按视觉行序，下一个按 order 顺序', () => {
    const state = stateWith(Array.from({ length: 4 }, () => ({ basis: '300px' })), { width: 720, columnGap: 12, wrap: 'wrap-reverse' })

    expect(explain(state, 'i1')[1]).toMatchObject({ lineNumber: 2, next: 300 })
    expect(explain(state, 'i3')[1]).toMatchObject({ lineNumber: 1, next: null })
  })

  it('order 打乱时分行按 order 累加，不按文档顺序', () => {
    // order 顺序是 B(100) C(400) | D(200) A(300)：100 + 12 + 400 + 12 + 200 = 724 > 720
    const state = stateWith([
      { basis: '300px', order: 1 },
      { basis: '100px' },
      { basis: '400px' },
      { basis: '200px' },
    ], { width: 720, columnGap: 12, wrap: 'wrap' })

    expect(explain(state, 'i2')[1]).toMatchObject({ lineNumber: 1, terms: [100, 400], next: 200 })
    expect(explain(state, 'i1')[1]).toMatchObject({ lineNumber: 2, terms: [200, 300], next: null })
  })

  it('column 方向：主轴取 height，gap 取 rowGap', () => {
    const state = stateWith([{ basis: '100px', grow: 1 }, { basis: '100px', grow: 1 }], {
      direction: 'column',
      height: 320,
      rowGap: 10,
      columnGap: 99,
    })
    expect(explain(state, 'i1')[1]).toEqual({ kind: 'free', container: 320, terms: [100, 100], gap: 10, result: 110 })
  })

  it('自己的 basis 要到运行期才能确定：两步就停', () => {
    const state = stateWith([{ basis: '10vw' }, { basis: '100px' }])
    expect(explain(state, 'i1')).toEqual([
      { kind: 'basis-runtime', raw: '10vw' },
      { kind: 'unresolvable', blockers: [] },
    ])
  })

  it('别的盒子的 basis 要到运行期才能确定：本盒子 basis 照常解析，随即停下并点名', () => {
    const state = stateWith([{ basis: '100px' }, { basis: '10vw' }])
    expect(explain(state, 'i1')).toEqual([
      { kind: 'basis', form: 'length', raw: '100px', value: 100, unit: 'px', factor: 1, result: 100 },
      { kind: 'unresolvable', blockers: ['i2'] },
    ])
  })

  it('找不到盒子时返回空数组', () => {
    expect(explain(stateWith([{}]), 'nope')).toEqual([])
  })
})
```

- **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/explain.spec.ts`
Expected: FAIL，`./explain` 不存在。

- **Step 3: 实现**

`src/core/types.ts` 末尾追加 Interfaces 里的 `BasisForm` 与 `ExplainStep`（原样照抄），`ExplainStep` 上方加一行注释：`/** 公式展开的一步：只有数值，文案在展示层 */`。

`src/core/explain.ts`：

```ts
import type { DerivedItem, DerivedLayout, DerivedLine, ExplainStep, FlexItemState, FlexState } from './types'
import { mainAxisGap, mainAxisSize } from './axis'
import { basisKind, FONT_RELATIVE_UNITS, PX_PER_UNIT, staticLength } from './basisSyntax'

/**
 * 把一个盒子的理论尺寸拆成逐步的推导。
 * 只编排不重算：每一步的结果都取自 deriveLayout 的输出，最后一步因此必然等于明细表的理论值。
 */
export function explainItem(state: FlexState, layout: DerivedLayout, itemId: string): ExplainStep[] {
  const item = state.items.find(candidate => candidate.id === itemId)
  const derived = layout.items.find(candidate => candidate.id === itemId)
  if (!item || !derived)
    return []

  const basis = basisStep(item, derived, state, layout.fontSize)
  if (derived.finalMainSize === null) {
    const blockers = state.items
      .filter(other => other.id !== itemId && basisKind(other.basis) === 'runtime')
      .map(other => other.id)
    return [basis, { kind: 'unresolvable', blockers }]
  }

  const line = layout.lines[derived.lineIndex]
  const sizeOf = new Map(layout.items.map(record => [record.id, record.hypotheticalMainSize]))
  const terms = line.itemIds.map(id => sizeOf.get(id) ?? 0)
  const gap = mainAxisGap(state.container)
  const steps: ExplainStep[] = [basis]

  if (layout.lines.length > 1)
    steps.push(lineStep(state, layout, line, sizeOf, terms, gap))

  steps.push({ kind: 'free', container: mainAxisSize(state.container), terms, gap, result: line.freeSpace })

  if (line.freeSpace > 0)
    steps.push({ kind: 'grow', grow: Math.max(0, item.grow), totalGrow: line.totalGrow, free: line.freeSpace, result: derived.deltaFromGrow })
  else if (line.freeSpace < 0)
    steps.push(...shrinkSteps(state, line, item, derived, sizeOf))
  else
    steps.push({ kind: 'balanced' })

  steps.push({
    kind: 'final',
    basis: derived.hypotheticalMainSize,
    delta: derived.deltaFromGrow + derived.deltaFromShrink,
    result: derived.finalMainSize,
  })
  return steps
}

function basisStep(item: FlexItemState, derived: DerivedItem, state: FlexState, fontSize: number): ExplainStep {
  if (basisKind(item.basis) === 'runtime')
    return { kind: 'basis-runtime', raw: item.basis }

  const base = { kind: 'basis', raw: item.basis, result: derived.basisResolved } as const
  const length = staticLength(item.basis)
  if (!length)
    return { ...base, form: 'content', value: item.size, unit: '', factor: 1 }

  const { value, unit } = length
  if (unit === '%')
    return { ...base, form: 'percent', value, unit, factor: mainAxisSize(state.container) }
  if (FONT_RELATIVE_UNITS.has(unit))
    return { ...base, form: 'font', value, unit, factor: fontSize }
  if (unit === '' || unit === 'px')
    return { ...base, form: 'length', value, unit, factor: 1 }
  return { ...base, form: 'unit', value, unit, factor: PX_PER_UNIT.get(unit) ?? 1 }
}

function lineStep(
  state: FlexState,
  layout: DerivedLayout,
  line: DerivedLine,
  sizeOf: Map<string, number>,
  terms: number[],
  gap: number,
): ExplainStep {
  // lines 按视觉行序排，wrap-reverse 下与断行先后相反；「下一个放不下的」要按断行先后找
  const sequence = state.container.wrap === 'wrap-reverse' ? [...layout.lines].reverse() : layout.lines
  const nextLine = sequence[sequence.indexOf(line) + 1]

  return {
    kind: 'line',
    lineNumber: line.index + 1,
    lineCount: layout.lines.length,
    terms,
    gap,
    next: nextLine ? sizeOf.get(nextLine.itemIds[0]) ?? 0 : null,
    limit: mainAxisSize(state.container),
  }
}

function shrinkSteps(
  state: FlexState,
  line: DerivedLine,
  item: FlexItemState,
  derived: DerivedItem,
  sizeOf: Map<string, number>,
): ExplainStep[] {
  const shrinkOf = new Map(state.items.map(candidate => [candidate.id, Math.max(0, candidate.shrink)]))
  const weightOf = (id: string): number => (shrinkOf.get(id) ?? 0) * (sizeOf.get(id) ?? 0)
  const steps: ExplainStep[] = [
    { kind: 'shrink-weight', shrink: shrinkOf.get(item.id) ?? 0, basis: derived.hypotheticalMainSize, result: weightOf(item.id) },
  ]
  const frozen = new Set<string>()

  for (const [index, round] of line.shrinkRounds.entries()) {
    if (round.frozen.length === 0) {
      const active = line.itemIds.filter(id => !frozen.has(id))
      steps.push(
        { kind: 'shrink-total', terms: active.map(weightOf), result: round.weightSum },
        {
          kind: 'shrink-share',
          weight: weightOf(item.id),
          weightSum: round.weightSum,
          overflow: round.overflow,
          factorSum: round.factorSum,
          initialOverflow: line.freeSpace,
          result: derived.deltaFromShrink,
        },
      )
      return steps
    }

    // 与引擎同一个累加顺序（从本轮溢出起逐个加回），守卫用 toBe 比对下一轮的起点才不会差在浮点舍入上
    const remaining = round.frozen.reduce((sum, record) => sum + (sizeOf.get(record.id) ?? 0), round.overflow)
    steps.push({
      kind: 'freeze',
      round: index + 1,
      overflow: round.overflow,
      frozen: round.frozen.map(record => ({ ...record, basis: sizeOf.get(record.id) ?? 0 })),
      remaining,
    })
    for (const record of round.frozen)
      frozen.add(record.id)
    if (frozen.has(item.id))
      return steps
  }

  // 一轮都没分摊成：整行权重为 0，或冻结之后剩下的盒子权重为 0
  steps.push({ kind: 'no-shrink' })
  return steps
}
```

- **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/core/explain.spec.ts && pnpm tscheck`
Expected: 全部 PASS，类型检查无错。

- **Step 5: 提交**

走 `/commit`，提交信息：`feat(core): 新增 explainItem，把单个盒子的理论推导编排成步骤`

---

### Task 4: 随机守卫——同源、代入自洽、分支全覆盖

**Files:**
- Modify: `package.json` / `pnpm-lock.yaml`（`pnpm add -D fast-check`）
- Modify: `src/core/explain.spec.ts`（追加一个 describe）

**Interfaces:**
- Consumes: Task 3 的 `explainItem` 与 `ExplainStep`。

- **Step 1: 装依赖**

Run: `pnpm add -D fast-check`
Expected: `package.json` 的 devDependencies 出现 `"fast-check": "^4.x.x"`（取当时最新稳定版）。

- **Step 2: 写守卫**

`src/core/explain.spec.ts` 顶部 import 补上 `import fc from 'fast-check'`、`import type { FlexState } from './types'`（并入已有的 type import），文件末尾追加：

```ts
const CLOSE = 1e-9

function sum(terms: number[]): number {
  return terms.reduce((total, term) => total + term, 0)
}

/** 每一步把「代入」真的算一遍，必须等于它自称的结果；相邻步骤之间的数字也要接得上 */
function assertConsistent(steps: ExplainStep[], itemId: string): void {
  const basis = steps.find(step => step.kind === 'basis')
  const free = steps.find(step => step.kind === 'free')
  const final = steps.find(step => step.kind === 'final')
  let overflow = free?.result

  for (const step of steps) {
    switch (step.kind) {
      case 'basis':
        expect(Math.abs((step.form === 'percent' ? step.value * step.factor / 100 : step.value * step.factor) - step.result)).toBeLessThan(CLOSE)
        break
      case 'line': {
        const used = sum(step.terms) + (step.terms.length - 1) * step.gap
        if (step.terms.length > 1)
          expect(used).toBeLessThanOrEqual(step.limit + CLOSE)
        // 百分比、cm 这类小数尺寸重新累加时结合顺序与 splitLines 不同，边界上留一点浮点余量
        if (step.next !== null)
          expect(used + step.gap + step.next).toBeGreaterThan(step.limit - CLOSE)
        break
      }
      case 'free':
        expect(Math.abs(step.container - sum(step.terms) - (step.terms.length - 1) * step.gap - step.result)).toBeLessThan(CLOSE)
        expect(step.terms).toContain(basis?.kind === 'basis' ? basis.result : Number.NaN)
        break
      case 'grow': {
        const expected = step.totalGrow === 0
          ? 0
          : step.grow / step.totalGrow * (step.totalGrow < 1 ? step.free * step.totalGrow : step.free)
        expect(Math.abs(expected - step.result)).toBeLessThan(CLOSE)
        expect(final?.kind === 'final' && final.delta).toBe(step.result)
        break
      }
      case 'shrink-weight':
        expect(Math.abs(step.shrink * step.basis - step.result)).toBeLessThan(CLOSE)
        break
      case 'freeze':
        expect(step.overflow).toBe(overflow)
        for (const record of step.frozen)
          expect(record.basis + record.share).toBeLessThan(0)
        overflow = step.remaining
        if (step.frozen.some(record => record.id === itemId))
          expect(final?.kind === 'final' && final.delta).toBe(-(basis?.kind === 'basis' ? basis.result : Number.NaN))
        break
      case 'shrink-total':
        expect(Math.abs(sum(step.terms) - step.result)).toBeLessThan(CLOSE)
        break
      case 'shrink-share': {
        expect(step.overflow).toBe(overflow)
        expect(step.initialOverflow).toBe(free?.kind === 'free' ? free.result : Number.NaN)
        const effective = step.factorSum < 1 ? Math.max(step.overflow, step.initialOverflow * step.factorSum) : step.overflow
        expect(Math.abs(step.weight / step.weightSum * effective - step.result)).toBeLessThan(CLOSE)
        expect(final?.kind === 'final' && final.delta).toBe(step.result)
        break
      }
      case 'balanced':
      case 'no-shrink':
        expect(final?.kind === 'final' && final.delta).toBe(0)
        break
      case 'final':
        expect(Math.abs(step.basis + step.delta - step.result)).toBeLessThan(CLOSE)
        expect(step.basis).toBe(basis?.kind === 'basis' ? basis.result : Number.NaN)
        break
      case 'basis-runtime':
      case 'unresolvable':
        break
    }
  }
}

/** 随机扫描各条分支实际命中了几次；为 0 的分支说明生成器根本没造出那种状态，守卫在那条路上是瞎的 */
function branchesOf(steps: ExplainStep[], itemId: string): string[] {
  return steps.flatMap((step) => {
    switch (step.kind) {
      case 'basis': return [`basis:${step.form}`]
      case 'basis-runtime': return ['basis-runtime']
      case 'unresolvable': return step.blockers.length > 0 ? ['unresolvable:other'] : ['unresolvable:self']
      case 'line': return ['line', ...(step.next === null ? ['line:last'] : []), ...(step.terms.length === 1 && step.terms[0] > step.limit ? ['line:oversize'] : [])]
      case 'grow': return [step.totalGrow === 0 ? 'grow:zero' : step.totalGrow < 1 ? 'grow:scaled' : 'grow']
      case 'freeze': return ['freeze', ...(step.frozen.some(record => record.id === itemId) ? ['freeze:self'] : [])]
      case 'shrink-share': return [step.factorSum < 1 ? 'shrink:scaled' : 'shrink']
      case 'no-shrink': return ['no-shrink']
      default: return []
    }
  })
}

const REQUIRED_BRANCHES = [
  'basis:content',
  'basis:length',
  'basis:percent',
  'basis:font',
  'basis:unit',
  'basis-runtime',
  'unresolvable:self',
  'unresolvable:other',
  'line',
  'line:last',
  'line:oversize',
  'grow',
  'grow:zero',
  'grow:scaled',
  'shrink',
  'shrink:scaled',
  'freeze',
  'freeze:self',
  'no-shrink',
]

const factorArb = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 10 }) },
  { weight: 1, arbitrary: fc.constantFrom(0.2, 0.3, 0.5) },
)

const basisArb = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom('auto', 'content', '0') },
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 500 }).map(value => `${value}px`) },
  { weight: 2, arbitrary: fc.integer({ min: 0, max: 80 }).map(value => `${value}%`) },
  { weight: 1, arbitrary: fc.integer({ min: 0, max: 20 }).map(value => `${value}em`) },
  { weight: 1, arbitrary: fc.constantFrom('1in', '2cm', '30pt') },
)

const stateArb = fc.record({
  items: fc.array(fc.record({
    grow: factorArb,
    shrink: factorArb,
    basis: basisArb,
    size: fc.integer({ min: 0, max: 300 }),
    order: fc.integer({ min: -1, max: 1 }),
  }), { minLength: 1, maxLength: 8 }),
  main: fc.integer({ min: 100, max: 1200 }),
  gap: fc.integer({ min: 0, max: 64 }),
  direction: fc.constantFrom('row', 'row-reverse', 'column', 'column-reverse'),
  wrap: fc.constantFrom('nowrap', 'wrap', 'wrap-reverse'),
  // 运行期 basis 只放在一成的状态里：放进每个盒子的候选里，大半状态整个容器都推不出来，其余分支就喂不饱
  runtime: fc.integer({ min: 0, max: 9 }).map(value => value === 0),
}).map(({ items, main, gap, direction, wrap, runtime }): FlexState => {
  const state = createDefaultState()
  Object.assign(state.container, { direction, wrap, width: main, height: main, rowGap: gap, columnGap: gap })
  state.items = items.map((spec, index) => ({ ...createDefaultItem(`i${index + 1}`), ...spec }))
  if (runtime)
    state.items[0].basis = '10vw'
  return state
})

describe('explainItem 随机守卫', () => {
  it('最后一步恒等于推导引擎的理论值，每一步的代入都算得出它自称的结果，各条分支都走到过', () => {
    const hits = new Map<string, number>()

    fc.assert(fc.property(stateArb, (state) => {
      const layout = deriveLayout(state)
      for (const item of state.items) {
        const steps = explainItem(state, layout, item.id)
        const final = steps.find(step => step.kind === 'final')
        const derived = layout.items.find(record => record.id === item.id)
        expect(final?.kind === 'final' ? final.result : null).toBe(derived?.finalMainSize)
        assertConsistent(steps, item.id)
        for (const branch of branchesOf(steps, item.id))
          hits.set(branch, (hits.get(branch) ?? 0) + 1)
      }
    }), { numRuns: 1000 })

    expect(REQUIRED_BRANCHES.filter(branch => !hits.get(branch))).toEqual([])
  })
})
```

`balanced`（剩余恰好为 0）不进 `REQUIRED_BRANCHES`：随机状态里精确命中 0 的概率可以忽略，由 Task 3 的单元测试覆盖。

- **Step 3: 跑守卫**

Run: `pnpm vitest run src/core/explain.spec.ts`
Expected: PASS。若最后一条断言列出了未命中的分支，**调生成器的权重或取值范围让它命中**，不准把它从 `REQUIRED_BRANCHES` 里删掉；调完重跑直到通过。

- **Step 4: 变异验证**

在 scratchpad 写 `mutate.py`，逐条执行下表的变异：每条的「查找串」必须在文件里恰好出现一次（否则报「探针失效」并停下，不给结论）；变异前后比对文件的 sha256，确认改动真的落地；跑 `pnpm vitest run src/core/explain.spec.ts src/core/distribute.spec.ts`，记录红绿；用备份还原并再比一次 sha256。

| # | 文件 | 查找串 | 替换为 | 期望 |
| --- | --- | --- | --- | --- |
| 1 | `src/core/explain.ts` | `result: derived.deltaFromGrow })` | `result: derived.deltaFromShrink })` | 红 |
| 2 | `src/core/explain.ts` | `steps.push({ kind: 'free', container: mainAxisSize(state.container), terms, gap, result: line.freeSpace })` | `steps.push({ kind: 'free', container: mainAxisSize(state.container), terms, gap: 0, result: line.freeSpace })` | 红 |
| 3 | `src/core/explain.ts` | `overflow: round.overflow,\n          factorSum` | `overflow: line.freeSpace,\n          factorSum` | 红 |
| 4 | `src/core/explain.ts` | `const sequence = state.container.wrap === 'wrap-reverse' ? [...layout.lines].reverse() : layout.lines` | `const sequence = layout.lines` | 红 |
| 5 | `src/core/distribute.ts` | `frozen: violators.map(item => ({ id: item.id, share: share(item) })),` | `frozen: [],` | 红 |
| 6 | `src/core/explain.ts` | `if (frozen.has(item.id))\n      return steps` | `if (false)\n      return steps` | 红 |

六条必须全红、还原后 sha256 与变异前一致。结果（每条红在哪个用例）记进 [progress.md](../../progress.md) 的本里程碑一节（Task 9 写）。

- **Step 5: 提交**

走 `/commit`，提交信息：`test(core): 公式展开的随机守卫——同源、代入自洽、分支全覆盖`（`package.json` 与 `pnpm-lock.yaml` 一并提交）。

---

### Task 5: 诊断抽成共享 composable

**Files:**
- Create: `src/composables/useDiagnostics.ts`
- Create: `src/composables/useDiagnostics.spec.ts`
- Create: `src/components/playground/DiagnosisText.vue`
- Modify: `src/components/playground/MetricsTable.vue`

**Interfaces:**
- Produces:
  ```ts
  useDiagnostics(): {
    diagnostics: ComputedRef<Diagnostic[]>
    byId: ComputedRef<Map<string, Diagnostic>>
    textOf: (diagnostic: Diagnostic) => string
  }
  ```
  `<DiagnosisText :diagnostic="Diagnostic" />`：渲染 ⚠ / ℹ 图标 + 文案，CSS 属性名整体不断行。

- **Step 1: 写失败的测试**

`src/composables/useDiagnostics.spec.ts`：

```ts
import type { MeasuredStage } from '~/core/types'
import { beforeEach, describe, expect, it } from 'vitest'

function measureAll(widths: number[]): MeasuredStage {
  const { state } = useFlexState()
  return {
    width: state.container.width,
    height: state.container.height,
    items: state.items.map((item, index) => ({ id: item.id, width: widths[index], height: state.container.height, left: 0, top: 0 })),
  }
}

describe('useDiagnostics', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useMeasure().measured.value = null
  })

  it('明细表与推导页拿到的是同一份计算结果', () => {
    expect(useDiagnostics().diagnostics).toBe(useDiagnostics().diagnostics)
  })

  it('还没有观测结果时没有诊断', () => {
    expect(useDiagnostics().diagnostics.value).toEqual([])
  })

  it('按盒子 id 取诊断，并给出中文文案', () => {
    const { state } = useFlexState()
    state.container.width = 300
    state.items = state.items.slice(0, 2)
    for (const item of state.items)
      item.basis = '300px'
    state.items[0].size = 240
    useMeasure().measured.value = measureAll([240, 144])

    const { byId, textOf } = useDiagnostics()
    const diagnostic = byId.value.get(state.items[0].id)!
    expect(diagnostic.rule).toBe('min-width-auto')
    expect(textOf(diagnostic)).toContain('min-width:auto')
  })
})
```

- **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/composables/useDiagnostics.spec.ts`
Expected: FAIL，`useDiagnostics` 未定义。

- **Step 3: 实现**

`src/composables/useDiagnostics.ts`（`ruleText` 从 `MetricsTable.vue` 原样搬过来）：

```ts
import type { Diagnostic, DiagnosticRule } from '~/core/types'
import { diagnose } from '~/core/diagnostics'
import { itemLabel, px } from '~/core/labels'

/** 明细表与推导页共用一份。不放进 useFlexState：状态层不该反向依赖观测层 */
export const useDiagnostics = createSharedComposable(() => {
  const { state, derived } = useFlexState()
  const { measured } = useMeasure()

  function labelsOf(ids: string[]): string {
    return ids.map(id => itemLabel(state.items.findIndex(item => item.id === id))).join('、')
  }

  // 文案住在展示层：core/ 只产出 rule 标识、数值与盒子 id
  const ruleText: Record<DiagnosticRule, (diagnostic: Diagnostic) => string> = {
    'runtime-basis': () => 'flex-basis 要到运行期才能确定（calc()、vw、ch 等），理论值无法推导',
    'line-break-widened': () => 'min-width:auto 把它参与换行的尺寸撑到了内容尺寸，换行位置因此与推导不同',
    'line-break-shifted': () => '换行位置与推导不同：有盒子被 min-width:auto 撑宽，它所在行的成员变了',
    'min-width-auto': d => d.params.freeSpace < 0
      ? 'min-width:auto 撑住了内容固有尺寸，收缩到此为止'
      : '分到的尺寸比内容固有尺寸小，min-width:auto 把它撑到了内容尺寸',
    'min-width-auto-sibling': d => `同一行的 ${labelsOf(d.causedBy ?? [])} 被 min-width:auto 兜住、多占了空间，它分到的尺寸跟着变小`,
    'margin-auto': d => `margin:auto 吃掉了 ${px(d.params.freeSpace)} 剩余空间，justify-content 已失效`,
    'unexplained': () => '与推导不一致，没能归到已知规则',
  }

  const diagnostics = computed(() => measured.value ? diagnose(state, derived.value, measured.value) : [])
  const byId = computed(() => new Map(diagnostics.value.map(diagnostic => [diagnostic.itemId, diagnostic])))

  return { diagnostics, byId, textOf: (diagnostic: Diagnostic): string => ruleText[diagnostic.rule](diagnostic) }
})
```
`src/components/playground/DiagnosisText.vue`（模板从 `MetricsTable.vue` 的诊断单元格原样搬过来）：

```vue
<script setup lang="ts">
import type { Diagnostic } from '~/core/types'

const props = defineProps<{ diagnostic: Diagnostic }>()
const { textOf } = useDiagnostics()

// 连字符是断行机会：窄列里 min-width:auto 会被拆成「min-」与「width:auto」两行
const CSS_NAME = /([a-z]+(?:-[a-z]+)+(?::[a-z]+)?)/

const segments = computed(() =>
  textOf(props.diagnostic).split(CSS_NAME).map((part, index) => ({ text: part, unbreakable: index % 2 === 1 })),
)
</script>

<template>
  <span :class="props.diagnostic.severity === 'info' ? 'text-accent' : 'text-accent2'">
    {{ props.diagnostic.severity === 'info' ? 'ℹ' : '⚠' }}
    <template v-for="(segment, index) in segments" :key="index">
      <span v-if="segment.unbreakable" class="whitespace-nowrap">{{ segment.text }}</span>
      <template v-else>{{ segment.text }}</template>
    </template>
  </span>
</template>
```

`MetricsTable.vue`：
- script 里删掉 `ruleText`、`labelsOf`、`diagnostics` computed、`CSS_NAME`、`segments`，以及不再用到的 `Diagnostic` / `DiagnosticRule` / `diagnose` import；加 `const { byId } = useDiagnostics()`；`rows` 里 `diagnosticById` 换成 `byId.value`。
- 模板诊断单元格的 `<span v-if="row.diagnostic" ...>...</span>` 整段换成 `<DiagnosisText v-if="row.diagnostic" :diagnostic="row.diagnostic" />`，后面两个 `v-else-if` / `v-else` 不动。

- **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/composables/useDiagnostics.spec.ts src/components/playground/MetricsTable.spec.ts && pnpm tscheck`
Expected: 全部 PASS——`MetricsTable.spec.ts` 一个字不改照样通过，证明明细表行为没变。

- **Step 5: 提交**

走 `/commit`，提交信息：`refactor: 诊断计算与文案抽成共享 composable，供推导页复用`（含重新生成的 `auto-imports.d.ts` / `components.d.ts`）。

---

### Task 6: 推导页表格 `DerivationSteps.vue`

**Files:**
- Create: `src/components/playground/DerivationSteps.vue`
- Create: `src/components/playground/DerivationSteps.spec.ts`

**Interfaces:**
- Consumes: `explainItem`、`ExplainStep`（Task 3）；`formatNumber`、`px`、`itemLabel`（Task 1）；`useDiagnostics().byId`、`<DiagnosisText>`（Task 5）。
- Produces: `<DerivationSteps />`，根元素 `data-testid="derivation"`；空状态 `data-testid="derivation-empty"`；步骤行 `data-testid="derivation-row"`，四个单元格依次 `data-testid="step-label|step-formula|step-substitution|step-result"`；实际行 `data-testid="derivation-actual"`；诊断行 `data-testid="derivation-diagnosis"`。

- **Step 1: 写失败的测试**

`src/components/playground/DerivationSteps.spec.ts`：

```ts
import type { FlexItemState, MeasuredStage } from '~/core/types'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultItem } from '~/core/defaults'
import DerivationSteps from './DerivationSteps.vue'

function setItems(specs: Partial<FlexItemState>[]): void {
  const { state } = useFlexState()
  state.items = specs.map((spec, index) => ({ ...createDefaultItem(`item-${index + 1}`), ...spec }))
}

function measureAll(widths: number[]): MeasuredStage {
  const { state } = useFlexState()
  return {
    width: state.container.width,
    height: state.container.height,
    items: state.items.map((item, index) => ({ id: item.id, width: widths[index], height: state.container.height, left: 0, top: 0 })),
  }
}

function table(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid="derivation-row"]').map(row => ({
    label: row.get('[data-testid="step-label"]').text(),
    substitution: row.get('[data-testid="step-substitution"]').text(),
    result: row.get('[data-testid="step-result"]').text(),
  }))
}

/** 默认容器 720、gap 12：A 30% = 216，剩余 720 − 516 − 24 = 180，A 与 B 各分一半 */
function growScenario(): void {
  setItems([{ basis: '30%', grow: 1 }, { basis: '150px', grow: 1 }, { basis: '150px' }])
  useFlexState().selectItem('item-1')
}

describe('derivationSteps', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useMeasure().measured.value = null
  })

  it('没有选中盒子时提示怎么用', () => {
    const wrapper = mount(DerivationSteps)
    expect(wrapper.get('[data-testid="derivation-empty"]').text()).toContain('点击演示区里的任意盒子')
  })

  it('伸展场景逐行给出代入与结果', () => {
    growScenario()
    const wrapper = mount(DerivationSteps)

    expect(table(wrapper)).toEqual([
      { label: 'basis', substitution: '30% × 720', result: '216px' },
      { label: '本行剩余', substitution: '720 − (216 + 150 + 150) − 2 × 12', result: '180px' },
      { label: 'grow 分配', substitution: '1 ÷ 2 × 180', result: '90px' },
      { label: '理论最终', substitution: '216 + 90', result: '306px' },
    ])
  })

  it('收缩有冻结时，冻结那一轮点名盒子并给出剩下的溢出', () => {
    const { state } = useFlexState()
    state.container.width = 110
    state.container.columnGap = 0
    setItems([{ basis: '10px', shrink: 10 }, { basis: '300px' }])
    useFlexState().selectItem('item-1')
    const wrapper = mount(DerivationSteps)

    expect(table(wrapper)).toContainEqual({ label: '冻结第 1 轮', substitution: '盒子 A 应让 −50，basis 只有 10', result: '溢出剩 −190px' })
    expect(table(wrapper).at(-1)).toEqual({ label: '理论最终', substitution: '10 − 10', result: '0px' })
  })

  it('别的盒子的 basis 要到运行期才能确定时，点名它并停下', () => {
    setItems([{ basis: '100px' }, { basis: '10vw' }])
    useFlexState().selectItem('item-1')
    const wrapper = mount(DerivationSteps)

    expect(wrapper.text()).toContain('盒子 B 的 basis 要到运行期才能确定')
    expect(wrapper.text()).not.toContain('理论最终')
  })

  it('还没有观测结果时实际行留空位，不打勾', () => {
    growScenario()
    const wrapper = mount(DerivationSteps)

    expect(wrapper.get('[data-testid="derivation-actual"]').text()).toContain('—')
    expect(wrapper.get('[data-testid="derivation-actual"]').text()).not.toContain('✓')
  })

  it('理论与实际一致时打勾', async () => {
    growScenario()
    useMeasure().measured.value = measureAll([306, 240, 150])
    const wrapper = mount(DerivationSteps)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="derivation-actual"]').text()).toContain('306px ✓')
    expect(wrapper.find('[data-testid="derivation-diagnosis"]').exists()).toBe(false)
  })

  it('对不上时在末行下方写出诊断', async () => {
    const { state } = useFlexState()
    state.container.width = 300
    setItems([{ basis: '300px', size: 240 }, { basis: '300px' }])
    useFlexState().selectItem('item-1')
    useMeasure().measured.value = measureAll([240, 144])
    const wrapper = mount(DerivationSteps)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="derivation-actual"]').text()).not.toContain('✓')
    expect(wrapper.get('[data-testid="derivation-diagnosis"]').text()).toContain('min-width:auto')
  })

  it('停在推导页时改属性，表格跟着变', async () => {
    growScenario()
    const wrapper = mount(DerivationSteps)
    useFlexState().state.items[2].grow = 1
    await wrapper.vm.$nextTick()

    expect(table(wrapper)).toContainEqual({ label: 'grow 分配', substitution: '1 ÷ 3 × 180', result: '60px' })
  })

  it('选中的盒子被删掉后回到空状态', async () => {
    growScenario()
    const wrapper = mount(DerivationSteps)
    useFlexState().removeItem('item-1')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="derivation-empty"]').exists()).toBe(true)
  })
})
```

- **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/DerivationSteps.spec.ts`
Expected: FAIL，组件不存在。

- **Step 3: 实现**

`src/components/playground/DerivationSteps.vue`：

```vue
<script setup lang="ts">
import type { ExplainStep } from '~/core/types'
import { isRowDirection } from '~/core/axis'
import { explainItem } from '~/core/explain'
import { formatNumber, itemLabel, px } from '~/core/labels'

const { state, derived, selectedItem } = useFlexState()
const { measured } = useMeasure()
const { byId } = useDiagnostics()

interface Row { label: string, formula: string, substitution: string, result: string }

const n = (value: number): string => formatNumber(value)
const factor = (value: number): string => formatNumber(value, 2)
const sum = (terms: number[]): string => terms.map(n).join(' + ')
const boxOf = (id: string): string => `盒子 ${itemLabel(state.items.findIndex(item => item.id === id))}`
// gap 为 0 时不写：满屏的「+ 0」只会干扰
const accumulate = (terms: number[], gap: number): string => terms.map(n).join(gap > 0 ? ` + ${n(gap)} + ` : ' + ')

function basisText(step: Extract<ExplainStep, { kind: 'basis' }>): Pick<Row, 'formula' | 'substitution'> {
  switch (step.form) {
    case 'content': return { formula: `${step.raw} 取内容尺寸`, substitution: `内容尺寸 ${n(step.value)}` }
    case 'length': return { formula: '长度直接取值', substitution: step.raw }
    case 'percent': return { formula: '百分比 × 容器主轴', substitution: `${n(step.value)}% × ${n(step.factor)}` }
    case 'font': return { formula: `${step.unit} × 根字号`, substitution: `${n(step.value)} × ${n(step.factor)}` }
    case 'unit': return { formula: `1${step.unit} = ${n(step.factor)}px`, substitution: `${n(step.value)} × ${n(step.factor)}` }
  }
}

function rowOf(step: ExplainStep): Row {
  switch (step.kind) {
    case 'basis':
      return { label: 'basis', ...basisText(step), result: px(step.result) }
    case 'basis-runtime':
      return { label: 'basis', formula: '要到运行期才能确定（calc()、vw、ch 等）', substitution: step.raw, result: '—' }
    case 'unresolvable':
      return {
        label: '无法推导',
        formula: step.blockers.length > 0
          ? `${step.blockers.map(boxOf).join('、')} 的 basis 要到运行期才能确定`
          : '这个盒子的 basis 要到运行期才能确定',
        substitution: '整个容器的理论值都给不出',
        result: '—',
      }
    case 'line': {
      const used = step.terms.reduce((total, term) => total + term, 0) + (step.terms.length - 1) * step.gap
      const substitution = step.terms.length === 1 && used > step.limit
        ? `${n(used)} > ${n(step.limit)}，独占一行`
        : step.next === null
          ? `${accumulate(step.terms, step.gap)} = ${n(used)} ≤ ${n(step.limit)}`
          : `${accumulate([...step.terms, step.next], step.gap)} = ${n(used + step.gap + step.next)} > ${n(step.limit)}`
      return { label: '分行', formula: '按 order 累加 basis 与 gap，超出容器主轴就换行', substitution, result: `第 ${step.lineNumber} 行（共 ${step.lineCount} 行）` }
    }
    case 'free': {
      const gaps = step.terms.length - 1
      const used = gaps === 0 ? n(step.terms[0]) : `(${sum(step.terms)})`
      return {
        label: '本行剩余',
        formula: '容器主轴 − Σbasis − (n − 1) × gap',
        substitution: `${n(step.container)} − ${used}${gaps > 0 ? ` − ${gaps} × ${n(step.gap)}` : ''}`,
        result: step.result < 0 ? `${px(step.result)}（溢出）` : px(step.result),
      }
    }
    case 'balanced':
      return { label: '分配', formula: '剩余为 0，不伸不缩', substitution: '', result: px(0) }
    case 'grow':
      if (step.totalGrow === 0)
        return { label: 'grow 分配', formula: 'Σgrow = 0，不伸展', substitution: '', result: px(0) }
      return step.totalGrow < 1
        ? {
            label: 'grow 分配',
            formula: 'grow ÷ Σgrow × (剩余 × Σgrow)：Σgrow < 1 时只分出这个比例',
            substitution: `${factor(step.grow)} ÷ ${factor(step.totalGrow)} × (${n(step.free)} × ${factor(step.totalGrow)})`,
            result: px(step.result),
          }
        : { label: 'grow 分配', formula: 'grow ÷ Σgrow × 剩余', substitution: `${factor(step.grow)} ÷ ${factor(step.totalGrow)} × ${n(step.free)}`, result: px(step.result) }
    case 'shrink-weight':
      return { label: '收缩权重', formula: 'shrink × basis', substitution: `${factor(step.shrink)} × ${n(step.basis)}`, result: n(step.result) }
    case 'freeze':
      return {
        label: `冻结第 ${step.round} 轮`,
        formula: '分摊后压到 0 以下的盒子冻结在 0，溢出在其余盒子间重新分摊',
        substitution: step.frozen.map(record => `${boxOf(record.id)} 应让 ${n(record.share)}，basis 只有 ${n(record.basis)}`).join('；'),
        result: `溢出剩 ${px(step.remaining)}`,
      }
    case 'shrink-total':
      return { label: '权重和', formula: 'Σ(shrink × basis)，只计未冻结的盒子', substitution: sum(step.terms), result: n(step.result) }
    case 'shrink-share': {
      const scaled = step.factorSum < 1
      return {
        label: 'shrink 分摊',
        formula: scaled ? '权重 ÷ 权重和 × max(剩余溢出, 初始溢出 × Σshrink)：Σshrink < 1 时只分摊这个比例' : '权重 ÷ 权重和 × 溢出',
        substitution: `${n(step.weight)} ÷ ${n(step.weightSum)} × ${scaled ? `max(${n(step.overflow)}, ${n(step.initialOverflow)} × ${factor(step.factorSum)})` : n(step.overflow)}`,
        result: px(step.result),
      }
    }
    case 'no-shrink':
      return { label: 'shrink 分摊', formula: 'Σ(shrink × basis) = 0，不收缩，溢出留在行上', substitution: '', result: px(0) }
    case 'final':
      return {
        label: '理论最终',
        formula: 'basis + 分配',
        substitution: step.delta < 0 ? `${n(step.basis)} − ${n(-step.delta)}` : `${n(step.basis)} + ${n(step.delta)}`,
        result: px(step.result),
      }
  }
}

const rows = computed(() => selectedItem.value ? explainItem(state, derived.value, selectedItem.value.id).map(rowOf) : [])

const theoretical = computed(() => derived.value.items.find(item => item.id === selectedItem.value?.id)?.finalMainSize ?? null)

// 观测尚未产生时保持 null，不用 0 冒充
const actual = computed(() => {
  const record = measured.value?.items.find(item => item.id === selectedItem.value?.id)
  return record ? (isRowDirection(state.container.direction) ? record.width : record.height) : null
})

const diagnostic = computed(() => selectedItem.value ? byId.value.get(selectedItem.value.id) ?? null : null)
</script>

<template>
  <div data-testid="derivation">
    <p v-if="!selectedItem" data-testid="derivation-empty" class="text-xs op-60">
      点击演示区里的任意盒子，看它的尺寸是怎么算出来的
    </p>

    <table v-else class="w-full text-xs font-mono">
      <thead class="op-60">
        <tr>
          <th class="whitespace-nowrap py-1 pr-3 text-left font-normal">
            步骤
          </th>
          <th class="py-1 pr-3 text-left font-normal">
            公式
          </th>
          <th class="py-1 pr-3 text-left font-normal">
            代入
          </th>
          <th class="whitespace-nowrap py-1 text-right font-normal">
            结果
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index" data-testid="derivation-row" class="border-t border-bd">
          <td data-testid="step-label" class="whitespace-nowrap py-1 pr-3 font-sans">
            {{ row.label }}
          </td>
          <td data-testid="step-formula" class="py-1 pr-3 font-sans op-70">
            {{ row.formula }}
          </td>
          <td data-testid="step-substitution" class="py-1 pr-3">
            {{ row.substitution }}
          </td>
          <td data-testid="step-result" class="whitespace-nowrap py-1 text-right">
            {{ row.result }}
          </td>
        </tr>
        <tr data-testid="derivation-actual" class="border-t border-bd">
          <td class="whitespace-nowrap py-1 pr-3 font-sans">
            实际
          </td>
          <td class="py-1 pr-3 font-sans op-70">
            浏览器排版
          </td>
          <td class="py-1 pr-3" />
          <td class="whitespace-nowrap py-1 text-right">
            {{ actual === null ? '—' : px(actual) }}<template v-if="!diagnostic && actual !== null && theoretical !== null">
              ✓
            </template>
          </td>
        </tr>
        <tr v-if="diagnostic" data-testid="derivation-diagnosis">
          <td colspan="4" class="py-1 font-sans">
            <DiagnosisText :diagnostic="diagnostic" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/components/playground/DerivationSteps.spec.ts && pnpm tscheck && pnpm lint`
Expected: 全部 PASS。`rowOf` 与 `basisText` 的 `switch` 没有 `default`：新增 `ExplainStep` 种类而忘了写文案时，`tscheck` 会报「函数缺少结束 return」，这正是想要的拦截，不要补 `default` 把它吞掉。

- **Step 5: 提交**

走 `/commit`，提交信息：`feat: 推导页把选中盒子的理论推导展开成四列表格`（含重新生成的 `components.d.ts`）。

---

### Task 7: 底部面板加标签页 `ComparePanel.vue`

**Files:**
- Create: `src/components/playground/ComparePanel.vue`
- Create: `src/components/playground/ComparePanel.spec.ts`
- Modify: `src/components/playground/ThePlayground.vue:52-61`

**Interfaces:**
- Consumes: `<MetricsTable />`、`<DerivationSteps />`。
- Produces: `<ComparePanel />`，根元素 `data-testid="compare-panel"`；标签按钮 `data-testid="tab-metrics"` / `tab-derivation`，`id` 为 `compare-tab-<key>`；面板 `id` 为 `compare-panel-<key>`。

- **Step 1: 写失败的测试**

`src/components/playground/ComparePanel.spec.ts`：

```ts
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ComparePanel from './ComparePanel.vue'

function hidden(wrapper: ReturnType<typeof mount>, key: string): boolean {
  return (wrapper.get(`#compare-panel-${key}`).attributes('style') ?? '').includes('display: none')
}

describe('comparePanel', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useMeasure().measured.value = null
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('默认停在明细表', () => {
    const wrapper = mount(ComparePanel)

    expect(wrapper.get('[data-testid="tab-metrics"]').attributes('aria-selected')).toBe('true')
    expect(hidden(wrapper, 'metrics')).toBe(false)
    expect(hidden(wrapper, 'derivation')).toBe(true)
  })

  it('点推导过程切过去，标签名带上选中的盒子', async () => {
    useFlexState().selectItem('item-2')
    const wrapper = mount(ComparePanel)
    await wrapper.get('[data-testid="tab-derivation"]').trigger('click')

    expect(wrapper.get('[data-testid="tab-derivation"]').text()).toBe('推导过程 · 盒子 B')
    expect(wrapper.get('[data-testid="tab-derivation"]').attributes('aria-selected')).toBe('true')
    expect(hidden(wrapper, 'derivation')).toBe(false)
    expect(hidden(wrapper, 'metrics')).toBe(true)
  })

  it('选中盒子不会把明细表切走', async () => {
    const wrapper = mount(ComparePanel)
    useFlexState().selectItem('item-1')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="tab-metrics"]').attributes('aria-selected')).toBe('true')
  })

  it('方向键切换标签，焦点跟着走', async () => {
    const wrapper = mount(ComparePanel, { attachTo: document.body })
    const metricsTab = wrapper.get('[data-testid="tab-metrics"]')
    ;(metricsTab.element as HTMLElement).focus()
    await metricsTab.trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.get('[data-testid="tab-derivation"]').attributes('aria-selected')).toBe('true')
    expect(document.activeElement?.id).toBe('compare-tab-derivation')

    await wrapper.get('[data-testid="tab-derivation"]').trigger('keydown', { key: 'Home' })
    expect(document.activeElement?.id).toBe('compare-tab-metrics')
    wrapper.unmount()
  })

  it('只有当前标签进 Tab 键序列，面板指回自己的标签', () => {
    const wrapper = mount(ComparePanel)

    expect(wrapper.get('[data-testid="tab-metrics"]').attributes('tabindex')).toBe('0')
    expect(wrapper.get('[data-testid="tab-derivation"]').attributes('tabindex')).toBe('-1')
    expect(wrapper.get('#compare-panel-derivation').attributes('aria-labelledby')).toBe('compare-tab-derivation')
  })
})
```

- **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/ComparePanel.spec.ts`
Expected: FAIL，组件不存在。

- **Step 3: 实现**

`src/components/playground/ComparePanel.vue`：

```vue
<script setup lang="ts">
import { itemLabel } from '~/core/labels'

const { state } = useFlexState()

type TabKey = 'metrics' | 'derivation'
const active = ref<TabKey>('metrics')

const tabs = computed<{ key: TabKey, label: string }[]>(() => {
  const index = state.items.findIndex(item => item.id === state.selectedId)
  return [
    { key: 'metrics', label: '明细表' },
    { key: 'derivation', label: index === -1 ? '推导过程' : `推导过程 · 盒子 ${itemLabel(index)}` },
  ]
})

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End'])

/** WAI-ARIA tabs：方向键移动即切换，焦点跟着走 */
function onKeydown(event: KeyboardEvent): void {
  if (!NAV_KEYS.has(event.key))
    return
  event.preventDefault()
  const keys = tabs.value.map(tab => tab.key)
  const current = keys.indexOf(active.value)
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? keys.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length
  active.value = keys[next]
  document.getElementById(`compare-tab-${keys[next]}`)?.focus()
}
</script>

<template>
  <!-- 固定高度：行数随盒子增删变化，自适应会把上面的演示区挤得忽大忽小 -->
  <section data-testid="compare-panel" class="h-52 flex shrink-0 flex-col gap-space overflow-hidden panel p-space">
    <div class="flex shrink-0 flex-wrap items-center gap-space">
      <h2 class="panel-title">
        <div class="i-carbon-compare" />
        理论 vs 实际
      </h2>
      <div role="tablist" aria-label="理论 vs 实际" class="flex gap-tight text-xs" @keydown="onKeydown">
        <button
          v-for="tab in tabs"
          :id="`compare-tab-${tab.key}`"
          :key="tab.key"
          :data-testid="`tab-${tab.key}`"
          type="button"
          role="tab"
          :aria-selected="active === tab.key"
          :aria-controls="`compare-panel-${tab.key}`"
          :tabindex="active === tab.key ? 0 : -1"
          class="cursor-pointer border-b-2 border-transparent px-1 py-0.5 op-60 transition-colors aria-selected:border-accent aria-selected:text-accent aria-selected:op-100 hover:op-100"
          @click="active = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div
      v-for="tab in tabs"
      v-show="active === tab.key"
      :id="`compare-panel-${tab.key}`"
      :key="tab.key"
      role="tabpanel"
      :aria-labelledby="`compare-tab-${tab.key}`"
      tabindex="0"
      class="min-h-0 flex-1 overflow-auto"
    >
      <MetricsTable v-if="tab.key === 'metrics'" />
      <DerivationSteps v-else />
    </div>
  </section>
</template>
```

`ThePlayground.vue`：把第 52–61 行（注释「固定高度…」到 `</section>`）整段替换为 `<ComparePanel />`。

- **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/components/playground/ && pnpm tscheck && pnpm lint`
Expected: 全部 PASS，`ThePlayground.spec.ts` 不改照样通过（`metrics` 仍在 DOM 里，只是被 `v-show` 切换）。

- **Step 5: 提交**

走 `/commit`，提交信息：`feat: 理论 vs 实际面板加推导过程标签页，跟随选中的盒子`（含 `components.d.ts`）。

---

### Task 8: 零消费方收尾

**Files:**
- Modify: `src/core/types.ts`、`src/core/deriveLayout.ts`、`src/core/distribute.ts`、`src/core/diagnostics.ts`
- Modify: 对应的 `*.spec.ts`

- **Step 1: 逐个字段查生产消费方**

Run（zsh 下 `--include` 的通配必须加引号）：

```bash
for f in usedMainSize totalShrinkWeighted basisResolved hypotheticalMainSize deltaFromGrow deltaFromShrink freeSpace totalGrow remainingFreeSpace shrinkRounds 'theoretical' 'actual' shrinkWeight computeFreeSpace; do
  echo "== $f"; grep -rnw "$f" src --include='*.ts' --include='*.vue' | grep -v '\.spec\.ts' | grep -v 'core/types.ts'
done
```

判据：除定义处与 `*.spec.ts` 之外没有任何读取 → 零消费方。预期结论（以实际输出为准，不符时按实际处理并在提交信息里写明）：

| 定义 | 预期 | 处置 |
| --- | --- | --- |
| `DerivedLine.usedMainSize` | 只有 `deriveLayout` 写 | 删字段与赋值；`overlay.spec.ts` 的 `makeLines` 字面量同步删 |
| `DerivedLine.totalShrinkWeighted` | 只有 `deriveLayout` 写（已被每轮 `weightSum` 取代） | 删字段与赋值；`overlay.spec.ts` 字面量同步删；`deriveLayout.spec.ts` 第 147 行「每行都记录 totalGrow 与 totalShrinkWeighted」只留 `totalGrow` 的断言并改名 |
| `shrinkWeight` 的 `export` | 删掉上一条后只剩 `distribute.ts` 内部与它自己的单测 | 去掉 `export`；`distribute.spec.ts` 第 122 行直接调用它的断言删掉（同一用例已有经 `distributeShrink` 的断言兜着），第 4 行 import 去掉它 |
| `Diagnostic.theoretical` / `actual` | 只有 `diagnostics.ts` 写，界面读的是明细表行对象、叠加层行对象上的同名字段 | 删字段；`diagnostics.ts` 的 `base` 只留 `itemId`；`diagnostics.spec.ts` 第 71–72 行与第 263 行对这两个字段的断言改成等价的断言（第 263 行那个用例钉的是「主轴纵向时高度偏离才算数」，改成断言 `real[0].itemId` 与 `rule`；读上下文确认，不要只删不补） |
| 其余（`basisResolved` 等） | 已被 `explain.ts` 读取 | 保留 |

- **Step 2: 删除并跑全量**

Run: `pnpm test && pnpm tscheck && pnpm lint`
Expected: 全部 PASS。

- **Step 3: 提交**

走 `/commit`，提交信息：`refactor(core): 删掉公式展开落地后仍零消费方的推导与诊断字段`

---

### Task 9: 浏览器验证与文档收尾

**Files:**
- Modify: `.docs/progress.md`（里程碑表、交接节、新增「公式展开」一节，删掉待办节里「不要按零消费方规则删掉」的保留说明）
- Modify: `.docs/architecture.md`（分层表 `src/core/` 一格补上 `explain`；关键类型补 `ExplainStep` / `ShrinkRound`）
- Modify: `.docs/superpowers/specs/2026-10-08-formula-expansion-design.md`（状态行改为已实施，链到 progress 新节）

- **Step 1: 读浏览器验证文档**

读 [browser-verification.md](../../browser-verification.md) 全文，尤其第六节（CDP 驱动 headless Chrome、`?t=` 模块 URL 的坑、`visibilityState`）。

- **Step 2: 起 dev server，用 CDP 驱动 headless Chrome 核对**

每轮先跑已知答案的探针（默认状态下明细表 A 行理论 80px、实际 80px），确认环境可信再看现象。以 DOM 为准，逐项记录数字：

1. 视口 1024×800：选中盒子 A、切到推导页，量四列各自宽度、是否折行、`#compare-panel-derivation` 的 `scrollHeight` 是否大于 `clientHeight`（应能在面板内滚动）、整页 `document.documentElement.scrollWidth` 不超过视口宽（不得整页横滚）。
2. 视口 1440×900：同上，记录宽度富余时是否一行一步不折行。
3. 推导页末行实际值与明细表同一盒子的实际列文本一致（切回明细表读一次比对）。
4. 冻结场景（容器 110、A `10px` shrink 10、B `300px`、gap 0）：DOM 里出现「冻结第 1 轮」行。
5. `min-width:auto` 场景（容器 300、两盒 basis `300px`、A 内容 240）：推导页末行无 ✓，诊断行文案含 `min-width:auto`。
6. 键盘：Tab 进标签列表，→ 切到推导页，`document.activeElement.id === 'compare-tab-derivation'`。
7. console 无报错。

任何一项不符：按 systematic-debugging 先在真实环境复现缺陷本身，再改，不要凭推断改。

- **Step 3: 全量验证**

Run: `pnpm test && pnpm lint && pnpm tscheck && pnpm build`
Expected: 全部通过，记下测试总数。

- **Step 4: 写文档**

`progress.md` 新增「## 公式展开（2026-10-xx）」一节，放在「观测层取整误报」节之前，写：做了什么、Task 4 六条变异的结果、随机守卫各分支命中次数、Step 2 的浏览器实测数字、**折行与面板内滚动没有自动化守卫**（happy-dom 不排版）这句原话。里程碑表加一行；交接节改为本功能完成后的状态；「还开着的事」删掉公式展开一项；待办节整节删除（功能已落地，保留说明随之失效）。

- **Step 5: 提交**

走 `/commit`，提交信息：`docs: 记下公式展开的浏览器实测与守卫，交接节同步`
