# M3 收尾：叠加层与容器拖拽 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给演示区加上 SVG 叠加层（剩余空间色块、主/交叉轴箭头、尺寸 HUD）与右下角 resize 拖拽手柄，补齐 M3「透明化核心」的最后两块。

**Architecture:** 几何计算全部下沉到纯函数 `core/overlay.ts`（输入 state + derived + measured，输出矩形与对照数值），组件只负责把几何画成 SVG。叠加层与手柄**不能放进 `.stage` 内部**——`.stage` 是真实 flex 容器，任何子元素都会变成第 N+1 个 flex item 污染演示，所以 `DemoStage` 里包一层 `position: relative` 的 wrapper，让二者与 `.stage` 同级绝对定位。叠加层的显隐是 UI 偏好，放独立的 `useOverlay`，不进 `FlexState`（M6 的 URL 短码只该带布局状态）。

**Tech Stack:** Vue 3 script setup · TypeScript · UnoCSS · VueUse(`useEventListener`) · Vitest + @vue/test-utils · 内联 SVG（不引图形库）

**Spec:** `docs/superpowers/specs/2026-09-08-todo-flex-design.md`（§3 信息架构、§5 模块表 `components/playground/OverlayLayer.vue`、§7 视觉分层「叠加层」一行、§15 里程碑 M3）

## Global Constraints

- 包管理器固定 **pnpm**；TypeScript 锁 6.x，不得升级；已有依赖不自行升级；本计划**不新增任何依赖**。
- `src/core/` 下零 DOM、零 vue 依赖——`overlay.ts` 只接收纯数据，不碰 `document`、不 import vue。
- 观测层禁止 `getBoundingClientRect()`：几何一律取自 `useMeasure` 已有的 `offsetLeft/offsetTop` + `ResizeObserver` 尺寸。
- 演示区描边一律 `outline`，禁止 `border` 与 `padding`（`.stage` / `.stage-item` 上都是）。叠加层不属于演示区盒子，但也不得给 `.stage` 或 `.stage-item` 添加任何占布局空间的样式。
- `.stage-item` 禁止 `overflow: hidden`。
- 推导引擎故意不模拟 `min-width: auto` 的下限截断，本计划不得"顺手补上"。
- 代码注释、提交信息、对话回复一律简体中文；代码标识符用英文。
- 组件与 composable 的 import 沿用现有显式写法（`import { useFlexState } from '~/composables/useFlexState'`），不依赖自动导入——`auto-imports.d.ts` / `components.d.ts` 是生成物，不要手改。
- 格式问题交给 `pnpm lint:fix`，不要手动排版。
- **提交走 `/commit` skill**，不要手写 `git add` + `git commit`。当前分支 `dev`。
- **本计划刻意不做**（写在这里免得执行者以为漏了）：
  - **选中光晕**：设计文档 §115 把它列在 OverlayLayer 名下，但 `.stage-item.is-selected` 已有 `box-shadow` 实现了同一效果，叠加层不重复画一遍。
  - **斜纹的流动动画**：设计文档 §7 写的是「剩余空间流动斜纹」，动画属于 M4「叠加层动画」，本计划只画静态斜纹。
  - **交叉轴方向的剩余空间色块**：多行 + `align-content` 才有意义，留到后续里程碑。
- 单元测试跑在 happy-dom 下，**没有排版引擎**——所有实测尺寸都是 0。组件测试要么伪造 `useMeasure().measured.value`，要么只验证接线，不要断言真实排版结果。

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `src/core/axis.ts`（改） | 新增 `axisVectors()`：direction + wrap → 主轴/交叉轴的屏幕坐标单位向量 |
| `src/core/axis.spec.ts`（新建） | `axisVectors` 的测试（该文件目前不存在，本计划一并建立） |
| `src/core/overlay.ts`（新建） | `computeOverlay()`：算出剩余空间色块矩形、溢出标记、每行理论/实际剩余空间对照。纯函数 |
| `src/core/overlay.spec.ts`（新建） | 上者的 TDD 测试 |
| `src/core/defaults.ts`（改） | 新增 `STAGE_LIMITS` 常量（演示区尺寸上下限，手柄与键盘微调共用） |
| `src/composables/useOverlay.ts`（新建） | 模块级单例：叠加层显隐 `visible`、当前悬停盒子 `hoveredId` |
| `src/composables/useOverlay.spec.ts`（新建） | 单例语义与开关行为的测试 |
| `src/components/playground/OverlayLayer.vue`（新建） | 把 `OverlayGeometry` 画成 SVG：斜纹色块、轴向箭头、尺寸 HUD。`pointer-events: none` |
| `src/components/playground/OverlayLayer.spec.ts`（新建） | 伪造 `measured` 后断言 SVG 元素 |
| `src/components/playground/StageResizer.vue`（新建） | 右下角手柄：pointer 拖拽 + 方向键微调，写回 `state.container.width/height` |
| `src/components/playground/StageResizer.spec.ts`（新建） | 拖拽与键盘的行为测试 |
| `src/components/playground/DemoStage.vue`（改） | 包 wrapper、挂载 OverlayLayer 与 StageResizer、盒子上报 hover |
| `src/components/playground/ThePlayground.vue`（改） | 删掉两个 range 滑块，改为叠加层开关 + 当前尺寸只读显示 |
| `src/components/playground/ThePlayground.spec.ts`（改） | 「滑块改尺寸」的用例换成「手柄键盘微调改尺寸」 |

---

### Task 1: 轴向单位向量（`core/axis.ts`）

叠加层的主/交叉轴箭头需要知道往哪儿画。这是纯粹的 direction/wrap 换算，属于 `axis.ts` 的既有职责。

**Files:**
- Modify: `src/core/axis.ts`
- Test: `src/core/axis.spec.ts`（新建）

**Interfaces:**
- Consumes: `FlexContainerState`、`isRowDirection`（`src/core/axis.ts` 已有）
- Produces: `export interface AxisVector { dx: number, dy: number }`、`export function axisVectors(container: FlexContainerState): { main: AxisVector, cross: AxisVector }`。向量是**屏幕坐标系**下的单位向量：x 向右为正，y 向下为正。

- [ ] **Step 1: 写失败的测试**

新建 `src/core/axis.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { axisVectors } from './axis'
import { createDefaultState } from './defaults'

describe('axisVectors', () => {
  it('row 的主轴向右、交叉轴向下', () => {
    const { container } = createDefaultState()
    expect(axisVectors(container)).toEqual({
      main: { dx: 1, dy: 0 },
      cross: { dx: 0, dy: 1 },
    })
  })

  it('row-reverse 只翻转主轴，交叉轴不动', () => {
    const { container } = createDefaultState()
    container.direction = 'row-reverse'
    expect(axisVectors(container)).toEqual({
      main: { dx: -1, dy: 0 },
      cross: { dx: 0, dy: 1 },
    })
  })

  it('column 时主轴向下、交叉轴向右', () => {
    const { container } = createDefaultState()
    container.direction = 'column'
    expect(axisVectors(container)).toEqual({
      main: { dx: 0, dy: 1 },
      cross: { dx: 1, dy: 0 },
    })
  })

  it('wrap-reverse 只翻转交叉轴，主轴不动', () => {
    const { container } = createDefaultState()
    container.wrap = 'wrap-reverse'
    expect(axisVectors(container)).toEqual({
      main: { dx: 1, dy: 0 },
      cross: { dx: 0, dy: -1 },
    })
  })

  it('column-reverse + wrap-reverse 两轴同时翻转', () => {
    const { container } = createDefaultState()
    container.direction = 'column-reverse'
    container.wrap = 'wrap-reverse'
    expect(axisVectors(container)).toEqual({
      main: { dx: 0, dy: -1 },
      cross: { dx: -1, dy: 0 },
    })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/axis.spec.ts`
Expected: FAIL，报 `axisVectors` 不是导出的函数（`No "axisVectors" export is defined`）。

- [ ] **Step 3: 写最小实现**

在 `src/core/axis.ts` 末尾追加：

```ts
/** 屏幕坐标系下的单位向量：x 向右为正，y 向下为正 */
export interface AxisVector {
  dx: number
  dy: number
}

/**
 * 主轴与交叉轴的方向，给叠加层画箭头用。
 * `-reverse` 翻主轴，`wrap-reverse` 翻交叉轴，两者互不影响。
 */
export function axisVectors(container: FlexContainerState): { main: AxisVector, cross: AxisVector } {
  const mainSign = container.direction.endsWith('-reverse') ? -1 : 1
  const crossSign = container.wrap === 'wrap-reverse' ? -1 : 1

  return isRowDirection(container.direction)
    ? { main: { dx: mainSign, dy: 0 }, cross: { dx: 0, dy: crossSign } }
    : { main: { dx: 0, dy: mainSign }, cross: { dx: crossSign, dy: 0 } }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/core/axis.spec.ts`
Expected: PASS，5 个用例全绿。

- [ ] **Step 5: 提交**

调用 `/commit` skill 提交这两个文件，建议信息：`feat(core): 补齐轴向单位向量换算`。

---

### Task 2: 叠加层几何（`core/overlay.ts`）

本计划的核心。把「浏览器排完版之后，行内哪些像素是空的」算出来——这是画色块的唯一数据来源，也是唯一能 TDD 的部分。

**关键约定（写进代码注释）：**
1. 一切在**屏幕坐标空间**里算：从容器左上角 0 出发向右/向下扫，与 `row-reverse` 这类主轴方向的正负无关。
2. 相邻盒子之间的空隙要**扣掉 `gap`**——gap 是用户显式要的间距，不是「没人要的剩余空间」。扣完 ≤ 阈值就不画。
3. 色块紧贴**后一个**盒子画，gap 留在前一个盒子那侧。视觉上二者不可分，这是约定不是推导。
4. 行尾空隙为负说明溢出，画成 `overflow` 标记而不是负宽色块。

**Files:**
- Create: `src/core/overlay.ts`
- Test: `src/core/overlay.spec.ts`

**Interfaces:**
- Consumes: `FlexState` / `DerivedLayout` / `MeasuredStage` / `MeasuredItem`（`src/core/types.ts`）、`isRowDirection` + `mainAxisGap`（`src/core/axis.ts`）
- Produces:
  - `export type BandKind = 'free' | 'overflow'`
  - `export interface OverlayBand { kind: BandKind, lineIndex: number, x: number, y: number, width: number, height: number }`
  - `export interface OverlayLine { index: number, theoretical: number, actual: number }`
  - `export interface OverlayGeometry { bands: OverlayBand[], lines: OverlayLine[] }`
  - `export function computeOverlay(state: FlexState, derived: DerivedLayout, measured: MeasuredStage): OverlayGeometry`

- [ ] **Step 1: 写失败的测试**

新建 `src/core/overlay.spec.ts`：

```ts
import type { DerivedLayout, MeasuredStage } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultState } from './defaults'
import { deriveLayout } from './deriveLayout'
import { computeOverlay } from './overlay'

/** 只有 computeOverlay 用得到的字段是真的，其余补默认值 */
function makeLines(lines: { index: number, itemIds: string[], freeSpace: number }[]): DerivedLayout {
  return {
    lines: lines.map(line => ({
      ...line,
      usedMainSize: 0,
      totalGrow: 0,
      totalShrinkWeighted: 0,
    })),
    items: [],
    steps: [],
  }
}

function stage(width: number, height: number, items: MeasuredStage['items']): MeasuredStage {
  return { width, height, items }
}

describe('computeOverlay', () => {
  it('行尾的空白画成一块剩余空间色块', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: 300 }])
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
    ])

    const { bands } = computeOverlay(state, derived, measured)

    expect(bands).toEqual([
      { kind: 'free', lineIndex: 0, x: 100, y: 0, width: 300, height: 200 },
    ])
  })

  it('盒子之间的空隙扣掉 gap，剩下的才算剩余空间', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 20
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], freeSpace: 180 }])
    // 两个盒子之间隔了 100px，其中 20px 是 gap，剩下 80px 才是剩余空间
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
      { id: 'item-2', left: 200, top: 0, width: 100, height: 200 },
    ])

    const { bands } = computeOverlay(state, derived, measured)

    expect(bands).toEqual([
      // 紧贴后一个盒子画：200 - 80 = 120 起，宽 80
      { kind: 'free', lineIndex: 0, x: 120, y: 0, width: 80, height: 200 },
      { kind: 'free', lineIndex: 0, x: 300, y: 0, width: 100, height: 200 },
    ])
  })

  it('空隙恰好等于 gap 时不画色块', () => {
    const state = createDefaultState()
    state.container.width = 220
    state.container.columnGap = 20
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], freeSpace: 0 }])
    const measured = stage(220, 200, [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
      { id: 'item-2', left: 120, top: 0, width: 100, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([])
  })

  it('盒子撑出容器时画成 overflow 标记而不是负宽色块', () => {
    const state = createDefaultState()
    state.container.width = 200
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: -80 }])
    const measured = stage(200, 200, [
      { id: 'item-1', left: 0, top: 0, width: 280, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([
      { kind: 'overflow', lineIndex: 0, x: 200, y: 0, width: 80, height: 200 },
    ])
  })

  it('column 方向上主轴换成纵向，色块横跨该行的宽度', () => {
    const state = createDefaultState()
    state.container.direction = 'column'
    state.container.height = 300
    state.container.rowGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: 200 }])
    const measured = stage(400, 300, [
      { id: 'item-1', left: 0, top: 0, width: 400, height: 100 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([
      { kind: 'free', lineIndex: 0, x: 0, y: 100, width: 400, height: 200 },
    ])
  })

  it('多行各算各的，色块只覆盖本行的交叉轴范围', () => {
    const state = createDefaultState()
    state.container.width = 300
    state.container.wrap = 'wrap'
    state.container.columnGap = 0
    const derived = makeLines([
      { index: 0, itemIds: ['item-1'], freeSpace: 100 },
      { index: 1, itemIds: ['item-2'], freeSpace: 200 },
    ])
    const measured = stage(300, 200, [
      { id: 'item-1', left: 0, top: 0, width: 200, height: 90 },
      { id: 'item-2', left: 0, top: 110, width: 100, height: 90 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([
      { kind: 'free', lineIndex: 0, x: 200, y: 0, width: 100, height: 90 },
      { kind: 'free', lineIndex: 1, x: 100, y: 110, width: 200, height: 90 },
    ])
  })

  it('亚像素级的空隙不画，免得满屏发丝色块', () => {
    const state = createDefaultState()
    state.container.width = 200.3
    state.container.columnGap = 0
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: 0.3 }])
    const measured = stage(200.3, 200, [
      { id: 'item-1', left: 0, top: 0, width: 200, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).bands).toEqual([])
  })

  it('观测里还没有这一行的盒子时跳过，不猜', () => {
    const state = createDefaultState()
    const derived = makeLines([{ index: 0, itemIds: ['item-1'], freeSpace: 100 }])
    const measured = stage(400, 200, [])

    expect(computeOverlay(state, derived, measured)).toEqual({ bands: [], lines: [] })
  })

  it('每行同时给出理论与实际剩余空间，供图例并排对照', () => {
    const state = createDefaultState()
    state.container.width = 400
    state.container.columnGap = 20
    const derived = makeLines([{ index: 0, itemIds: ['item-1', 'item-2'], freeSpace: 180 }])
    // 实际渲染里两个盒子各 120（被 min-width:auto 撑住了），实际剩余 400-240-20=140
    const measured = stage(400, 200, [
      { id: 'item-1', left: 0, top: 0, width: 120, height: 200 },
      { id: 'item-2', left: 140, top: 0, width: 120, height: 200 },
    ])

    expect(computeOverlay(state, derived, measured).lines).toEqual([
      { index: 0, theoretical: 180, actual: 140 },
    ])
  })

  it('接得住推导引擎的真实输出（默认状态下三个盒子一行）', () => {
    const state = createDefaultState()
    const derived = deriveLayout(state)
    const measured = stage(720, 320, [
      { id: 'item-1', left: 0, top: 0, width: 80, height: 320 },
      { id: 'item-2', left: 92, top: 0, width: 80, height: 320 },
      { id: 'item-3', left: 184, top: 0, width: 80, height: 320 },
    ])

    const { bands, lines } = computeOverlay(state, derived, measured)

    expect(lines).toHaveLength(1)
    // 720 - 240 - 24 = 456
    expect(lines[0].actual).toBe(456)
    expect(bands.at(-1)).toEqual({ kind: 'free', lineIndex: 0, x: 264, y: 0, width: 456, height: 320 })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/overlay.spec.ts`
Expected: FAIL，报找不到模块 `./overlay`。

- [ ] **Step 3: 写最小实现**

新建 `src/core/overlay.ts`：

```ts
import type {
  DerivedLayout,
  FlexState,
  MeasuredItem,
  MeasuredStage,
} from './types'
import { isRowDirection, mainAxisGap } from './axis'

/**
 * 低于这个像素数的空隙不画。
 * 亚像素舍入随时带来零点几像素的偏差，不设阈值会画出满屏发丝色块。
 * 与 diagnostics.ts 的 TOLERANCE 同一个量级，出于同一个理由。
 */
const EPSILON = 0.5

export type BandKind = 'free' | 'overflow'

/** 叠加层里的一块矩形，坐标以演示区左上角为原点 */
export interface OverlayBand {
  kind: BandKind
  lineIndex: number
  x: number
  y: number
  width: number
  height: number
}

/** 每行的剩余空间对照：理论值来自推导引擎，实际值由观测值反算 */
export interface OverlayLine {
  index: number
  theoretical: number
  actual: number
}

export interface OverlayGeometry {
  bands: OverlayBand[]
  lines: OverlayLine[]
}

/**
 * 算出「浏览器排完版之后，行内哪些像素是空的」。
 *
 * 一切都在屏幕坐标空间里算：从容器左上角 0 出发向右/向下扫，
 * 与 row-reverse 这类主轴方向的正负无关——反向排列只是让盒子的坐标顺序变了，
 * 空白像素还是那些空白像素。
 */
export function computeOverlay(
  state: FlexState,
  derived: DerivedLayout,
  measured: MeasuredStage,
): OverlayGeometry {
  const { container } = state
  const isRow = isRowDirection(container.direction)
  const gap = mainAxisGap(container)
  // 容器主轴尺寸取实测值而非状态值：状态值是我们要求的，实测值才是浏览器给的
  const containerMain = isRow ? measured.width : measured.height
  const measuredById = new Map(measured.items.map(item => [item.id, item]))

  const mainStart = (record: MeasuredItem): number => (isRow ? record.left : record.top)
  const mainSize = (record: MeasuredItem): number => (isRow ? record.width : record.height)
  const crossStart = (record: MeasuredItem): number => (isRow ? record.top : record.left)
  const crossSize = (record: MeasuredItem): number => (isRow ? record.height : record.width)

  const bands: OverlayBand[] = []
  const lines: OverlayLine[] = []

  for (const line of derived.lines) {
    const records = line.itemIds
      .map(id => measuredById.get(id))
      .filter((record): record is MeasuredItem => Boolean(record))
      .sort((a, b) => mainStart(a) - mainStart(b))

    // 观测还没跟上状态（盒子刚增删）时跳过这一行，不猜
    if (records.length === 0)
      continue

    const crossFrom = Math.min(...records.map(crossStart))
    const crossTo = Math.max(...records.map(record => crossStart(record) + crossSize(record)))

    const push = (kind: BandKind, from: number, length: number): void => {
      bands.push(makeBand(kind, line.index, isRow, from, length, crossFrom, crossTo - crossFrom))
    }

    let cursor = 0
    for (const record of records) {
      // 盒子之间的空隙里，gap 是用户显式要的间距，扣掉它，剩下的才是「没人要的剩余空间」。
      // 色块紧贴后一个盒子画，gap 留在前一个盒子那侧——视觉上二者不可分，这是约定。
      const deduct = cursor === 0 ? 0 : gap
      const free = mainStart(record) - cursor - deduct
      if (free > EPSILON)
        push('free', mainStart(record) - free, free)

      // 盒子可能重叠（margin 为负等），游标只前进不后退
      cursor = Math.max(cursor, mainStart(record) + mainSize(record))
    }

    const tail = containerMain - cursor
    if (tail > EPSILON)
      push('free', cursor, tail)
    else if (tail < -EPSILON)
      push('overflow', containerMain, -tail)

    const used = records.reduce((sum, record) => sum + mainSize(record), 0)
    lines.push({
      index: line.index,
      theoretical: line.freeSpace,
      actual: containerMain - used - gap * Math.max(records.length - 1, 0),
    })
  }

  return { bands, lines }
}

/** 把「主轴 + 交叉轴」的一段范围翻译成屏幕坐标的矩形 */
function makeBand(
  kind: BandKind,
  lineIndex: number,
  isRow: boolean,
  mainFrom: number,
  mainLength: number,
  crossFrom: number,
  crossLength: number,
): OverlayBand {
  return isRow
    ? { kind, lineIndex, x: mainFrom, y: crossFrom, width: mainLength, height: crossLength }
    : { kind, lineIndex, x: crossFrom, y: mainFrom, width: crossLength, height: mainLength }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/core/overlay.spec.ts`
Expected: PASS，10 个用例全绿。

- [ ] **Step 5: 跑一遍全量测试确认没碰坏别的**

Run: `pnpm test`
Expected: 全绿。

- [ ] **Step 6: 提交**

调用 `/commit` skill 提交，建议信息：`feat(core): 计算叠加层几何，画出真实剩余空间`。

---

### Task 3: 叠加层开关（`composables/useOverlay.ts`）

**Files:**
- Create: `src/composables/useOverlay.ts`
- Test: `src/composables/useOverlay.spec.ts`

**Interfaces:**
- Produces: `export function useOverlay(): { visible: Ref<boolean>, hoveredId: Ref<string | null>, setHovered: (id: string | null) => void, toggleVisible: () => void }`。模块级单例，语义与 `useFlexState` / `useMeasure` 一致：任何组件调用拿到的都是同一份。

- [ ] **Step 1: 写失败的测试**

新建 `src/composables/useOverlay.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { useOverlay } from './useOverlay'

describe('useOverlay', () => {
  it('叠加层默认开着', () => {
    expect(useOverlay().visible.value).toBe(true)
  })

  it('是模块级单例，两次调用拿到同一份状态', () => {
    const first = useOverlay()
    const second = useOverlay()

    first.toggleVisible()
    expect(second.visible.value).toBe(false)

    second.toggleVisible()
    expect(first.visible.value).toBe(true)
  })

  it('记录当前悬停的盒子，移开时清空', () => {
    const { hoveredId, setHovered } = useOverlay()

    setHovered('item-2')
    expect(hoveredId.value).toBe('item-2')

    setHovered(null)
    expect(hoveredId.value).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/composables/useOverlay.spec.ts`
Expected: FAIL，找不到模块 `./useOverlay`。

- [ ] **Step 3: 写最小实现**

新建 `src/composables/useOverlay.ts`：

```ts
import { ref } from 'vue'

/**
 * 叠加层的显隐是纯 UI 偏好，刻意不放进 FlexState——
 * M6 的 URL 短码只该携带布局状态，分享出去的链接不必带上「对方要不要看色块」。
 */
const visible = ref(true)

/** 当前鼠标悬停的盒子，决定尺寸 HUD 显示在谁头上 */
const hoveredId = ref<string | null>(null)

function setHovered(id: string | null): void {
  hoveredId.value = id
}

function toggleVisible(): void {
  visible.value = !visible.value
}

/** 全站唯一的叠加层 UI 状态 */
export function useOverlay() {
  return { visible, hoveredId, setHovered, toggleVisible }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/composables/useOverlay.spec.ts`
Expected: PASS，3 个用例全绿。

- [ ] **Step 5: 提交**

调用 `/commit` skill 提交，建议信息：`feat(playground): 添加叠加层 UI 开关状态`。

---

### Task 4: 叠加层组件与演示区接线

`OverlayLayer.vue` 只做一件事：把 `computeOverlay` 的输出画成 SVG。同时改造 `DemoStage.vue` 包上 wrapper——**这是本计划唯一动到的现有结构**。

**为什么必须包 wrapper：** `.stage` 是真实 flex 容器，任何直接子元素都会变成第 N+1 个 flex item，把 SVG 塞进去会直接污染演示。所以 wrapper 用 `position: relative` + `w-fit`，`.stage` 与叠加层作为兄弟节点，叠加层 `absolute inset-0` 盖上去。`.stage` 自身带 `relative`，仍是盒子的 `offsetParent`，观测层的坐标语义不变。

**SVG 两个坑：** SVG 根元素默认 `overflow: hidden`，溢出标记画在容器外会被裁掉，必须显式 `overflow: visible`；叠加层必须 `pointer-events: none`，否则盒子点不中。

**Files:**
- Create: `src/components/playground/OverlayLayer.vue`
- Test: `src/components/playground/OverlayLayer.spec.ts`
- Modify: `src/components/playground/DemoStage.vue`

**Interfaces:**
- Consumes: `computeOverlay` / `OverlayGeometry`（Task 2）、`axisVectors`（Task 1）、`useOverlay`（Task 3）、`useMeasure().measured`、`useFlexState().state / derived`、`itemLabel`（`src/core/labels.ts`）
- Produces: 组件 `OverlayLayer`，无 props（全部走单例状态）。测试用 `data-testid`：`overlay`、`overlay-band`（带 `data-kind`）、`overlay-axis-main`、`overlay-axis-cross`、`overlay-hud`。

- [ ] **Step 1: 写失败的测试**

新建 `src/components/playground/OverlayLayer.spec.ts`：

```ts
import type { MeasuredStage } from '~/core/types'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import { useMeasure } from '~/composables/useMeasure'
import { useOverlay } from '~/composables/useOverlay'
import OverlayLayer from './OverlayLayer.vue'

/** happy-dom 不排版，实测值全是 0——这里伪造一份观测结果来驱动几何 */
function fakeMeasured(): MeasuredStage {
  return {
    width: 400,
    height: 200,
    items: [
      { id: 'item-1', left: 0, top: 0, width: 100, height: 200 },
      { id: 'item-2', left: 112, top: 0, width: 100, height: 200 },
      { id: 'item-3', left: 224, top: 0, width: 100, height: 200 },
    ],
  }
}

describe('overlayLayer', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useFlexState().state.container.width = 400
    useFlexState().state.container.height = 200
    const { visible, setHovered } = useOverlay()
    visible.value = true
    setHovered(null)
    useMeasure().measured.value = fakeMeasured()
  })

  it('把行尾空白画成剩余空间色块', () => {
    const wrapper = mount(OverlayLayer)
    const bands = wrapper.findAll('[data-testid="overlay-band"]')
    expect(bands).toHaveLength(1)
    expect(bands[0].attributes('data-kind')).toBe('free')
    expect(bands[0].attributes('width')).toBe('76')
  })

  it('关掉开关后整层不渲染', async () => {
    const wrapper = mount(OverlayLayer)
    useOverlay().visible.value = false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(false)
  })

  it('还没有观测结果时不渲染，不用 0 冒充', async () => {
    useMeasure().measured.value = null
    const wrapper = mount(OverlayLayer)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(false)
  })

  it('轴向箭头随 direction 翻转', async () => {
    const wrapper = mount(OverlayLayer)
    const horizontal = wrapper.get('[data-testid="overlay-axis-main"]')
    expect(Number(horizontal.attributes('x2'))).toBeGreaterThan(Number(horizontal.attributes('x1')))

    useFlexState().state.container.direction = 'row-reverse'
    await wrapper.vm.$nextTick()
    const reversed = wrapper.get('[data-testid="overlay-axis-main"]')
    expect(Number(reversed.attributes('x2'))).toBeLessThan(Number(reversed.attributes('x1')))
  })

  it('悬停盒子时冒出尺寸 HUD，移开就收起', async () => {
    const wrapper = mount(OverlayLayer)
    expect(wrapper.find('[data-testid="overlay-hud"]').exists()).toBe(false)

    useOverlay().setHovered('item-2')
    await wrapper.vm.$nextTick()
    const hud = wrapper.get('[data-testid="overlay-hud"]')
    expect(hud.text()).toContain('100')

    useOverlay().setHovered(null)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="overlay-hud"]').exists()).toBe(false)
  })

  it('没有悬停时 HUD 跟着选中的盒子', async () => {
    const wrapper = mount(OverlayLayer)
    useFlexState().selectItem('item-3')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="overlay-hud"]').text()).toContain('100')
  })

  it('溢出时画出越界标记', async () => {
    useMeasure().measured.value = {
      width: 400,
      height: 200,
      items: [{ id: 'item-1', left: 0, top: 0, width: 480, height: 200 }],
    }
    const { state } = useFlexState()
    state.items.splice(1)

    const wrapper = mount(OverlayLayer)
    await wrapper.vm.$nextTick()

    const bands = wrapper.findAll('[data-testid="overlay-band"]')
    expect(bands).toHaveLength(1)
    expect(bands[0].attributes('data-kind')).toBe('overflow')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/OverlayLayer.spec.ts`
Expected: FAIL，找不到 `./OverlayLayer.vue`。

- [ ] **Step 3: 写组件**

新建 `src/components/playground/OverlayLayer.vue`：

```vue
<script setup lang="ts">
import type { AxisVector } from '~/core/axis'
import { computed } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { useMeasure } from '~/composables/useMeasure'
import { useOverlay } from '~/composables/useOverlay'
import { axisVectors, isRowDirection } from '~/core/axis'
import { itemLabel } from '~/core/labels'
import { computeOverlay } from '~/core/overlay'

const { state, derived } = useFlexState()
const { measured } = useMeasure()
const { visible, hoveredId } = useOverlay()

/** 箭头画在容器左上角，长度固定，不随容器缩放 */
const ARROW_ORIGIN = 16
const ARROW_LENGTH = 32

const geometry = computed(() =>
  measured.value ? computeOverlay(state, derived.value, measured.value) : null,
)

const vectors = computed(() => axisVectors(state.container))

/** 反向的轴要把起点挪到另一头，箭头才不会画到容器外面去 */
function arrow(vector: AxisVector) {
  const x1 = ARROW_ORIGIN + (vector.dx < 0 ? ARROW_LENGTH : 0)
  const y1 = ARROW_ORIGIN + (vector.dy < 0 ? ARROW_LENGTH : 0)
  return { x1, y1, x2: x1 + vector.dx * ARROW_LENGTH, y2: y1 + vector.dy * ARROW_LENGTH }
}

const mainArrow = computed(() => arrow(vectors.value.main))
const crossArrow = computed(() => arrow(vectors.value.cross))

/** 悬停优先于选中：鼠标正指着谁，就先说谁 */
const hud = computed(() => {
  const id = hoveredId.value ?? state.selectedId
  const record = measured.value?.items.find(item => item.id === id)
  if (!id || !record)
    return null

  const index = state.items.findIndex(item => item.id === id)
  const theoretical = derived.value.items.find(item => item.id === id)?.finalMainSize ?? 0
  const actualMain = isRowDirection(state.container.direction) ? record.width : record.height

  return {
    label: itemLabel(index),
    text: `${round(record.width)} × ${round(record.height)}`,
    theoretical: round(theoretical),
    // 与明细表同一个判据：差得过半个像素才算有规则介入
    mismatch: Math.abs(theoretical - actualMain) > 0.5,
    x: record.left,
    // 盒子贴着容器顶时，HUD 翻到盒子内侧，免得被容器边裁掉
    y: record.top < 20 ? record.top + 16 : record.top - 6,
  }
})

function round(value: number): number {
  return Math.round(value * 10) / 10
}
</script>

<template>
  <svg
    v-if="visible && measured && geometry"
    data-testid="overlay"
    class="overlay"
    :width="measured.width"
    :height="measured.height"
    :viewBox="`0 0 ${measured.width} ${measured.height}`"
  >
    <defs>
      <!-- 剩余空间用斜纹填充：与实心色块拉开区别，一眼看出「这里没有盒子」 -->
      <pattern id="overlay-stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="var(--accent)" fill-opacity="0.08" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="var(--accent)" stroke-opacity="0.35" stroke-width="3" />
      </pattern>
      <marker id="overlay-arrow-main" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)" />
      </marker>
      <marker id="overlay-arrow-cross" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent-2)" />
      </marker>
    </defs>

    <!-- 剩余空间与溢出 -->
    <rect
      v-for="(band, index) in geometry.bands"
      :key="`${band.lineIndex}-${index}`"
      data-testid="overlay-band"
      :data-kind="band.kind"
      :x="band.x"
      :y="band.y"
      :width="band.width"
      :height="band.height"
      :class="band.kind === 'free' ? 'band-free' : 'band-overflow'"
    />

    <!-- 轴向箭头 -->
    <g class="axis">
      <line
        data-testid="overlay-axis-main"
        v-bind="mainArrow"
        stroke="var(--accent)"
        stroke-width="2"
        marker-end="url(#overlay-arrow-main)"
      />
      <line
        data-testid="overlay-axis-cross"
        v-bind="crossArrow"
        stroke="var(--accent-2)"
        stroke-width="2"
        stroke-dasharray="4 3"
        marker-end="url(#overlay-arrow-cross)"
      />
    </g>

    <!-- 尺寸 HUD -->
    <g v-if="hud" data-testid="overlay-hud" class="hud">
      <text :x="hud.x + 4" :y="hud.y" :class="{ mismatch: hud.mismatch }">
        {{ hud.label }} {{ hud.text }} · 理论 {{ hud.theoretical }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.overlay {
  position: absolute;
  top: 0;
  left: 0;

  /*
   * 两条都不能少：
   * pointer-events 不关掉，叠加层会把盒子的点击全吃掉；
   * SVG 根元素默认 overflow: hidden，溢出标记画在容器外会被裁掉。
   */
  overflow: visible;
  pointer-events: none;
}

.band-free {
  fill: url(#overlay-stripes);
}

.band-overflow {
  fill: color-mix(in srgb, var(--accent-2) 22%, transparent);
  stroke: var(--accent-2);
  stroke-dasharray: 4 3;
  stroke-width: 1;
}

.hud text {
  fill: var(--fg);
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  paint-order: stroke;
  stroke: var(--panel);
  stroke-width: 3px;
  stroke-linejoin: round;
}

.hud text.mismatch {
  fill: var(--accent-2);
}
</style>
```

- [ ] **Step 4: 跑组件测试确认通过**

Run: `pnpm vitest run src/components/playground/OverlayLayer.spec.ts`
Expected: PASS，7 个用例全绿。

- [ ] **Step 5: 把叠加层挂进演示区**

改 `src/components/playground/DemoStage.vue`：

script 里补两处 import 与 hover 上报：

```ts
import { useOverlay } from '~/composables/useOverlay'
import OverlayLayer from './OverlayLayer.vue'

const { setHovered } = useOverlay()
```

模板整体包一层 wrapper，`.stage` 与叠加层作兄弟：

```vue
<template>
  <!--
    wrapper 存在的唯一理由：.stage 是真实 flex 容器，
    任何塞进去的子元素都会变成第 N+1 个 flex item 污染演示，
    所以叠加层只能作为兄弟节点绝对定位盖上去。
  -->
  <div class="stage-wrapper relative w-fit">
    <div
      ref="stageEl"
      data-testid="stage"
      class="stage relative overflow-hidden rounded-2 bg-panel"
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
        @mouseenter="setHovered(item.id)"
        @mouseleave="setHovered(null)"
        @focus="setHovered(item.id)"
        @blur="setHovered(null)"
      >
        <div class="content" :style="contentStyle(item)">
          {{ itemLabel(index) }}
        </div>
      </div>
    </div>

    <OverlayLayer />
  </div>
</template>
```

- [ ] **Step 6: 跑演示区与叠加层的测试**

Run: `pnpm vitest run src/components/playground/DemoStage.spec.ts src/components/playground/OverlayLayer.spec.ts`
Expected: PASS。`DemoStage.spec.ts` 现有 8 个用例都靠 `data-testid` 定位，包 wrapper 不影响它们。

- [ ] **Step 7: 提交**

调用 `/commit` skill 提交，建议信息：`feat(playground): 画出剩余空间与轴向叠加层`。

---

### Task 5: 右下角 resize 手柄，替掉两个滑块

**为什么用 `<button>` 而不是 `role="slider"`：** slider 的 ARIA 契约是「一个值」，而这个手柄同时改宽和高，挂 `role="slider"` 就得编造一个 `aria-valuenow`，反而误导读屏。用普通按钮 + 说清楚的 `aria-label`，方向键行为在 label 里讲明白。

**为什么不用 CSS `resize: both`：** 那会让浏览器直接改 DOM 尺寸，再靠 ResizeObserver 反写状态，形成 `状态 → 样式 → 浏览器 → 状态` 的回环；而且原生手柄样式不可定制，暗色主题下很难看。自己写 pointer 事件，数据流保持 `拖拽 → 状态 → 样式` 单向。

**Files:**
- Create: `src/components/playground/StageResizer.vue`
- Test: `src/components/playground/StageResizer.spec.ts`
- Modify: `src/core/defaults.ts`（加 `STAGE_LIMITS`）
- Modify: `src/components/playground/DemoStage.vue`（挂手柄）
- Modify: `src/components/playground/ThePlayground.vue`（删滑块、加开关）
- Modify: `src/components/playground/ThePlayground.spec.ts`（改掉滑块用例）

**Interfaces:**
- Produces: `export const STAGE_LIMITS = { minWidth: 200, maxWidth: 1200, minHeight: 120, maxHeight: 600 }`（`src/core/defaults.ts`）；组件 `StageResizer`，无 props，`data-testid="stage-resizer"`。
- 数值范围沿用被替换掉的两个 range 滑块（宽 200–1200、高 120–600），不改变可达的尺寸区间。

- [ ] **Step 1: 写失败的测试**

新建 `src/components/playground/StageResizer.spec.ts`：

```ts
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlexState } from '~/composables/useFlexState'
import { STAGE_LIMITS } from '~/core/defaults'
import StageResizer from './StageResizer.vue'

/** happy-dom 未必有 PointerEvent 构造器，手工造事件保证测试环境无关 */
function firePointer(type: string, clientX: number, clientY: number): void {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { clientX, clientY, pointerId: 1 })
  window.dispatchEvent(event)
}

describe('stageResizer', () => {
  beforeEach(() => {
    useFlexState().resetState()
  })

  it('拖拽同时改变容器的宽和高', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer, { attachTo: document.body })

    await wrapper.get('[data-testid="stage-resizer"]').trigger('pointerdown', { clientX: 100, clientY: 100 })
    firePointer('pointermove', 160, 130)

    expect(state.container.width).toBe(780)
    expect(state.container.height).toBe(350)
  })

  it('松手之后再移动鼠标不再改尺寸', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer, { attachTo: document.body })

    await wrapper.get('[data-testid="stage-resizer"]').trigger('pointerdown', { clientX: 100, clientY: 100 })
    firePointer('pointerup', 100, 100)
    firePointer('pointermove', 500, 500)

    expect(state.container.width).toBe(720)
    expect(state.container.height).toBe(320)
  })

  it('尺寸被限制在上下限之内', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer, { attachTo: document.body })

    await wrapper.get('[data-testid="stage-resizer"]').trigger('pointerdown', { clientX: 0, clientY: 0 })
    firePointer('pointermove', -9999, -9999)
    expect(state.container.width).toBe(STAGE_LIMITS.minWidth)
    expect(state.container.height).toBe(STAGE_LIMITS.minHeight)

    firePointer('pointermove', 9999, 9999)
    expect(state.container.width).toBe(STAGE_LIMITS.maxWidth)
    expect(state.container.height).toBe(STAGE_LIMITS.maxHeight)

    // 用例之间不卸载组件，监听器留在 window 上——松手收尾，免得串到后面的用例
    firePointer('pointerup', 0, 0)
  })

  it('方向键微调 1px，保住键盘可达', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer)
    const handle = wrapper.get('[data-testid="stage-resizer"]')

    await handle.trigger('keydown', { key: 'ArrowRight' })
    await handle.trigger('keydown', { key: 'ArrowUp' })

    expect(state.container.width).toBe(721)
    expect(state.container.height).toBe(319)
  })

  it('按住 Shift 步长变 10px', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer)

    await wrapper.get('[data-testid="stage-resizer"]').trigger('keydown', { key: 'ArrowLeft', shiftKey: true })

    expect(state.container.width).toBe(710)
  })

  it('无关按键不改尺寸', async () => {
    const { state } = useFlexState()
    const wrapper = mount(StageResizer)

    await wrapper.get('[data-testid="stage-resizer"]').trigger('keydown', { key: 'Enter' })

    expect(state.container.width).toBe(720)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/StageResizer.spec.ts`
Expected: FAIL，找不到 `STAGE_LIMITS` 与 `./StageResizer.vue`。

- [ ] **Step 3: 加尺寸上下限常量**

在 `src/core/defaults.ts` 顶部（`createDefaultItem` 之前）插入：

```ts
/**
 * 演示区尺寸的可拖拽区间。
 * 下限保证盒子还看得见，上限避免演示区把明细表挤出视口。
 */
export const STAGE_LIMITS = {
  minWidth: 200,
  maxWidth: 1200,
  minHeight: 120,
  maxHeight: 600,
} as const
```

- [ ] **Step 4: 写手柄组件**

新建 `src/components/playground/StageResizer.vue`：

```vue
<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { STAGE_LIMITS } from '~/core/defaults'

const { state } = useFlexState()

/** 按下时记住起点与当时的尺寸，位移量直接加在起始尺寸上，避免累积误差 */
const origin = ref<{ x: number, y: number, width: number, height: number } | null>(null)

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max)
}

function onPointerdown(event: PointerEvent): void {
  origin.value = {
    x: event.clientX,
    y: event.clientY,
    width: state.container.width,
    height: state.container.height,
  }
  // 指针捕获让快速拖出手柄范围时事件不丢；happy-dom 里没有这个方法，可选链兜住
  ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
  event.preventDefault()
}

// 监听挂在 window 上而不是手柄上：鼠标甩出手柄之后拖拽仍要跟手
useEventListener(window, 'pointermove', (event: PointerEvent) => {
  const from = origin.value
  if (!from)
    return

  state.container.width = clamp(
    from.width + event.clientX - from.x,
    STAGE_LIMITS.minWidth,
    STAGE_LIMITS.maxWidth,
  )
  state.container.height = clamp(
    from.height + event.clientY - from.y,
    STAGE_LIMITS.minHeight,
    STAGE_LIMITS.maxHeight,
  )
})

useEventListener(window, 'pointerup', () => {
  origin.value = null
})

// 方向键微调是这个手柄的键盘等价物——它替掉了原来两个可聚焦的 range 滑块
function onKeydown(event: KeyboardEvent): void {
  const step = event.shiftKey ? 10 : 1
  const moves: Record<string, [number, number]> = {
    ArrowRight: [step, 0],
    ArrowLeft: [-step, 0],
    ArrowDown: [0, step],
    ArrowUp: [0, -step],
  }

  const move = moves[event.key]
  if (!move)
    return

  state.container.width = clamp(state.container.width + move[0], STAGE_LIMITS.minWidth, STAGE_LIMITS.maxWidth)
  state.container.height = clamp(state.container.height + move[1], STAGE_LIMITS.minHeight, STAGE_LIMITS.maxHeight)
  event.preventDefault()
}
</script>

<template>
  <button
    data-testid="stage-resizer"
    type="button"
    class="resizer"
    :aria-label="`调整演示区尺寸，当前 ${state.container.width} × ${state.container.height} 像素；方向键微调，按住 Shift 一次 10 像素`"
    @pointerdown="onPointerdown"
    @keydown="onKeydown"
  />
</template>

<style scoped>
/*
 * 手柄贴在演示区右下角外沿，落在 wrapper 上而不是 .stage 里——
 * .stage 是真实 flex 容器，塞进去会变成一个盒子。
 */
.resizer {
  position: absolute;
  right: -6px;
  bottom: -6px;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background:
    linear-gradient(
      135deg,
      transparent 0 45%,
      var(--accent) 45% 55%,
      transparent 55% 70%,
      var(--accent) 70% 80%,
      transparent 80%
    );
  cursor: nwse-resize;
  touch-action: none;
}

.resizer:hover,
.resizer:focus-visible {
  outline: 2px solid var(--accent-2);
  outline-offset: 2px;
}
</style>
```

- [ ] **Step 5: 跑手柄测试确认通过**

Run: `pnpm vitest run src/components/playground/StageResizer.spec.ts`
Expected: PASS，6 个用例全绿。

- [ ] **Step 6: 把手柄挂进演示区**

改 `src/components/playground/DemoStage.vue`：script 里加 `import StageResizer from './StageResizer.vue'`，模板里在 `<OverlayLayer />` 之后加一行 `<StageResizer />`（同为 wrapper 的直接子节点）。

- [ ] **Step 7: 删掉滑块，换成叠加层开关**

改 `src/components/playground/ThePlayground.vue`：

script 部分删掉 `setWidth` / `setHeight` 两个函数，改为：

```ts
import { useFlexState } from '~/composables/useFlexState'
import { useOverlay } from '~/composables/useOverlay'
import ContainerControls from './ContainerControls.vue'
import CssOutput from './CssOutput.vue'
import DemoStage from './DemoStage.vue'
import ItemControls from './ItemControls.vue'
import ItemList from './ItemList.vue'
import MetricsTable from './MetricsTable.vue'

const { state, resetState } = useFlexState()
const { visible: overlayVisible, toggleVisible } = useOverlay()
```

模板里演示区上方那一整块（两个 `<label>` 滑块）替换为：

```vue
        <div class="mb-3 flex flex-wrap items-center gap-4 text-xs">
          <label class="flex cursor-pointer items-center gap-2">
            <input
              data-testid="overlay-toggle"
              type="checkbox"
              :checked="overlayVisible"
              @change="toggleVisible()"
            >
            <span class="op-70">叠加层</span>
          </label>
          <span class="op-60">拖拽演示区右下角手柄调整容器尺寸</span>
          <span class="ml-auto font-mono op-70">
            {{ state.container.width }} × {{ state.container.height }}
          </span>
        </div>
```

演示区外层的 `<div class="overflow-auto">` 保持不变，但要给手柄留出伸出去的 6px，改成 `<div class="overflow-auto p-2">`——padding 加在**演示区外面的滚动容器**上，不是 `.stage` 上，不影响布局推导。

- [ ] **Step 8: 改掉引用滑块的测试**

`src/components/playground/ThePlayground.spec.ts` 里「容器宽度滑块改变演示区尺寸」这个用例整体替换为：

```ts
  it('拖拽手柄的键盘微调改变演示区尺寸', async () => {
    const wrapper = mount(ThePlayground)
    await wrapper.get('[data-testid="stage-resizer"]').trigger('keydown', { key: 'ArrowRight', shiftKey: true })

    expect(useFlexState().state.container.width).toBe(730)
    expect(wrapper.get('[data-testid="stage"]').attributes('style')).toContain('width: 730px')
  })

  it('叠加层开关能收起整层', async () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.find('[data-testid="overlay-toggle"]').exists()).toBe(true)

    await wrapper.get('[data-testid="overlay-toggle"]').trigger('change')
    expect(useOverlay().visible.value).toBe(false)

    // 单例状态跨用例共享，改回去免得影响后面的用例
    useOverlay().toggleVisible()
  })
```

文件顶部补一行 `import { useOverlay } from '~/composables/useOverlay'`。

- [ ] **Step 9: 跑全量测试**

Run: `pnpm test`
Expected: 全绿。若 `ThePlayground.spec.ts` 里叠加层开关用例受单例状态串扰，检查是否漏了收尾的 `toggleVisible()`。

- [ ] **Step 10: 提交**

调用 `/commit` skill 提交，建议信息：`feat(playground): 演示区改用右下角拖拽手柄调整尺寸`。

---

### Task 6: 完整验证与浏览器核对

单元测试证明不了叠加层贴不贴合真实排版——happy-dom 没有排版引擎，几何测试喂的全是伪造数据。M3 上半程已经栽过两次（装饰性 border 参与布局、`overflow: hidden` 让 `min-width: auto` 失效），这一步不能省。

**Files:** 无改动（除非核对发现问题）

- [ ] **Step 1: 跑测试**

Run: `pnpm test`
Expected: 全绿，把输出贴进回复。

- [ ] **Step 2: 跑 lint**

Run: `pnpm lint`
Expected: 无错误。有 antfu 风格问题先跑 `pnpm lint:fix` 再复跑。

- [ ] **Step 3: 跑构建（含类型检查）**

Run: `pnpm build`
Expected: `vue-tsc --noEmit` 无类型错误，vite 构建成功。

- [ ] **Step 4: 请示浏览器验证**

按项目约定，**先问用户是否需要浏览器验证**，不要自行调用 claude-in-chrome。得到确认后再执行下一步。

- [ ] **Step 5: 浏览器核对清单**

`pnpm dev` 起服务后逐条核对：

1. 默认状态（row / nowrap / gap 12 / 三个盒子）——行尾一块斜纹色块，盒子之间没有色块（12px 空隙恰好等于 gap，应被扣光）。
2. `justify-content: space-between`——色块散成两块，分别贴在第二、第三个盒子左侧。
3. 三个盒子都设 `flex-grow: 1`——色块完全消失（剩余空间被分光）。
4. 容器宽度拖到最小 + 盒子 `size` 调大——出现 `overflow` 越界标记，且它画在容器外、没被裁掉。
5. `direction: column` / `row-reverse` / `wrap-reverse`——主轴与交叉轴箭头方向正确。
6. 悬停与选中盒子——HUD 显示实际 W×H 与理论值，理论≠实际时变色，且与明细表同一行的判定一致。
7. 拖拽右下角手柄——尺寸跟手、明细表数字随之更新、松手后不再跟随；Tab 聚焦手柄后方向键可微调。
8. 叠加层开关关掉后，演示区回到纯净状态，盒子仍可点选（验证 `pointer-events: none` 没吃掉点击）。
9. 切换暗/亮主题——斜纹、箭头、HUD 在两个主题下都看得清。

- [ ] **Step 6: 更新 CLAUDE.md 的进度段落**

`CLAUDE.md` 的「当前进度」段落把 M3 标记为完成，删掉「M3 剩余部分」那两句，改为指向 M4（GSAP Flip 布局过渡）。若浏览器核对发现了新的布局陷阱，追加进「设计红线」。

- [ ] **Step 7: 提交**

调用 `/commit` skill 提交，建议信息：`docs: 记录 M3 完成与浏览器核对结论`。
