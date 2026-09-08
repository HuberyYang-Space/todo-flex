# todo-flex 设计文档

> 日期：2026-09-08
> 状态：已定稿，待实现计划

## 1. 背景与定位

CSS Flexbox 的交互演示工具已经很多（Flexbox Froggy、flexbox.help、各类 Playground、Chrome DevTools 的 flex 徽章），
但它们有一个共同盲区：**全部在演示「对齐」，没有一个讲清楚「尺寸是怎么算出来的」**。

而实际开发中的 flex 疑难杂症，绝大多数出在尺寸侧：

- `flex: 1` 为什么没有等分？
- `min-width: auto` 为什么让子元素撑爆容器？
- `flex-basis: 0` 和 `flex-basis: auto` 到底差在哪？

todo-flex 的定位由此确定：**不是又一个 flex playground，而是 flex 布局算法的透明化工具**——
把规范里隐藏的计算过程显式画出来。这与作者已有的 equals-demo（把 JS 相等规则做成可查的二维表）是同一个精神内核。

## 2. 目标与非目标

### 目标

1. 覆盖 flex 容器与项目的全部属性，可自由排列组合，演示区实时反映效果。
2. 把「剩余空间」与「尺寸分配」可视化：色块画出 free space，公式展开 grow/shrink 的分配过程。
3. 理论值与浏览器实际值并排校验，不一致时高亮解释是哪条规则介入了。
4. 沉淀 5 个高频陷阱案例，可一键载入 Playground 复现。
5. 状态可通过 URL 分享与还原。
6. 中英双语、暗亮双主题。
7. 视觉上有辨识度：暗色科技感 + 分层动效（GSAP Flip / SVG 叠加层 / three.js 氛围 / ScrollTrigger 叙事）。

### 非目标

- **不实现 flex 布局算法来驱动渲染**。演示区必须是真实 DOM + 真实 CSS，否则站点的可信度与「复制这段 CSS 到项目里」的承诺同时崩塌。
- 不做关卡/闯关游戏（Flexbox Froggy 已经做得很好）。
- 不做 CSS Grid（未来可作为 todo-grid 独立站点）。
- 不做用户账号、收藏、服务端存储——纯静态站。

## 3. 信息架构

单页滚动叙事，Playground 是绝对主角：

```
┌ Hero（一屏，不得更长）
│   three.js 氛围背景 + 标题 + 一句话定位 + 滚动引导
├ Playground（站点 80% 的价值）
│   左 · 操作区   容器属性 / 选中盒子属性 / 盒子增删排序
│   右 · 演示区   真实 flex 容器 + SVG 叠加层 + 右下角 resize 手柄
│   下 · 明细区   理论 vs 实际计算表 + 实时 CSS 输出与复制
├ Traps（5 个陷阱，一个一屏，ScrollTrigger 驱动）
└ Footer
```

移动端（< 768px）：操作区降为底部抽屉（sheet），演示区占满主视口，明细表默认折叠。

## 4. 状态模型

单一状态源，全部可序列化，无 DOM 引用。

```ts
type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse'
type Wrap = 'nowrap' | 'wrap' | 'wrap-reverse'

interface FlexContainerState {
  display: 'flex' | 'inline-flex'
  direction: Direction
  wrap: Wrap
  justifyContent: string // flex-start | center | space-between | ...
  alignItems: string // stretch | center | baseline | ...
  alignContent: string // normal | space-between | stretch | ...
  rowGap: number // px
  columnGap: number // px
  width: number // 容器尺寸，可拖拽调整
  height: number
}

interface FlexItemState {
  id: string
  grow: number
  shrink: number
  basis: string // 'auto' | 'content' | '0' | '120px' | '30%'
  order: number
  alignSelf: string // auto | stretch | center | baseline | ...
  size: number // 主轴方向上的内容固有尺寸（px），决定 min-width:auto 的下限与 baseline 位置
  minWidthAuto: boolean // 是否保留 min-width:auto（关闭则写入 min-width:0）
  marginAuto: boolean // 是否给该项加 margin:auto（用于演示它如何吃掉剩余空间）
}
```

**设计决策：item 的内容用一个 `size` 数字表示，不允许自定义文本。**
理由：`size` 直接对应「内容固有尺寸」（始终指主轴方向，`direction` 为 column 时即内容高度），
既能驱动 `min-width: auto` 陷阱与 baseline 演示，
又让 URL 序列化保持简单（无需处理任意文本的转义）。盒子标签由索引自动生成（A、B、C…）。

## 5. 模块划分与数据流

核心原则：**推导逻辑与 DOM 彻底隔离**，纯函数部分才能走 TDD。

```
state ──→ 渲染 ──→ 观测 ──→ 诊断 ──→ 展示
  └────→ 推导 ──────────────↗
```

| 模块 | 职责 | 依赖 DOM |
| --- | --- | --- |
| `composables/useFlexState.ts` | 唯一状态源：容器属性 + items 数组 + 当前选中 id | 否 |
| `core/deriveLayout.ts` | 纯函数推导引擎：解析 basis、分行、算剩余空间、按 grow/shrink 分配、输出推导步骤 | 否 |
| `core/urlCodec.ts` | 状态 ↔ URL 短码，纯函数，双向可逆 | 否 |
| `core/diagnostics.ts` | 比对理论 vs 实际，判定命中的规则并产出解释 | 否 |
| `core/cssEmit.ts` | 由状态生成可复制的 CSS 文本 | 否 |
| `composables/useMeasure.ts` | 观测层：读取容器与每个 item 的真实布局尺寸与位置 | 是 |
| `composables/useFlip.ts` | GSAP Flip 封装，状态变化时驱动布局过渡 | 是 |
| `composables/useI18n.ts` | 轻量双语 | 否 |
| `components/playground/DemoStage.vue` | 真实 flex 容器与盒子渲染，只吃 state，不含逻辑 | 是 |
| `components/playground/OverlayLayer.vue` | SVG 叠加：剩余空间、轴向箭头、尺寸 HUD、选中光晕 | 是 |
| `components/playground/ControlPanel.vue` | 由属性元信息表驱动生成的控件面板 | — |
| `components/playground/MetricsTable.vue` | 理论 vs 实际明细表与公式展开 | — |
| `components/playground/CssOutput.vue` | CSS 输出与复制（prismjs 高亮） | — |
| `components/traps/*` | 陷阱板块 | 是 |
| `visual/HeroScene.ts` | three.js 场景，与业务零耦合，lazy import | 是 |
| `visual/motion.ts` | 动效 token（duration / ease），避免各处硬编码 | 否 |
| `data/flexProperties.ts` | 属性元信息表 | 否 |
| `data/traps.ts` | 陷阱案例定义 | 否 |

## 6. 核心机制：推导 / 观测 / 诊断

这是整个站点的技术核心，也是差异化所在。

### 6.1 推导引擎（理论值）

`core/deriveLayout.ts` 是纯函数，输入状态、输出推导结果，零 DOM 依赖：

```ts
interface DerivedItem {
  id: string
  basisResolved: number // 解析后的 flex-basis（px）
  hypotheticalMainSize: number // 假设主轴尺寸
  finalMainSize: number // 理论最终主轴尺寸
  deltaFromGrow: number // 由 grow 分得（≥ 0）
  deltaFromShrink: number // 由 shrink 让出（≤ 0）
  lineIndex: number
}

interface DerivedLine {
  index: number
  itemIds: string[]
  usedMainSize: number
  freeSpace: number // 正 = 有剩余，负 = 溢出
  totalGrow: number
  totalShrinkWeighted: number // Σ(shrink × basis)
}

interface DerivationStep {
  kind: 'resolveBasis' | 'lineBreak' | 'freeSpace' | 'growDistribute' | 'shrinkDistribute'
  lineIndex: number
  itemId?: string
  params: Record<string, number>
  messageKey: string // 交给 i18n 渲染成公式文案
}

interface DerivedLayout {
  lines: DerivedLine[]
  items: DerivedItem[]
  steps: DerivationStep[]
}
```

推导覆盖的规则：

1. **basis 解析**：`auto` → 取 `size`；`content` → 取 `size`；`<length>` → 直接取值；`<percentage>` → 按容器主轴尺寸换算；`0` → 0。
2. **分行**：`nowrap` 单行；`wrap` 按假设尺寸 + gap 累加超过容器主轴尺寸时断行。
3. **剩余空间**：`容器主轴尺寸 - Σ假设尺寸 - Σgap`。
4. **grow 分配**（剩余为正）：`item.grow / Σgrow × 剩余空间`。
5. **shrink 分配**（剩余为负）：按 `shrink × basis` 加权，`(item.shrink × item.basis) / Σ(shrink × basis) × 溢出量`。

推导**不模拟** `min-width: auto` 的下限截断——这正是留给诊断层去发现的缝隙（见 6.3）。

### 6.2 观测层（实际值）

`composables/useMeasure.ts` 读取浏览器算出的真实布局。

**关键技术决策：测量口径必须避开 transform。**
GSAP Flip 用 `transform` 做位移动画，动画期间 `getBoundingClientRect()` 返回的是中间态，
若用它，明细表的数字会在动画过程中乱跳。因此：

- **尺寸**：用 `ResizeObserver`，它报告的是 border-box 布局尺寸，不含 transform 影响。
- **位置**：用 `offsetLeft` / `offsetTop`，同样不受 transform 影响。
- **禁止**在观测层使用 `getBoundingClientRect()`。

这样动画照播、数字照准，两者互不干扰，无需等待动画结束。

### 6.3 诊断层（理论 vs 实际）

`core/diagnostics.ts` 比对两组数字，差值超过 0.5px 即判定为「规则介入」：

```ts
interface Diagnostic {
  itemId: string
  rule: 'min-width-auto' | 'margin-auto' | 'max-size-clamp'
  theoretical: number
  actual: number
  messageKey: string
}
```

判定优先级（自上而下匹配第一条命中的）：

1. `actual > theoretical` 且 `actual ≈ item.size` 且 `minWidthAuto` 为真 → `min-width-auto`（收缩被内容固有尺寸截断）。
2. `marginAuto` 为真且该行剩余空间被吞掉（`justify-content` 不再生效）→ `margin-auto`。
3. 其余不一致 → `max-size-clamp`（兜底解释：尺寸被某个上下限截断）。

`basis-vs-width` 不属于运行时诊断——`flex-basis` 覆盖 `width` 是确定性规则，不产生理论与实际的偏差，
它作为陷阱案例（8.2 之二）在 Traps 板块讲解。

**这是整个产品的高光时刻**：初学者踩 flex 坑，十次有八次撞在这个缝隙上；
现有工具无一例外只给结果、不给缝隙。todo-flex 在用户自由玩耍时就自动发现并当场解释。

明细表呈现形式（每个 item 一行）：

```
#  basis   grow  理论    实际    诊断
A  100px   0     100px   100px   ✓
B  0       2     200px   240px   ⚠ min-width:auto 撑住了内容宽度
```

## 7. 视觉与特效分层

基调：**暗色科技感**——深色底 + 霓虹主色（青 `#22d3ee` / 紫 `#a78bfa`）+ 等宽字体 + 发光边框。
亮色主题作为可切换的备选（CSS 变量已在 `src/styles/main.css` 铺好）。

| 层 | 技术 | 内容 |
| --- | --- | --- |
| 布局过渡 | GSAP Flip | 属性变化时盒子从旧位置平滑滑到新位置。既是炫技也是教学：能看清元素「怎么移过去的」 |
| 叠加层 | SVG（`pointer-events: none`） | 剩余空间流动斜纹、主/交叉轴箭头随 direction 旋转、尺寸 HUD、选中光晕 |
| 首屏 | three.js | 氛围背景（shader 网格 + 鼠标视差），不参与布局，可整层降级 |
| 陷阱叙事 | GSAP ScrollTrigger | pin + scrub，三拍节奏：现象 → 归因 → 修复 |

实现约束：

- GSAP 插件按需注册：`gsap.registerPlugin(Flip, ScrollTrigger)`。
- Flip 的接入点：`watch(state, ..., { flush: 'pre' })` 中调用 `Flip.getState()`，`await nextTick()` 后 `Flip.from()`；换行场景启用 `absolute: true`。
- three.js 按需 import 具体模块，禁止 `import * as THREE`；`IntersectionObserver` 离屏即停渲染循环；lazy import 保证不进主 chunk。
- `prefers-reduced-motion` 是一等公民：装饰动效全部关闭，布局过渡降为瞬时，three.js 场景渲染静态帧。
- 低端设备（`navigator.hardwareConcurrency <= 4` 或移动端）跳过 three.js，回退 CSS 渐变背景。
- 动效参数统一放 `visual/motion.ts`，不在组件里硬编码 duration / ease。

## 8. 内容清单

### 8.1 属性覆盖

控制面板由 `data/flexProperties.ts` 驱动生成。**常用值直出，规范全集放「更多值」折叠区**，
避免面板因为穷举 `start` / `left` / `self-start` 这类近义值而爆炸。

容器属性：

| 属性 | 常用值 | 折叠区补充 |
| --- | --- | --- |
| `display` | flex / inline-flex | — |
| `flex-direction` | row / row-reverse / column / column-reverse | — |
| `flex-wrap` | nowrap / wrap / wrap-reverse | — |
| `justify-content` | flex-start / center / flex-end / space-between / space-around / space-evenly | start / end / left / right |
| `align-items` | stretch / flex-start / center / flex-end / baseline | first baseline / last baseline / self-start / self-end |
| `align-content` | normal / flex-start / center / flex-end / space-between / space-around / space-evenly / stretch | — |
| `row-gap` / `column-gap` | 数值滑块 | — |

项目属性：

| 属性 | 控件 |
| --- | --- |
| `order` | 数值输入 |
| `flex-grow` | 数值输入 |
| `flex-shrink` | 数值输入 |
| `flex-basis` | 预设（auto / content / 0 / 自定义长度 / 百分比） |
| `flex` 简写 | 一键预设：`1` / `auto` / `initial` / `none`，选中后回填三个分量 |
| `align-self` | auto / stretch / flex-start / center / flex-end / baseline |
| 内容尺寸 `size` | 数值滑块 |
| `min-width: auto` | 开关（关闭即写入 `min-width: 0`） |
| `margin: auto` | 开关（演示它如何吃掉剩余空间、架空 `justify-content`） |

`flex-flow` 作为只读简写展示在 CSS 输出区，不单独提供控件（与 direction/wrap 重复）。

### 8.2 陷阱清单（v1 五个）

1. **`min-width: auto` 导致不收缩** —— 最高频。`flex: 1` 的子元素装了长内容，不但不收缩还撑爆容器；修复：`min-width: 0`。
2. **`flex-basis` 与 `width` 的优先级** —— 两者同时存在时 `flex-basis` 胜出（除非 basis 为 auto）。
3. **`flex` 简写四种取值展开对照** —— `1` / `auto` / `initial` / `none` 分别等于什么三元组，行为差在哪。
4. **`align-content` 单行失效** —— `nowrap` 时该属性完全无效，是最常见的「改了没反应」。
5. **`margin: auto` 吃掉全部剩余空间** —— 一旦生效，`justify-content` 就不再起作用。

每个陷阱含：现象演示 → 规则归因 → 修复演示 → 「载入 Playground 复现」按钮（写入 URL 后滚动到 Playground）。

## 9. 国际化

不引入 vue-i18n（单页站点为 ~20kb 不值），自建轻量方案：

- `src/i18n/zh.ts` 与 `en.ts`，按模块分块（`controls` / `metrics` / `traps` / `hero`）。
- **类型安全**：`en.ts` 用 `satisfies typeof zh` 约束，漏翻一个 key 就编译报错。
- 语言存 localStorage，同时支持 URL 参数 `?lang=en` 覆盖。
- 中文为默认语言（作者主要受众），简体。

## 10. URL 序列化

**不用 base64(JSON)**：不可读、不可手写、改一个字符全废。改用带版本前缀的短码紧凑格式。

```
?v=1&c=<container>&i=<items>&sel=<id>&lang=zh
```

- **container**：固定顺序、点号分隔
  `display.direction.wrap.justify.align.alignContent.rowGap.colGap.width.height`
  例：`flex.row.wrap.between.center.stretch.12.12.720.320`
- **items**：逗号分隔，每项内部短横线分隔
  `grow-shrink-basis-order-alignSelf-size-minWidthAuto-marginAuto`
  例：`1-1-auto-0-auto-80-1-0,2-1-0-0-center-120-0-0`
- 长值用短码映射（`between` ↔ `space-between`、`fs` ↔ `flex-start`），映射表与属性元信息表同源。

约束：

- `core/urlCodec.ts` 提供 `encode(state): string` 与 `decode(query): FlexState | null`，双向可逆。
- 解析失败（版本不符、字段缺失、值非法）一律回退默认状态并 `console.warn`，**绝不白屏**。
- 状态变化时以 `replaceState` 写入，不污染浏览器history。

## 11. 测试策略

| 对象 | 策略 |
| --- | --- |
| `core/deriveLayout.ts` | 单元测试全覆盖，用例取自规范经典场景：basis `0` vs `auto`、grow 按比例分配、shrink 按 `shrink × basis` 加权、gap 参与剩余空间计算、wrap 分行边界 |
| `core/urlCodec.ts` | round-trip 属性测试（`decode(encode(x))` 深等于 `x`）+ 非法输入回退 |
| `core/diagnostics.ts` | 给定理论值与观测值，断言命中的规则与优先级 |
| `core/cssEmit.ts` | 快照测试，确认输出可直接粘贴使用 |
| 组件 | 只测关键交互：点选盒子 → 面板切换、增删盒子 → 状态同步 |
| three.js / GSAP | **不测**，成本高收益低 |

实现顺序遵循 TDD：`core/` 下每个模块先写测试再写实现。

## 12. 目录结构

```
src/
  core/                 # 纯逻辑，零 DOM
    deriveLayout.ts
    diagnostics.ts
    urlCodec.ts
    cssEmit.ts
  composables/
    useFlexState.ts
    useMeasure.ts
    useFlip.ts
    useI18n.ts
    useDark.ts
  components/
    playground/         # ControlPanel / DemoStage / OverlayLayer / MetricsTable / CssOutput
    traps/              # TrapSection 等
    hero/               # HeroCanvas
  visual/
    HeroScene.ts        # three.js
    motion.ts           # 动效 token
  i18n/
    zh.ts / en.ts
  data/
    flexProperties.ts   # 属性元信息表，驱动控制面板
    traps.ts            # 陷阱案例定义
  styles/
    main.css            # CSS 变量主题
```

## 13. 部署与性能预算

- 纯静态站，`pnpm build` 产出 `dist`，部署方式沿用 equals-demo（自有服务器 nginx）。
- `vite.config.ts` 的 `base` 保持 `'/'`，即部署到独立子域名或独立端口；若改为子路径部署，需同步调整 `base`。
- 性能预算：首屏 JS（不含 three.js）≤ 150kB gzip；three.js 场景为独立 lazy chunk；演示区交互保持 60fps。

## 14. 可访问性

- 控制面板一律使用原生表单控件（radio / select / input），保证键盘可达。
- 演示区盒子带 `tabindex`，Enter 键选中，与鼠标点选等价。
- 暗色主题下正文对比度 ≥ 4.5:1。
- 完整支持 `prefers-reduced-motion`（见第 7 节）。

## 15. 实现里程碑

分批交付，每个里程碑结束时站点都处于可运行、可演示的状态：

| # | 里程碑 | 内容 | 完成标志 |
| --- | --- | --- | --- |
| M1 | 推导引擎 | `core/deriveLayout.ts` + 测试；`core/cssEmit.ts` | 单元测试全绿，无 UI |
| M2 | 可用的 Playground | 状态源、属性元信息表、控制面板、演示区真实渲染、CSS 输出 | 能自由调属性并复制 CSS |
| M3 | 透明化核心 | 观测层、诊断层、明细表、剩余空间与轴向叠加层、容器拖拽 | 理论/实际并排显示，不一致时高亮解释 |
| M4 | 动效 | GSAP Flip 布局过渡、叠加层动画、`prefers-reduced-motion` 降级 | 属性切换时盒子平滑移动且数字不抖 |
| M5 | 内容层 | 5 个陷阱板块 + ScrollTrigger 叙事 + 一键复现 | 陷阱可从 Traps 跳回 Playground 还原 |
| M6 | 分享与双语 | URL codec、i18n、暗亮主题打磨 | 分享链接可还原、中英可切换 |
| M7 | 首屏与收尾 | three.js Hero、性能预算核对、可访问性检查、部署 | 构建产物达标并上线 |

M1 与 M2 是骨干，M3 是差异化所在——若时间受限，M4 之后的内容可以顺延，但 M3 不可裁剪。

## 16. 技术栈

Vue 3（script setup）· Vite · TypeScript · UnoCSS · VueUse · GSAP（Flip / ScrollTrigger）· three.js · prismjs · Vitest · @antfu/eslint-config

工程约定沿用作者模板：pnpm、husky + commitlint（Conventional Commits）、lint-staged 自动修复暂存文件、`.vscode` 按 antfu README 配置。

> 注：TypeScript 锁定 6.x 而非最新的 7.x —— `@typescript-eslint@8` 要求 `typescript < 6.1.0`，装 7 会导致整条 lint 链失配。
