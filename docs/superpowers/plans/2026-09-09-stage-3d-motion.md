# 演示区 3D 化与运动编排 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **已作废（2026-09-09）**：3D 路线经浏览器验证后放弃，相关代码已删除。
> 本文保留作过程记录，不要照它实现。其中 Task 2（观测层挂起）与 Task 4（Flip 编排）
> 的成果仍在代码里。

**Goal:** 把演示区的盒子变成有体积、会呼吸、丝滑重排的 3D 方块，厚度编码 grow/shrink 的伸缩量，而位置与尺寸仍然完全由浏览器的 flex 排版决定。

**Architecture:** 厚度换算下沉到纯函数 `core/depth.ts`（只归一化，不产出像素）；视觉与动效常量集中在 `visual/motion.ts`；`useFlip` 负责 GSAP Flip 编排并在动画期间挂起观测层；`DemoStage` 里新插一层 `.scene` 同时包住 `.stage` 与叠加层，让两者共用同一个倾斜变换。盒子仍是真 flex item，立体面全部由伪元素构成，不占布局空间。

**Tech Stack:** Vue 3 script setup · TypeScript · GSAP 3.15（Flip 插件，已在依赖内且全免费）· UnoCSS · CSS 3D transforms · Vitest + @vue/test-utils

**Spec:** `docs/superpowers/specs/2026-09-09-stage-3d-motion-design.md`（配合总设计文档 `docs/superpowers/specs/2026-09-08-todo-flex-design.md` §7 一起读）

## Global Constraints

- 包管理器固定 **pnpm**；TypeScript 锁 6.x，不得升级；**本计划不新增任何依赖**（`gsap` 已在 dependencies）。
- `src/core/` 下零 DOM、零 vue 依赖。`core/depth.ts` 只接收纯数据，**只归一化不产出像素**——像素是视觉参数，属于 `visual/motion.ts`。
- 观测层禁止 `getBoundingClientRect()`（红线 5）。本计划给它加 `pause()` / `resume()`，不改它的取数方式。
- 演示区描边一律 `outline`，禁止 `border` 与 `padding`（红线 6）。立体面用**伪元素**，不占布局空间。
- `.stage-item` 禁止 `overflow: hidden`（红线 7）——它同时也是 `preserve-3d` 不被压平的保障。
- **grouping property 陷阱**：`overflow` 非 `visible`、`filter`、`opacity < 1` 都会把 `transform-style` 强制变成 `flat`。因此 `brightness()` 只能加在**面（伪元素）**上，绝不能加在 `.stage-item` 自己身上。
- 推导引擎不动。厚度从既有的 `deltaFromGrow` / `deltaFromShrink` 派生，不新增推导步骤。
- 动效参数一律取自 `visual/motion.ts`，组件里禁止硬编码 duration / ease / 角度 / 像素上限。
- 代码注释、提交信息、对话回复一律简体中文；代码标识符用英文。
- 组件与 composable 沿用现有**显式 import** 写法，不依赖自动导入；`auto-imports.d.ts` / `components.d.ts` 是生成物，不要手改。
- 格式问题交给 `pnpm lint:fix`。**提交走 `/commit` skill**。当前分支 `dev`。
- 单元测试跑在 happy-dom 下，**既没有排版引擎也没有合成器**——动画与 3D 效果单测覆盖不了，只验接线与参数，效果靠浏览器核对。

## 文件结构

| 文件 | 职责 | 状态 |
| --- | --- | --- |
| `src/core/depth.ts` | `computeDepths(derived, containerMainSize)`：把 `deltaFromGrow + deltaFromShrink` 按容器主轴尺寸归一化到 −1..1 | 新增 |
| `src/core/depth.spec.ts` | 上者的 TDD 测试 | 新增 |
| `src/composables/useMeasure.ts` | 增加 `pause()` / `resume()`，供 Flip 动画期间挂起采样 | 改 |
| `src/composables/useMeasure.spec.ts` | 补暂停/恢复的测试 | 改 |
| `src/visual/motion.ts` | 动效与视觉 token（duration / ease / stagger / 厚度上限 / 倾角 / 透视距离） | 新增 |
| `src/composables/useStageView.ts` | 3D / 平面视图开关（UI 偏好，不进 `FlexState`） | 新增 |
| `src/composables/useStageView.spec.ts` | 单例语义测试 | 新增 |
| `src/composables/useFlip.ts` | GSAP Flip 编排 + `scrubbing` 抑制 + 观测层挂起 | 新增 |
| `src/composables/useFlip.spec.ts` | 接线测试（不测动画本身） | 新增 |
| `src/components/playground/DemoStage.vue` | 插 `.scene` 倾斜层、写厚度 CSS 变量、伪元素立体面、移除 `.stage` 的 `overflow: hidden` | 改 |
| `src/components/playground/StageResizer.vue` | 拖拽期间置 `scrubbing` | 改 |
| `src/components/playground/PropertyField.vue` | range 控件拖动期间置 `scrubbing` | 改 |
| `src/components/playground/ThePlayground.vue` | 叠加层开关旁增加 3D 视图开关 | 改 |

---

### Task 1: 厚度归一化（`core/depth.ts`）

**Files:**
- Create: `src/core/depth.ts`
- Test: `src/core/depth.spec.ts`

**Interfaces:**
- Consumes: `DerivedLayout`（`src/core/types.ts`，其 `items` 每项含 `id` / `deltaFromGrow` / `deltaFromShrink`）
- Produces: `export function computeDepths(derived: DerivedLayout, containerMainSize: number): Map<string, number>`。值域 −1..1，正数表示 grow 分得空间（凸起），负数表示 shrink 让出空间（凹陷）。

- [ ] **Step 1: 写失败的测试**

新建 `src/core/depth.spec.ts`：

```ts
import type { DerivedItem, DerivedLayout } from './types'
import { describe, expect, it } from 'vitest'
import { createDefaultState } from './defaults'
import { computeDepths } from './depth'
import { deriveLayout } from './deriveLayout'

/** 只有 computeDepths 用得到的字段是真的，其余补零 */
function makeDerived(items: Pick<DerivedItem, 'id' | 'deltaFromGrow' | 'deltaFromShrink'>[]): DerivedLayout {
  return {
    lines: [],
    items: items.map(item => ({
      ...item,
      basisResolved: 0,
      hypotheticalMainSize: 0,
      finalMainSize: 0,
      lineIndex: 0,
    })),
    steps: [],
  }
}

describe('computeDepths', () => {
  it('平衡态的盒子厚度为 0，是一块平板', () => {
    const derived = makeDerived([{ id: 'a', deltaFromGrow: 0, deltaFromShrink: 0 }])
    expect(computeDepths(derived, 720).get('a')).toBe(0)
  })

  it('grow 分得的空间按容器主轴尺寸归一化成正厚度', () => {
    const derived = makeDerived([{ id: 'a', deltaFromGrow: 360, deltaFromShrink: 0 }])
    expect(computeDepths(derived, 720).get('a')).toBe(0.5)
  })

  it('shrink 让出的空间归一化成负厚度', () => {
    const derived = makeDerived([{ id: 'a', deltaFromGrow: 0, deltaFromShrink: -180 }])
    expect(computeDepths(derived, 720).get('a')).toBe(-0.25)
  })

  it('归一化基准是容器尺寸而不是组内最大值，两个盒子各按自己的比例算', () => {
    const derived = makeDerived([
      { id: 'a', deltaFromGrow: 400, deltaFromShrink: 0 },
      { id: 'b', deltaFromGrow: 100, deltaFromShrink: 0 },
    ])
    const depths = computeDepths(derived, 800)
    // 按组内最大值归一化的话 a 会是 1、b 会是 0.25；按容器归一化则是各自的绝对占比
    expect(depths.get('a')).toBe(0.5)
    expect(depths.get('b')).toBe(0.125)
  })

  it('超出容器尺寸的极端值截到 ±1，不产出超厚方块', () => {
    const derived = makeDerived([
      { id: 'a', deltaFromGrow: 5000, deltaFromShrink: 0 },
      { id: 'b', deltaFromGrow: 0, deltaFromShrink: -5000 },
    ])
    const depths = computeDepths(derived, 400)
    expect(depths.get('a')).toBe(1)
    expect(depths.get('b')).toBe(-1)
  })

  it('容器尺寸为 0 时全部归零，不产出 Infinity 或 NaN', () => {
    const derived = makeDerived([{ id: 'a', deltaFromGrow: 100, deltaFromShrink: 0 }])
    const depths = computeDepths(derived, 0)
    expect(depths.get('a')).toBe(0)
    expect(Number.isFinite(depths.get('a'))).toBe(true)
  })

  it('接得住推导引擎的真实输出：默认状态三个盒子都不伸缩，全是平板', () => {
    const state = createDefaultState()
    const depths = computeDepths(deriveLayout(state), state.container.width)
    expect([...depths.values()]).toEqual([0, 0, 0])
  })

  it('接得住推导引擎的真实输出：单个盒子 grow 独吞剩余空间时明显凸起', () => {
    const state = createDefaultState()
    state.items[0].grow = 1
    const depths = computeDepths(deriveLayout(state), state.container.width)
    // 720 - 240 - 24 = 456 全给了第一个盒子
    expect(depths.get('item-1')).toBeCloseTo(456 / 720, 5)
    expect(depths.get('item-2')).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/core/depth.spec.ts`
Expected: FAIL，找不到模块 `./depth`。

- [ ] **Step 3: 写最小实现**

新建 `src/core/depth.ts`：

```ts
import type { DerivedLayout } from './types'

/**
 * 把每个盒子的伸缩量归一化成方块厚度，值域 −1..1。
 *
 * 正数 = grow 分得空间（凸起），负数 = shrink 让出空间（凹陷），0 = 平衡态的平板。
 *
 * 归一化基准是**容器主轴尺寸**，不是组内最大 delta。按组内最大值归一化的话，
 * 任何状态下总有一个方块顶到满厚度，厚度就只剩「组内排名」的意思——
 * 改一下 gap 让最大值变了，全体厚度会跟着整体跳动，同一个盒子在不同状态下也不再可比。
 * 按容器归一化则是绝对量：分到容器的三分之一就是三分之一的厚度，跨状态可对照。
 *
 * 这里只归一化、不产出像素——像素上限是视觉参数，属于 visual/motion.ts。
 */
export function computeDepths(
  derived: DerivedLayout,
  containerMainSize: number,
): Map<string, number> {
  const depths = new Map<string, number>()

  for (const item of derived.items) {
    // 容器还没有尺寸时（首帧、被折叠）不猜，一律按平板处理，免得除出 Infinity
    if (containerMainSize <= 0) {
      depths.set(item.id, 0)
      continue
    }

    // grow 与 shrink 不会同时非零，直接相加即可得到带符号的伸缩量
    const delta = item.deltaFromGrow + item.deltaFromShrink
    depths.set(item.id, clamp(delta / containerMainSize, -1, 1))
  }

  return depths
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/core/depth.spec.ts`
Expected: PASS，8 个用例全绿。

- [ ] **Step 5: 提交**

调用 `/commit` skill，建议信息：`feat(core): 把伸缩量归一化成方块厚度`。

---

### Task 2: 观测层的暂停与恢复（`useMeasure`）

`Flip.from(absolute: true)` 会把元素临时设成 `position: absolute`——**那是真的改布局**，而观测层正盯着布局。不挂起的话，明细表的数字会在动画过程中乱跳。红线 5 挡住的是 `getBoundingClientRect` 那一半风险，没挡住这一半。

**Files:**
- Modify: `src/composables/useMeasure.ts`
- Test: `src/composables/useMeasure.spec.ts`

**Interfaces:**
- Produces: `useMeasure()` 的返回值新增 `pause: () => void` 与 `resume: () => void`。`resume()` 会立即强制重采一次；在没有挂载演示区时调用是安全的空操作。

- [ ] **Step 1: 写失败的测试**

在 `src/composables/useMeasure.spec.ts` 末尾的 `describe` 内追加：

```ts
  it('挂起期间状态变化不再更新观测结果', async () => {
    const { measured, pause, resume } = useMeasure()
    const wrapper = mount(DemoStage, { attachTo: document.body })
    await nextTick()

    const before = measured.value
    pause()
    useFlexState().state.container.width = 999
    await nextTick()

    expect(measured.value).toBe(before)

    resume()
    wrapper.unmount()
  })

  it('恢复时立即重采一次，不用等下一次状态变化', async () => {
    const { measured, pause, resume } = useMeasure()
    const wrapper = mount(DemoStage, { attachTo: document.body })
    await nextTick()

    pause()
    measured.value = null
    resume()

    // happy-dom 不排版，数字全是 0；这里验证的是「重采发生了」
    expect(measured.value).not.toBeNull()
    expect(measured.value?.items.map(item => item.id)).toEqual(['item-1', 'item-2', 'item-3'])

    wrapper.unmount()
  })

  it('没有挂载演示区时恢复是安全的空操作', () => {
    const { pause, resume } = useMeasure()
    pause()
    expect(() => resume()).not.toThrow()
  })
```

若该文件还没有引入 `DemoStage` / `mount` / `nextTick` / `useFlexState`，在顶部补齐对应 import。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/composables/useMeasure.spec.ts`
Expected: FAIL，`pause is not a function`。

- [ ] **Step 3: 写实现**

改 `src/composables/useMeasure.ts`。在模块级 `measured` 声明之后补两个模块级变量：

```ts
/** 当前接入观测的演示区，resume() 要靠它立即重采 */
let activeStage: HTMLElement | null = null

/**
 * 挂起标志。Flip 的 absolute 模式会把元素临时设成绝对定位——那是真的改布局，
 * 动画期间采到的尺寸是错的，明细表的数字会乱跳。所以动画期间挂起，结束后重采。
 */
let paused = false
```

在 `observeStage` 内部，把 `sample` 与 ResizeObserver 回调改成挂起时直接返回，并登记 `activeStage`：

```ts
  function sample(stage: HTMLElement): void {
    attach(stage)
    if (paused)
      return
    measured.value = readStage(stage)
  }
```

```ts
    observer = new ResizeObserver(() => {
      if (paused)
        return
      measured.value = readStage(stage)
    })
    activeStage = stage
    sample(stage)
```

`detach()` 里一并清掉登记：

```ts
  function detach(): void {
    observer?.disconnect()
    observer = null
    activeStage = null
  }
```

在文件末尾、`useMeasure` 之前补上两个函数：

```ts
function pause(): void {
  paused = true
}

function resume(): void {
  paused = false
  // 挂起期间漏掉的变化要补采一次，不能等下一次状态变化
  if (activeStage)
    measured.value = readStage(activeStage)
}
```

并把它们加进导出：

```ts
export function useMeasure() {
  return { measured, observeStage, pause, resume }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/composables/useMeasure.spec.ts`
Expected: PASS，含原有的「禁止调用 getBoundingClientRect」那条。

- [ ] **Step 5: 提交**

调用 `/commit` skill，建议信息：`feat(playground): 观测层支持挂起与恢复`。

---

### Task 3: 视觉 token 与视图开关

**Files:**
- Create: `src/visual/motion.ts`
- Create: `src/composables/useStageView.ts`
- Test: `src/composables/useStageView.spec.ts`

**Interfaces:**
- Produces: `export const motion` —— 只读常量对象，字段见下方实现。
- Produces: `useStageView(): { is3D: Ref<boolean>, toggle3D: () => void }`，模块级单例，默认开启 3D。

- [ ] **Step 1: 建 token 文件**

新建 `src/visual/motion.ts`：

```ts
/**
 * 动效与视觉 token。
 *
 * 组件里禁止硬编码 duration / ease / 角度 / 像素上限——调参要能一处改完，
 * 也免得同一套节奏在各处漂移。
 */
export const motion = {
  /** 布局重排的时长（秒） */
  layoutDuration: 0.45,
  /** 布局重排的缓动：末端减速，收得干净 */
  layoutEase: 'power3.out',
  /** 按索引交错，让重排有节奏而不是齐步走（秒） */
  layoutStagger: 0.025,
  /** 悬停抬起的时长（秒） */
  liftDuration: 0.2,
  /** --depth 为 ±1 时的方块厚度（px） */
  maxDepth: 26,
  /** 悬停或选中时额外抬起的高度（px） */
  liftHeight: 18,
  /** 演示区俯视角度（deg）。10 度以内横向投影误差可忽略，读数不受损 */
  tiltDeg: 10,
  /** 透视距离（px），越大越接近正交投影 */
  perspective: 1400,
} as const
```

- [ ] **Step 2: 写视图开关的失败测试**

新建 `src/composables/useStageView.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { useStageView } from './useStageView'

describe('useStageView', () => {
  it('默认开启 3D 视图', () => {
    expect(useStageView().is3D.value).toBe(true)
  })

  it('是模块级单例，两次调用拿到同一份状态', () => {
    const first = useStageView()
    const second = useStageView()

    first.toggle3D()
    expect(second.is3D.value).toBe(false)

    second.toggle3D()
    expect(first.is3D.value).toBe(true)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm vitest run src/composables/useStageView.spec.ts`
Expected: FAIL，找不到模块 `./useStageView`。

- [ ] **Step 4: 写实现**

新建 `src/composables/useStageView.ts`：

```ts
import { ref } from 'vue'

/**
 * 3D 视图开关。与 useOverlay 同定位：属于 UI 偏好，刻意不进 FlexState——
 * M6 的 URL 短码只该携带布局状态。
 *
 * 关掉它是给截图与教学场景兜底：倾角与厚度归零，回到纯平面。
 */
const is3D = ref(true)

function toggle3D(): void {
  is3D.value = !is3D.value
}

export function useStageView() {
  return { is3D, toggle3D }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run src/composables/useStageView.spec.ts`
Expected: PASS，2 个用例全绿。

- [ ] **Step 6: 提交**

调用 `/commit` skill，建议信息：`feat(playground): 添加动效 token 与 3D 视图开关`。

---

### Task 4: Flip 编排（`useFlip`）

**离散播动画，连续不播。** 点 `justify-content`、切 `direction`、增删盒子走 Flip；拖 gap 滑块、拖 grow 滑块、拖 resize 手柄时手已经到了、方块还在追，反而拖泥带水，所以直接跟手。

**关于 `absolute: true`：** 设计文档 §6.2 只在换行场景要求它。本实现**一律启用**——Task 2 的挂起机制正是为它建的，而 order 变化、增删盒子同样会引发整行重排，统一处理比按场景分叉更不容易出错。代价是每次重排都要挂起观测一小会儿，动画结束立即重采。

**Files:**
- Create: `src/composables/useFlip.ts`
- Test: `src/composables/useFlip.spec.ts`

**Interfaces:**
- Consumes: `motion`（Task 3）、`useMeasure().pause / resume`（Task 2）、`useFlexState().state`
- Produces: `useFlip(): { scrubbing: Ref<boolean>, setScrubbing: (value: boolean) => void, observeFlip: (target: MaybeRefOrGetter<HTMLElement | undefined | null>) => void }`

- [ ] **Step 1: 写失败的测试**

新建 `src/composables/useFlip.spec.ts`：

```ts
import { Flip } from 'gsap/Flip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import DemoStage from '~/components/playground/DemoStage.vue'
import { useFlexState } from './useFlexState'
import { useFlip } from './useFlip'

describe('useFlip', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useFlip().setScrubbing(false)
    vi.restoreAllMocks()
  })

  it('离散的状态变化会拍下 Flip 快照', async () => {
    const spy = vi.spyOn(Flip, 'getState')
    const wrapper = mount(DemoStage, { attachTo: document.body })
    await nextTick()

    useFlexState().state.container.justifyContent = 'center'
    await nextTick()

    expect(spy).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('连续拖拽期间不拍快照，让方块直接跟手', async () => {
    const wrapper = mount(DemoStage, { attachTo: document.body })
    await nextTick()

    const spy = vi.spyOn(Flip, 'getState')
    useFlip().setScrubbing(true)
    useFlexState().state.container.width = 500
    await nextTick()

    expect(spy).not.toHaveBeenCalled()

    useFlip().setScrubbing(false)
    wrapper.unmount()
  })

  it('scrubbing 标志是模块级单例，滑块与手柄改的是同一份', () => {
    const first = useFlip()
    const second = useFlip()

    first.setScrubbing(true)
    expect(second.scrubbing.value).toBe(true)

    second.setScrubbing(false)
    expect(first.scrubbing.value).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/composables/useFlip.spec.ts`
Expected: FAIL，找不到模块 `./useFlip`。

- [ ] **Step 3: 写实现**

新建 `src/composables/useFlip.ts`：

```ts
import type { MaybeRefOrGetter } from 'vue'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { nextTick, ref, toValue, watch } from 'vue'
import { motion } from '~/visual/motion'
import { useFlexState } from './useFlexState'
import { useMeasure } from './useMeasure'

gsap.registerPlugin(Flip)

/**
 * 连续拖拽标志。拖 gap 滑块、拖 resize 手柄时手已经到了、方块还在追，
 * 播动画反而拖泥带水，所以拖拽期间一律跳过 Flip、直接跟手。
 */
const scrubbing = ref(false)

function setScrubbing(value: boolean): void {
  scrubbing.value = value
}

/** 尊重系统的减弱动效偏好：时长归零，布局照变，只是不再有过渡 */
function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * 把演示区接入 Flip 编排。由 DemoStage 在 setup 里调用一次。
 *
 * 时序按设计文档 §7 定死的写法：flush 'pre' 保证 watch 回调跑在 DOM 更新之前，
 * 此时 Flip.getState() 拍到的是旧位置；nextTick 之后 DOM 已是新布局，Flip.from() 补上过渡。
 */
function observeFlip(target: MaybeRefOrGetter<HTMLElement | undefined | null>): void {
  const { state } = useFlexState()
  const { pause, resume } = useMeasure()

  watch(state, () => {
    const stage = toValue(target)
    if (!stage || scrubbing.value)
      return

    const items = stage.querySelectorAll<HTMLElement>('[data-item-id]')
    if (items.length === 0)
      return

    const snapshot = Flip.getState(items)

    nextTick(() => {
      // absolute 模式会把元素临时设成绝对定位，那是真的改布局——
      // 观测层必须先挂起，否则明细表的数字会在动画过程中乱跳
      pause()

      Flip.from(snapshot, {
        duration: reducedMotion() ? 0 : motion.layoutDuration,
        ease: motion.layoutEase,
        stagger: reducedMotion() ? 0 : motion.layoutStagger,
        absolute: true,
        // 中断也要恢复，否则观测层会永久卡在挂起状态
        onComplete: resume,
        onInterrupt: resume,
      })
    })
  }, { deep: true, flush: 'pre' })
}

export function useFlip() {
  return { scrubbing, setScrubbing, observeFlip }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/composables/useFlip.spec.ts`
Expected: PASS，3 个用例全绿。

> 若 `DemoStage` 尚未调用 `observeFlip`（Task 5 才接线），前两个用例会失败。
> 此时先在 `DemoStage.vue` 的 setup 里加上 `useFlip().observeFlip(stageEl)` 一行，
> 其余 3D 样式留到 Task 5 再做。

- [ ] **Step 5: 提交**

调用 `/commit` skill，建议信息：`feat(playground): 用 GSAP Flip 编排布局重排`。

---

### Task 5: 演示区 3D 化（`DemoStage`）

**Files:**
- Modify: `src/components/playground/DemoStage.vue`
- Test: `src/components/playground/DemoStage.spec.ts`

**Interfaces:**
- Consumes: `computeDepths`（Task 1）、`motion`（Task 3）、`useStageView`（Task 3）、`useFlip().observeFlip`（Task 4）
- Produces: 每个 `.stage-item` 上的两个内联 CSS 变量 —— `--elev`（带符号的抬升，px）与 `--thickness`（非负的厚度，px）。测试用 `data-testid="scene"` 定位倾斜层。

**为什么写两个变量而不是一个：** 凹陷时 `--elev` 为负，但面的高度不能为负。CSS 的 `abs()` 支持度还不稳，与其赌它，不如在组件里算好正负两份。

- [ ] **Step 1: 写失败的测试**

在 `src/components/playground/DemoStage.spec.ts` 的 `describe` 内追加：

```ts
  it('把归一化厚度换算成 CSS 变量写到盒子上', async () => {
    const { state } = useFlexState()
    state.items[0].grow = 1
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const style = wrapper.findAll('[data-testid="stage-item"]')[0].attributes('style')!
    // 720 - 240 - 24 = 456 全给第一个盒子，456/720 × 26px ≈ 16.5px
    expect(style).toContain('--elev: 16.5px')
    expect(style).toContain('--thickness: 16.5px')
  })

  it('shrink 让出空间时抬升为负、厚度仍为正', async () => {
    const { state } = useFlexState()
    state.container.width = 200
    state.items.forEach((item) => { item.minWidthAuto = false })
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const style = wrapper.findAll('[data-testid="stage-item"]')[0].attributes('style')!
    expect(style).toContain('--elev: -')
    expect(style).not.toContain('--thickness: -')
  })

  it('平面视图下倾角归零', async () => {
    const wrapper = mount(DemoStage)
    useStageView().toggle3D()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="scene"]').attributes('style')).toContain('rotateX(0deg)')

    useStageView().toggle3D()
  })

  it('3D 视图下场景带俯视倾角', () => {
    const wrapper = mount(DemoStage)
    expect(wrapper.get('[data-testid="scene"]').attributes('style')).toContain('rotateX(10deg)')
  })
```

文件顶部补 `import { useStageView } from '~/composables/useStageView'`。

> 若 happy-dom 没有把自定义属性反映到 `style` 属性字符串里，改用元素上的
> `wrapper.findAll('[data-testid="stage-item"]')[0].element.style.getPropertyValue('--elev')`
> 断言，语义等价。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/DemoStage.spec.ts`
Expected: FAIL，找不到 `[data-testid="scene"]`，且 style 里没有 `--elev`。

- [ ] **Step 3: script 部分接上厚度与视角**

在 `DemoStage.vue` 的 `<script setup>` 里补 import 与计算：

```ts
import { useFlip } from '~/composables/useFlip'
import { useStageView } from '~/composables/useStageView'
import { computeDepths } from '~/core/depth'
import { mainAxisSize } from '~/core/axis'
import { motion } from '~/visual/motion'

const { is3D } = useStageView()
useFlip().observeFlip(stageEl)

// 厚度按容器主轴尺寸归一化，再乘以视觉上限换算成像素
const depths = computed(() =>
  computeDepths(derived.value, mainAxisSize(state.container)),
)

const sceneStyle = computed<CSSProperties>(() => ({
  perspective: `${motion.perspective}px`,
  transform: `rotateX(${is3D.value ? motion.tiltDeg : 0}deg)`,
  // 抬起的高度与时长下发给 CSS——CSS 读不到 TS 常量，只能这样保住 motion.ts 的唯一权威
  '--lift': `${motion.liftHeight}px`,
  '--lift-duration': `${motion.liftDuration}s`,
} as CSSProperties))

function depthStyle(item: FlexItemState): CSSProperties {
  const depth = is3D.value ? (depths.value.get(item.id) ?? 0) : 0
  const elevation = round(depth * motion.maxDepth)

  return {
    // 带符号：凸起为正、凹陷为负
    '--elev': `${elevation}px`,
    // 面的高度不能为负，单独给一份绝对值
    '--thickness': `${Math.abs(elevation)}px`,
  } as CSSProperties
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
```

`derived` 从 `useFlexState()` 一并解构出来（原来只取了 `state` 与 `selectItem`）。

把 `depthStyle(item)` 合并进已有的 `itemStyle(item)` 返回值：在 `itemStyle` 的返回对象末尾展开 `...depthStyle(item)`。

- [ ] **Step 4: 模板插入 `.scene` 层**

`.scene` 必须**同时包住 `.stage` 与 `OverlayLayer`**，否则叠加层不跟着倾斜、剩余空间色块会与方块错位。`StageResizer` 也放进去，让手柄跟着容器的视觉角落走。

```vue
  <div class="stage-wrapper relative w-fit">
    <div data-testid="scene" class="scene" :style="sceneStyle">
      <div
        ref="stageEl"
        data-testid="stage"
        class="stage relative rounded-2 bg-panel"
        :style="containerStyle"
      >
        <!-- 盒子的 v-for 原样保留，只是缩进多一层 -->
      </div>

      <OverlayLayer />
      <StageResizer />
    </div>
  </div>
```

注意 `.stage` 的 class 里**去掉了 `overflow-hidden`**——见下一步。

- [ ] **Step 5: 样式：移除 overflow、加立体面**

在 `<style scoped>` 里，先给 `.scene` 建 3D 上下文：

```css
.scene {
  transform-style: preserve-3d;
  transition: transform 0.4s ease;
}
```

`.stage` 原有的 `overflow: hidden` 来自模板 class（上一步已删）。在 `.stage` 规则里补一条注释说明为什么不能加回来：

```css
.stage {
  outline: 1px solid var(--border);
  outline-offset: -1px;

  /*
   * 绝不能加 overflow: hidden。
   * CSS Transforms 规范里 overflow 非 visible 是 grouping property，
   * 会把本元素的 transform-style 强制变成 flat——.scene 的 perspective 就传不到
   * 方块上，方块会各自为政、没有共同灭点，3D 直接塌掉。
   * 顺带一提，裁掉溢出本来也与红线 7 的意图相悖：盒子被压得比内容还窄时，
   * 内容溢出正是要给用户看的现象。
   */
}
```

`.stage-item` 补 3D 上下文与抬升：

```css
.stage-item {
  /* 原有的 display/align/justify/cursor/border-radius/outline/background 保持不变 */
  transform-style: preserve-3d;
  transform: translateZ(var(--elev, 0px));
  transition:
    outline-color 0.2s ease,
    box-shadow 0.2s ease,
    transform var(--lift-duration, 0.2s) ease;
}

/*
 * 明暗一律加在面（伪元素）上，绝不能加在 .stage-item 自己身上——
 * filter 与 opacity < 1 同样是 grouping property，会把它的立体面压平。
 */

/* 顶面：从盒子上沿向后翻起，进深等于厚度 */
.stage-item::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: var(--thickness, 0px);
  transform-origin: top;
  transform: rotateX(90deg);
  border-radius: 6px 6px 0 0;
  background-color: color-mix(in srgb, var(--accent) 26%, var(--panel));
  filter: brightness(1.18);
}

/* 侧面：从盒子右沿向后翻起 */
.stage-item::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--thickness, 0px);
  transform-origin: right;
  transform: rotateY(90deg);
  border-radius: 0 6px 6px 0;
  background-color: color-mix(in srgb, var(--accent) 26%, var(--panel));
  filter: brightness(0.7);
}

/* 悬停与选中时整块抬起并投下阴影 */
.stage-item:hover,
.stage-item:focus-visible,
.stage-item.is-selected {
  transform: translateZ(calc(var(--elev, 0px) + var(--lift, 18px)));
  box-shadow: 0 18px 28px -12px color-mix(in srgb, var(--accent) 55%, transparent);
}
```

> `--lift` / `--lift-duration` 由 `sceneStyle` 从 `motion.ts` 下发，沿 `.scene` 继承到每个方块，
> 因此调参只需要动 `motion.ts` 一处。规则里的 `18px` / `0.2s` 只是变量缺失时的兜底值。
>
> 悬停过渡在减弱动效偏好下会被 `src/styles/main.css` 里既有的全局规则压成 0.01ms，
> 不需要在这里额外处理——那条规则本来就是为这种场景写的。

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm vitest run src/components/playground/DemoStage.spec.ts src/components/playground/OverlayLayer.spec.ts`
Expected: PASS。叠加层的用例不受影响——它读的是观测值，与倾斜无关。

- [ ] **Step 7: 提交**

调用 `/commit` skill，建议信息：`feat(playground): 演示区盒子改用 3D 方块呈现`。

---

### Task 6: 连续拖拽抑制与 3D 开关接线

**Files:**
- Modify: `src/components/playground/StageResizer.vue`
- Modify: `src/components/playground/PropertyField.vue`
- Modify: `src/components/playground/ThePlayground.vue`
- Test: `src/components/playground/ThePlayground.spec.ts`

**Interfaces:**
- Consumes: `useFlip().setScrubbing`（Task 4）、`useStageView()`（Task 3）

- [ ] **Step 1: 写失败的测试**

在 `src/components/playground/ThePlayground.spec.ts` 的 `describe` 内追加：

```ts
  it('3D 开关能压平演示区', async () => {
    const wrapper = mount(ThePlayground)
    expect(wrapper.get('[data-testid="scene"]').attributes('style')).toContain('rotateX(10deg)')

    await wrapper.get('[data-testid="view-toggle"]').trigger('change')
    expect(wrapper.get('[data-testid="scene"]').attributes('style')).toContain('rotateX(0deg)')

    // 单例状态跨用例共享，改回去免得影响后面的用例
    useStageView().toggle3D()
  })

  it('拖动手柄期间抑制 Flip，松手后恢复', async () => {
    const wrapper = mount(ThePlayground)
    const handle = wrapper.get('[data-testid="stage-resizer"]')

    await handle.trigger('pointerdown', { clientX: 0, clientY: 0 })
    expect(useFlip().scrubbing.value).toBe(true)

    window.dispatchEvent(new Event('pointerup'))
    await wrapper.vm.$nextTick()
    expect(useFlip().scrubbing.value).toBe(false)
  })
```

文件顶部补 `import { useFlip } from '~/composables/useFlip'` 与 `import { useStageView } from '~/composables/useStageView'`。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/ThePlayground.spec.ts`
Expected: FAIL，找不到 `[data-testid="view-toggle"]`。

- [ ] **Step 3: 手柄接上 scrubbing**

在 `StageResizer.vue` 的 script 里补 `import { useFlip } from '~/composables/useFlip'` 与 `const { setScrubbing } = useFlip()`，然后：

`onPointerdown` 内、记录 origin 之后加一行 `setScrubbing(true)`；`pointerup` 的监听回调改成：

```ts
useEventListener(window, 'pointerup', () => {
  origin.value = null
  setScrubbing(false)
})
```

方向键微调是离散动作，**不要**置 scrubbing——按一下动一步，正该有过渡。

- [ ] **Step 4: range 控件接上 scrubbing**

在 `PropertyField.vue` 的 script 里补：

```ts
import { useFlip } from '~/composables/useFlip'

const { setScrubbing } = useFlip()
```

给 `kind === 'number'` 那个 `<input type="range">` 加两个事件：

```vue
      @pointerdown="setScrubbing(true)"
      @pointerup="setScrubbing(false)"
```

- [ ] **Step 5: 面板加 3D 开关**

`ThePlayground.vue` script 补 `import { useStageView } from '~/composables/useStageView'` 与 `const { is3D, toggle3D } = useStageView()`；在叠加层开关那个 `<label>` 之后插入：

```vue
          <label class="flex cursor-pointer items-center gap-2">
            <input
              data-testid="view-toggle"
              type="checkbox"
              :checked="is3D"
              @change="toggle3D()"
            >
            <span class="op-70">3D</span>
          </label>
```

- [ ] **Step 6: 跑全量测试**

Run: `pnpm test`
Expected: 全绿。

- [ ] **Step 7: 提交**

调用 `/commit` skill，建议信息：`feat(playground): 拖拽期间抑制动画并接入 3D 开关`。

---

### Task 7: 完整验证与浏览器核对

3D 与动画在 happy-dom 下**原理上验不了**——它既没有排版引擎也没有合成器。这一步不能省。

**Files:** 无改动（除非核对发现问题）

- [ ] **Step 1: 跑测试**

Run: `pnpm test`
Expected: 全绿，把输出贴进回复。

- [ ] **Step 2: 跑 lint**

Run: `pnpm lint`
Expected: 无错误。有风格问题先 `pnpm lint:fix` 再复跑。

- [ ] **Step 3: 跑构建**

Run: `pnpm build`
Expected: `vue-tsc --noEmit` 无类型错误，vite 构建成功。**同时记录 JS 体积**——引入 Flip 后与上一版（115.86 kB / gzip 43.58 kB）对比，涨幅要能说得出来。

- [ ] **Step 4: 请示浏览器验证**

按项目约定**先问用户是否需要浏览器验证**，不要自行调用 claude-in-chrome。得到确认后再执行下一步。

- [ ] **Step 5: 浏览器核对清单**

`pnpm dev` 起服务后逐条核对：

1. **默认态**：三个盒子是平板（delta 全 0），场景带轻微俯视，能看到顶面与右侧面。
2. **A 设 flex: 1**：A 明显凸起、B/C 保持平板；厚度与 `456/720 × 26px ≈ 16.5px` 目视相符。
3. **容器压到 200px**：三块都凹陷（`--elev` 为负），且面的高度仍为正、没有出现渲染异常。
4. **切 justify-content / direction / 增删盒子**：方块交错飞过去，运动丝滑不跳帧。
5. **本计划的头号风险**：重排动画**进行中**紧盯明细表——数字不许跳。跳了说明 Task 2 的挂起没生效。
6. **拖 gap 滑块 / 拖 resize 手柄**：方块直接跟手，没有拖泥带水的追赶感。
7. **溢出**：把容器压到最小让 `min-width: auto` 撑爆——盒子现在应该**真的伸出容器**（不再被裁），外层滚动容器出现横向滚动条而不是撑破页面。
8. **叠加层对齐**：剩余空间色块随场景一起倾斜，与方块严丝合缝不错位。
9. **3D 开关**：关掉后倾角与厚度归零，回到纯平面；盒子仍可点选。
10. **减弱动效**：系统开启「减弱动态效果」后，重排变瞬时但 3D 与厚度保留。
11. **暗亮主题**：顶面高光与侧面暗面在两个主题下都分得清。
12. **抬起手感**：悬停时方块抬起的高度与时长符合 `motion.liftHeight` / `motion.liftDuration`，调这两个值能立刻看到变化（验证 CSS 变量确实是从 `motion.ts` 下发的）。

- [ ] **Step 6: 更新 CLAUDE.md 的进度段落**

把 M4 标记为完成，下一步指向 M5（陷阱内容 + ScrollTrigger 叙事）。若核对中发现新的布局陷阱，追加进「设计红线」。**特别是**：`.stage` 不得加回 `overflow: hidden` 这条，值得单独写成一条红线——它现在同时被 `min-width: auto` 陷阱和 3D 链条两个理由约束着。

- [ ] **Step 7: 提交**

调用 `/commit` skill，建议信息：`docs: 记录 M4 完成与浏览器核对结论`。
