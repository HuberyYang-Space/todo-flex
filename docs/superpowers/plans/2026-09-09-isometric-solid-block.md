# 演示区方块改用等距实体块 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把演示区盒子的视觉从「贴了材质的平面」改成「一块看得见厚度的实体」，采用样本册第 26 号方案（等距实体块）。

**Architecture:** 顶面与右侧面用 `.stage-box` 的两个伪元素画成**二维平行四边形**（`skewX` / `skewY`），不进 3D 空间；三个面共用左上光源；配一组五层递进的接触阴影把方块钉在台面上。伪元素绝对定位、不参与布局，因此不触碰任何红线。

**Tech Stack:** 纯 CSS（伪元素 + skew + 分层 box-shadow），无新增依赖

**样本册（含全部 32 个候选与三轮取舍）:** https://claude.ai/code/artifact/c94e5026-c873-4035-a93d-d00a8c3f64a1

---

## 为什么是这个方案：三轮试错的结论

**这一节不要跳过。** 前面三轮走过的弯路都有明确的技术原因，重蹈任何一条都会白做一遍。

### 弯路一：CSS 3D transform（已删除）

把侧面用 `rotateX(90deg)` 旋进屏幕当立体面。**失败**：面垂直于视线，投影高度只有 `厚度 × sin(倾角)`——倾角 10° 时约 3px，提到 22° 仍然读不出体积，再大就会压缩 column 方向的主轴。相关代码（`core/depth.ts`、`useStageView`、`.scene` 倾斜层）已全部删除，spec `2026-09-09-stage-3d-motion-design.md` 已标作废。

**正确做法**：等距投影里的面是**当作二维平行四边形直接画出来**的，用 `skew` + `scaleY(cos θ)`，不进 3D 空间，所以不会被投影吃掉。
来源：https://gist.github.com/mralexgray/3bc88abc4d8f0972927f

### 弯路二：只做表面材质（第一批 13 个方案，全部被否）

玻璃拟态、黏土、霓虹、渐变——本质是给平面换配色，读起来仍是平面。

### 弯路三：只做光学不做体积（第二批 12 个方案，全部被否）

菲涅尔边、镜面扫光、渐变描边环确实更精致，但**依然是一个面**。

### 实体成立的三个必要条件

1. **看得见的第二个面**——顶面/侧面，用二维平行四边形画
2. **统一的光源**——左上打光：顶面最亮、正面居中、右侧面最暗
3. **接触阴影**——又紧又暗的第一层把物体钉在台面上，缺了就飘

第 3 条尤其容易漏。单层大模糊阴影只是「物体的模糊剪影」；真实阴影要五层递进、模糊值倍增（1→2→4→8→16），**第一层那道紧而暗的才是接触阴影**。
来源：https://tobiasahlin.com/blog/layered-smooth-box-shadows/

## Global Constraints

- 包管理器 **pnpm**；TypeScript 锁 6.x；**不新增依赖**。
- **红线 6**：演示区禁 `border` 与 `padding`（占布局空间会让诊断层误报）。描边只能用 `outline`，质感只能用 `box-shadow` 与渐变。**伪元素不受此限**——它绝对定位、不参与布局，可以放心用 `padding`。
- **红线 7**：`.stage-item` 禁 `overflow: hidden`。`.stage-box` 同样不能裁剪，否则伸出去的顶面/侧面会被切掉，且内容溢出的头号陷阱也演示不出来。
- 外层 `.stage-item` 的 `transform` 归 GSAP Flip 所有，**一切视觉与形变只能写在内层 `.stage-box`**。这是上一轮踩过的坑。
- 视觉常量进 `src/visual/motion.ts`，组件里不硬编码。
- 注释、提交信息、回复一律简体中文。提交走 `/commit` skill。当前分支 `dev`。

---

### Task 1: 厚度随 gap 自适应

顶面向上伸出一个厚度、右侧面向右伸出一个厚度。`gap: 12px` 下取 10px 刚好不打架，但用户可以把 gap 拖到 0——那时相邻盒子会互相压。厚度必须跟着可用间距收。

**Files:**
- Modify: `src/visual/motion.ts`
- Modify: `src/components/playground/DemoStage.vue`
- Test: `src/components/playground/DemoStage.spec.ts`

**Interfaces:**
- Produces: `motion.blockDepth`（最大厚度 px）与 `motion.blockDepthMin`（下限 px）
- Produces: `.stage-box` 上的内联变量 `--d`，值为 `clamp(min, 可用间距 - 2, blockDepth)`

- [ ] **Step 1: 写失败的测试**

在 `DemoStage.spec.ts` 追加：

```ts
  it('厚度默认取上限', async () => {
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const box = wrapper.get('[data-testid="stage-item"] .stage-box').element as HTMLElement
    expect(box.style.getPropertyValue('--d')).toBe(`${motion.blockDepth}px`)
  })

  it('gap 收窄时厚度跟着收，避免侧面压到邻居', async () => {
    const { state } = useFlexState()
    state.container.columnGap = 6
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const box = wrapper.get('[data-testid="stage-item"] .stage-box').element as HTMLElement
    expect(box.style.getPropertyValue('--d')).toBe('4px')
  })

  it('gap 为 0 时厚度收到下限而不是消失', async () => {
    const { state } = useFlexState()
    state.container.columnGap = 0
    state.container.rowGap = 0
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const box = wrapper.get('[data-testid="stage-item"] .stage-box').element as HTMLElement
    expect(box.style.getPropertyValue('--d')).toBe(`${motion.blockDepthMin}px`)
  })

  it('column 方向改看 rowGap，因为顶面是往上伸的', async () => {
    const { state } = useFlexState()
    state.container.direction = 'column'
    state.container.rowGap = 6
    state.container.columnGap = 40
    const wrapper = mount(DemoStage)
    await wrapper.vm.$nextTick()

    const box = wrapper.get('[data-testid="stage-item"] .stage-box').element as HTMLElement
    expect(box.style.getPropertyValue('--d')).toBe('4px')
  })
```

文件顶部补 `import { motion } from '~/visual/motion'`。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/playground/DemoStage.spec.ts`
Expected: FAIL，`--d` 为空。

- [ ] **Step 3: 加常量**

`src/visual/motion.ts` 末尾追加（保持在同一个 `motion` 对象内）：

```ts
  /** 等距实体块的厚度上限（px），顶面与右侧面各伸出这么多 */
  blockDepth: 10,
  /** 厚度下限（px）。gap 收到 0 时也要留一点，否则方块会塌回平面 */
  blockDepthMin: 3,
```

- [ ] **Step 4: 组件里按 gap 算厚度**

`DemoStage.vue` 的 `<script setup>` 里补：

```ts
/**
 * 顶面往上伸、右侧面往右伸，各占一个厚度。间距不够时必须收，
 * 否则相邻方块的面会压在一起——row 方向看 columnGap，column 方向看 rowGap，
 * 因为顶面始终是沿交叉轴往上伸的那一个。
 */
const blockDepth = computed(() => {
  const gap = isRow.value
    ? Math.min(state.container.columnGap, state.container.rowGap)
    : Math.min(state.container.rowGap, state.container.columnGap)

  return Math.max(motion.blockDepthMin, Math.min(motion.blockDepth, gap - 2))
})
```

把它并进已有的 `stageVars`（该变量沿 `.stage-wrapper` 继承到每个 `.stage-box`）：

```ts
  '--d': `${blockDepth.value}px`,
```

> 测试断言的是 `.stage-box` 上的 `--d`。若继承拿不到内联值，改成在 `itemStyle` 里逐个写；
> 两种都可以，测试用 `getPropertyValue` 读到即可。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run src/components/playground/DemoStage.spec.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

调用 `/commit` skill，建议信息：`feat(playground): 方块厚度随间距自适应`。

---

### Task 2: 等距实体块的样式

**Files:**
- Modify: `src/components/playground/DemoStage.vue`（只动 `<style scoped>`）

**注意：圆角要从 12px 降到 3px。** 平行四边形的面与大圆角接不上，会露出缺口——这是样本册里 26 号取小圆角的原因，视觉上方块会从「圆润卡片」变成「方正块体」。

- [ ] **Step 1: 替换 `.stage-box` 的质感**

把现有 `.stage-box` 的 `border-radius` / `background` / `box-shadow` 三项换成：

```css
.stage-box {
  /* ……display / flex / align 等布局属性保持不变…… */

  border-radius: 3px;
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--accent) 40%, var(--panel)) 0%,
    color-mix(in srgb, var(--accent) 28%, var(--panel)) 100%);

  /*
   * 接触阴影 + 分层投影。第一层又紧又暗的那道才是接触阴影，
   * 物体贴不贴地全看它；后面几层模糊值倍增，模拟环境光的衰减。
   */
  box-shadow:
    0 1px 1px color-mix(in srgb, #000 34%, transparent),
    0 2px 2px color-mix(in srgb, #000 26%, transparent),
    0 4px 4px color-mix(in srgb, #000 20%, transparent),
    0 8px 8px color-mix(in srgb, #000 14%, transparent),
    0 16px 16px color-mix(in srgb, #000 10%, transparent);
}
```

- [ ] **Step 2: 画两个面**

```css
/*
 * 顶面与右侧面是二维平行四边形，不是旋进屏幕的平面——
 * 后者垂直于视线，投影高度只剩「厚度 × sin(倾角)」，等于没画，
 * 这是上一轮 3D 方案失败的直接原因，不要退回去。
 *
 * 光源统一在左上：顶面最亮、正面居中、右侧面最暗。
 */
.stage-box::before,
.stage-box::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

/* 顶面：向上挪一个厚度，再 skew 成平行四边形 */
.stage-box::before {
  top: 0;
  right: 0;
  left: 0;
  height: var(--d, 10px);
  transform: translateY(calc(-1 * var(--d, 10px))) skewX(-45deg);
  transform-origin: bottom left;
  background: color-mix(in srgb, var(--accent) 62%, #fff);
}

/* 右侧面：向右挪一个厚度，skew 方向与顶面在右上角咬合 */
.stage-box::after {
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--d, 10px);
  transform: translateX(var(--d, 10px)) skewY(-45deg);
  transform-origin: top left;
  background: color-mix(in srgb, var(--accent) 34%, #000);
}
```

`.stage-box` 需要 `position: relative`（若尚未设置则补上）。

- [ ] **Step 3: 悬停与选中态跟上**

悬停时厚度加大、接触阴影拉开；选中时三个面一起换成 `--accent-2` 体系：

```css
.stage-item:hover .stage-box,
.stage-item:focus-visible .stage-box {
  --d: calc(var(--d, 10px) + 3px);

  translate: 0 calc(-1 * var(--lift, 6px));
  scale: var(--lift-scale, 1.03);
}

.stage-item.is-selected .stage-box {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--accent-2) 40%, var(--panel)) 0%,
    color-mix(in srgb, var(--accent-2) 28%, var(--panel)) 100%);
}

.stage-item.is-selected .stage-box::before {
  background: color-mix(in srgb, var(--accent-2) 62%, #fff);
}

.stage-item.is-selected .stage-box::after {
  background: color-mix(in srgb, var(--accent-2) 34%, #000);
}
```

> `--d: calc(var(--d) + 3px)` 会自引用导致无效。实现时改成在 `.stage-box` 上定义
> `--d-hover` 或直接用两个独立变量，不要让 `--d` 引用自己。

- [ ] **Step 4: 跑测试与 lint**

Run: `pnpm test && pnpm lint`
Expected: 全绿。样式改动不影响任何断言。

- [ ] **Step 5: 提交**

调用 `/commit` skill，建议信息：`style(playground): 方块改用等距实体块`。

---

### Task 3: 验证

- [ ] **Step 1: 三项验证**

Run: `pnpm test`、`pnpm lint`、`pnpm build`
Expected: 全绿，把输出贴进回复。

- [ ] **Step 2: 请示浏览器验证**

按项目约定**先问用户**，不要自行调用 claude-in-chrome。

> **环境已知问题**：本机那个 Chrome 窗口反复掉回不可见状态（`visibilityState: hidden`），
> 一不可见 requestAnimationFrame 就停发，GSAP 时间线与 CSS transition 全部冻在第一帧。
> 上一轮因此两次把冻结状态误判成缺陷。**静态样式可以靠截图验，动效必须让用户自己看。**
> 量任何与动画有关的东西之前，先跑一次 rAF 计数确认页面在动。

- [ ] **Step 3: 浏览器核对清单**

1. 默认态（gap 12）：顶面与右侧面都可见，三面明暗关系是左上打光。
2. 把 gap 拖到 0：厚度收到下限，相邻方块的面**不重叠**。
3. 切 `column`：顶面仍在上方，不与上一个方块打架。
4. 切 `wrap` 并让它换行：跨行时面不互相压。
5. 容器压到最小让 `min-width: auto` 撑爆：溢出的方块连同侧面一起伸出容器，未被裁切。
6. 悬停：厚度加大、方块抬起、接触阴影拉开。
7. 选中：三个面一起转成紫色体系。
8. 暗色与亮色主题：顶面/侧面的明暗差在两个主题下都读得出来。
9. 触发一次重排（点 `space-between`）：面跟着方块走，动画结束后无残留。

- [ ] **Step 4: 更新进度**

`CLAUDE.md` 的「当前进度」补上 M4 的收尾状态。

- [ ] **Step 5: 提交**

调用 `/commit` skill，建议信息：`docs: 记录等距实体块的浏览器核对结论`。
