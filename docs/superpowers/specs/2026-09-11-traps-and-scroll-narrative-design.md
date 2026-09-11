# M5 设计：陷阱内容层与滚动叙事

- 日期：2026-09-11
- 状态：已定稿，待出实现计划
- 上游文档：`docs/superpowers/specs/2026-09-08-todo-flex-design.md`（第 8.2 节陷阱清单、第 7 节特效分层、第 15 节里程碑表）

## 1. 目标与范围

交付里程碑 M5「内容层」：5 个陷阱板块 + ScrollTrigger 三拍叙事（现象 → 归因 → 修复）+ 一键载入 Playground 复现。

完成标志：陷阱板块可从 Traps 区跳回 Playground 并精确还原该陷阱的布局状态。

**不在本次范围**：Hero（M7）、主题打磨（M6）。文案一律写简体中文硬编码。

> 2026-09-11 补记：原文这里写的是「等 M6 建 `src/i18n/` 时再整体抽取」。
> i18n 已从首版整体移出（见 `2026-09-08-todo-flex-design.md` 第 9 节），
> 所以陷阱文案不再有「待抽取」这一步，硬编码就是终态。

## 2. 关键决策

每条都记下被否掉的方案，避免后来者（或未来的我）重走一遍。

### 2.1 陷阱演示区抽成无状态 `TrapStage`，不复用 `DemoStage`

`DemoStage` 硬绑模块级单例 `useFlexState`，而 5 个陷阱各有自己的布局状态，直接复用不成立。

**否掉「给 DemoStage 加可注入状态」**：`useMeasure` / `useFlip` / `OverlayLayer` 全是单例语义，
多开实例必然互相覆盖观测数据。让一个组件同时承担「全站唯一真实布局来源」和「多实例演示」两个角色是自找麻烦。

**否掉「每个陷阱手写 HTML/CSS 片段」**：5 个陷阱 × 前后两态 = 10 份重复模板，视觉必然跟 Playground 逐渐漂移，
且陷阱数据不再是可序列化的 `FlexState`，没法喂给「一键复现」。

`TrapStage` 仍然是**真实 DOM + 真实 CSS flex 渲染**（红线 1），只是砍掉观测层、叠加层、resize 手柄。

### 2.2 `TrapStage` 自己写扁平方块样式，不搬 DemoStage 的等距实体块 CSS

两个理由：

1. `DemoStage` 的 scoped CSS 经过大量浏览器实测（见 `docs/superpowers/plans/2026-09-09-isometric-solid-block.md`），
   把它提成全局样式共享是白担风险——scoped 去掉后选择器优先级与作用域都会变。
2. 等距块的顶面会画到容器外（CLAUDE.md 里记的待核对项 4），在陷阱区更小的演示里更碍眼。

陷阱区的主角是「现象」不是「质感」，视觉克制反而主次分明。

### 2.3 三拍用 pin + 滚动进度切**离散**拍，scrub 不做连续插值

三拍之间的差异是离散的 CSS 属性变化（`min-width: auto` → `0` 没有中间态），
连续插值在这里无处可用。scrub 只驱动文字卡片的入场/退场过渡，布局状态在拍与拍之间离散切换。

保留了 pin 的核心价值：**用户用滚轮控制节奏，可以来回擦着反复对比修复前后**。

**否掉「进入视口自动播一遍」**：节奏由站点定而不是用户定，想反复对比只能整段重播。

**否掉「手动步进器」**：站点从「一页式故事」退化成「五块卡片」，用户不主动点就什么也看不到。

### 2.4 一个 `TrapStage` 随拍切 state，不是 before/after 并排

| 拍 | TrapStage 渲染 | 旁边 |
| --- | --- | --- |
| ① 现象 | `before` | 现象文案 |
| ② 归因 | **仍是 `before`** | `TrapDiff` 浮出 + 规则文案 |
| ③ 修复 | 切到 `after` | 修复文案 |

第 2 拍演示区必须不动：归因是在解释眼前这个现象，一边解释一边把现象换掉就讲不通了。

并排两份等于把时间叙事退回成静态对比图，pin 就白做了。

状态切换靠 CSS transition，**不引入 GSAP Flip**——`useFlip` 是单例 `observeFlip`，多实例会打架。

### 2.5 一键复现直接改单例状态，不走整页跳转

现有事实：`useFlexState` **只在模块加载那一刻**读一次 `location.search`，之后没有任何人监听地址栏。

所以上游设计文档第 308 行「写入 URL 后滚动到 Playground」照字面只做 `replaceState` 的话，Playground 不会有任何反应。

改为：`loadState(next)` 直接改单例 → `useShareUrl` 本来就 watch 着 state，300ms 后地址栏自动同步。
不刷新、不白屏、不丢滚动位置，而且 GSAP Flip 会把「陷阱状态落入 Playground」播成一段真实的布局过渡。

**否掉 `location.assign(encode(state))`**：整页白屏重载、滚动位置丢失（还得额外写一套「刷新后滚到 Playground」），
且首屏 Flip 会把初始渲染当成一次布局变化重播一遍——CLAUDE.md 里明确警告过这一点。

### 2.6 归因拍的差异从两份完整 state 相减得出，不直读 patch

`base` 里可能已经含有与 `after` 相同的字段，直读 patch 会报出假差异。
`diffStates(before, after)` 是纯函数，好测，且保证「到底改了哪一行」永远与实际渲染一致，不会跟手写文案脱节。

### 2.7 陷阱 2 改为「basis: auto vs 0」

上游文档 8.2 的陷阱 2 是「`flex-basis` 与 `width` 的优先级」，但 `FlexItemState` **没有 `width` 字段**——
红线 8 规定 item 内容只用一个 `size` 数字表示。原样实现要加字段并连带改
`urlCodec`（短码格式进位、老链接失效）/ `cssEmit` / `deriveLayout` / 控制面板，为一个陷阱动整条链路。

改为演示同一条规则的另一面：**主轴尺寸的真正来源是 `flex-basis` 而不是内容**。
`basis: auto` 时回落到内容尺寸（`size`），`basis: 0` 时 `size` 被完全忽略。数据模型零改动。

## 3. 模块划分

```
src/
  data/traps.ts                      5 个陷阱定义（纯数据，零 DOM）
  core/trapPatch.ts                  patch 合并 + 状态差异提取（纯函数，走 TDD）
  composables/useTrapScroll.ts       ScrollTrigger 封装：滚动进度 → beat 索引 + 降级判断
  components/traps/
    TrapsSection.vue                 容器：遍历 traps
    TrapSection.vue                  单个陷阱：pin + 三拍状态机
    TrapStage.vue                    陷阱专用精简演示区
    TrapDiff.vue                     归因拍的属性差异表
```

`core/trapPatch.ts` 遵守红线 2：零 DOM、零 vue 依赖。

## 4. 数据模型

新增类型放 `src/core/types.ts`（与既有 `FlexState` 等并列）：

```ts
/** 只写要改的字段，其余从上一层继承。item 按索引定位，不用 id——陷阱数据不关心 id 怎么生成 */
export interface TrapItemPatch {
  index: number
  patch: Partial<Omit<FlexItemState, 'id'>>
}

export interface TrapVariant {
  container?: Partial<FlexContainerState>
  /** 盒子数量。给了就按这个数量重建 items，不给则沿用上一层 */
  itemCount?: number
  items?: TrapItemPatch[]
}

export interface TrapBeat {
  title: string
  body: string
  /** 可选的展示用代码块，交给 prismjs 高亮（陷阱 3 的四种取值对照表用它） */
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

/** 归因拍展示的一条属性差异 */
export interface PropertyDiff {
  scope: 'container' | 'item'
  /** scope 为 item 时才有 */
  itemIndex?: number
  key: string
  from: string
  to: string
}
```

`core/trapPatch.ts` 导出两个纯函数：

```ts
/** createDefaultState() 上依次叠 base、再叠指定变体，产出完整可用的 FlexState */
export function resolveVariant(trap: Trap, which: 'before' | 'after'): FlexState

/** 两份完整 state 相减。顺序稳定：先容器属性（按 FlexContainerState 字段序），再按 itemIndex 升序 */
export function diffStates(before: FlexState, after: FlexState): PropertyDiff[]
```

`diffStates` 的输出顺序必须确定，否则归因拍的行序会随对象键序漂移、快照测试也不稳。

## 5. 三拍叙事

`TrapSection` 持有 `beat: 0 | 1 | 2`，据此决定：

- `TrapStage` 的 state：`beat < 2 ? before : after`
- 三张文案卡片的可见性（当前拍高亮，其余淡出）
- `TrapDiff` 只在 `beat === 1` 出现

## 6. ScrollTrigger 与降级

`useTrapScroll(el: Ref<HTMLElement | undefined>)` 返回 `{ beat: Ref<0|1|2>, degraded: Ref<boolean> }`。

正常形态：

```
ScrollTrigger.create({
  trigger: el, start: 'top top', end: '+=200%',
  pin: true, scrub: true, onUpdate,
})
```

`onUpdate` 把 `self.progress` 映射成拍索引，**必须带滞回（hysteresis）**——
不加的话在 0.33 / 0.66 阈值附近来回滚会疯狂抖拍。

文字卡片的入场/退场用 CSS transition 跟着 `beat` 走，**不建 GSAP 时间线**：离散切换不需要时间线。

### 降级

两个条件任一命中即降级，**只维护这一套降级形态**（不为移动端与 reduced-motion 各写一套）：

- `prefers-reduced-motion: reduce`
- 视口宽度 < 768px（iOS Safari 地址栏伸缩会让 pin 的 vh 抖动，是经典坑）

降级后完全不创建 ScrollTrigger：三拍垂直堆叠全部展开，各自带一个 `TrapStage`（①② 用 `before`、③ 用 `after`），
`TrapDiff` 常驻显示。内容 100% 可读，零动效，零滚动劫持。

`pin: true` 会插入 spacer 并把元素设为 fixed，5 个陷阱各占 200% 滚动距离，
页面总高度约 15 屏——这是已知代价，接受。

## 7. 一键复现

`useFlexState` 新增一个导出，与既有 `resetState()` 同形：

```ts
function loadState(next: FlexState): void {
  Object.assign(state, next)
  sequence = state.items.length   // 与 resetState 一致，避免后续 addItem 撞号
}
```

每个陷阱底部两个按钮：`[载入现象] [载入修复]`。
两个而不是一个——用户在第 1 拍看到坏状态时，最想自己上手调的恰恰是那个坏状态。

点击后：`loadState(resolveVariant(trap, which))`，随后
`scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' })` 滚回 Playground。

地址栏无需手动处理，`useShareUrl` 已经 watch 着 state。

## 8. 五个陷阱的状态设计

所有陷阱都从 `createDefaultState()` 起算（容器 720×320、gap 12、3 个 `size: 80` 的默认盒子），
下表只列相对默认值的改动。

| # | id | 陷阱 | base | before → after |
| --- | --- | --- | --- | --- |
| 1 | `min-width-auto` | `min-width: auto` 导致不收缩 | 容器 `width: 480`；item-1 `grow: 1, basis: '0', size: 320` | item-1 `minWidthAuto: true → false` |
| 2 | `basis-source` | 主轴尺寸的真正来源是 basis | 全体 `grow: 1`；item-1 `size: 200`（另两个留 80） | 全体 `basis: 'auto' → '0'` |
| 3 | `flex-shorthand` | `flex` 简写四种取值 | 容器 `width: 480`；全体 `size: 200, minWidthAuto: false` | 全体 `grow/shrink/basis` 从 `0 / 0 / 'auto'`（`flex: none`）→ `1 / 1 / '0'`（`flex: 1`） |
| 4 | `align-content-single-line` | `align-content` 单行失效 | 容器 `width: 360, alignContent: 'center'`；`itemCount: 4`，全体 `size: 100, shrink: 0` | 容器 `wrap: 'nowrap' → 'wrap'` |
| 5 | `margin-auto` | `margin: auto` 架空 justify-content | 容器 `justifyContent: 'space-between'` | item-1 `marginAuto: true → false` |

各自要演出来的现象：

1. **陷阱 1**：可用 480 − 24（两道 gap）= 456，item-2/3 各占 80，剩 296 该归 item-1；
   但 `min-width: auto` 把它撑在 min-content 的 320 上不肯收缩，三盒总和 320 + 80 + 80 + 24 = 504，**溢出 24px**。
   关掉后精确落回 296。
2. **陷阱 2**：`basis: auto` 时各自从内容尺寸起算（200 / 80 / 80），剩余 336 按 grow 均摊，得 312 / 192 / 192——**分得不均**；
   切 `basis: 0` 后 `size` 被彻底忽略，三盒精确均分 232。
   （232 > item-1 的 min-content 200，不会被自动最小尺寸截断，不与陷阱 1 串味。）
3. **陷阱 3**：`flex: none` 三盒各 200、总和 624 超出 480 容器，**溢出 144px 且拒绝收缩**；
   `flex: 1` 后均分 152 正好填满。
   base 里先关掉 `minWidthAuto`，免得自动最小尺寸把 `flex: 1` 的结果又撑回 200——那是陷阱 1 的戏，不要在这里抢。
   **这个陷阱的 diff 恰好有三条（grow / shrink / basis）**，归因拍正好用它说明「一个简写背后是三个属性」，
   再配代码块列全 `1` / `auto` / `initial` / `none` 的三元组对照。
4. **陷阱 4**：`alignContent: 'center'` 从头就设着。nowrap 时 4 盒共 400 + 36 = 436 挤在一行里溢出，
   而 `align-content` **纹丝不动**——这就是「改了没反应」。换 wrap 后排成两行，两行整体在交叉轴居中，属性当场生效。
5. **陷阱 5**：`justify-content: space-between` 本该把三盒推到两端，但 item-1 的 `margin: auto`
   把剩余空间吃光，**space-between 完全失效**。关掉后立刻恢复。
   （附带现象：`margin: auto` 的上下两边也会让它在交叉轴居中、盖过 `align-items: stretch`，可以在文案里顺带点一句。）

陷阱 2 与 3 都落在 `basis` 上，但演的不是一回事：2 是「同样都 grow，起点不同就分不均」，
3 是「简写换掉的其实是三个属性」，且 3 的现象是溢出、2 的现象是分配不均，视觉上不会撞车。

上表数值是设计意图，**实现时必须在真实浏览器里核对现象确实成立**（见第 10 节）。

## 9. 信息架构改动

`App.vue`：

```
<ThePlayground id="playground" />
<TrapsSection />
```

Hero 是 M7 的事，本次不动。

## 10. 测试策略

### 纯函数（走 TDD，先写失败的测试）

`core/trapPatch.spec.ts`：

- `resolveVariant` 的叠加顺序：default → base → 变体，后者覆盖前者
- `itemCount` 生效时按数量重建 items，不给时沿用
- `diffStates` 能同时输出容器与 item 两类差异，且顺序确定
- **base 与 after 同值时不报假差异**（2.6 的核心约束）

`data/traps.spec.ts`：

- 5 个陷阱的 before / after 都能 resolve 成合法 `FlexState`
- **每个陷阱的 before → after 至少有一条 diff**——防止写出「改了但没改」的陷阱
- 每个陷阱恰好 3 拍

### 组件（happy-dom）

- `TrapStage.spec.ts`：渲染出的盒子数量与 `itemStyle` 正确
- `TrapSection.spec.ts`：`beat` 切换时 `TrapStage` 的 state 跟着变；降级模式下三拍全部渲染、`TrapDiff` 常驻
- 载入按钮确实调到 `loadState`，且传入的是 `resolveVariant` 的结果

### 必须进真实浏览器核对

happy-dom 没有排版引擎，以下几条原理上抓不到（M3 已有三个 bug 是这么暴露的）：

1. 五个陷阱的「现象」是否真被浏览器排出来了——尤其陷阱 1 的 24px 溢出、陷阱 4 在 nowrap 下确实毫无反应
2. pin 的滚动区间对不对，三拍切换有无跳帧
3. 降级条件命中时是否真的完全静止、无 pin
4. 一键复现后 Playground 的状态与陷阱演示区逐字段一致

按项目约定，调用 claude-in-chrome 前先征询用户。

## 11. 未定项

- **陷阱区目录 / 跳过入口**：pin 让页面总高约 15 屏，没有导航会难用。倾向在 `TrapsSection` 顶部加 5 个锚点，
  但不纳入本次实现范围，等真实浏览器里滚一遍之后再决定要不要补。
- **文案的最终措辞**：本文档只定每个陷阱的教学点与状态数值，三拍的具体行文在实现时写。
  （原文此处还有「M6 建 i18n 层时再整体抽取」一句，随 i18n 移出首版一并作废。）

## 12. 实现中踩到的坑

- **视口约 1024~1180px 时整页横向溢出 46px**（iPad 横屏、外接屏窗口化会落在这个区间）。
  根因：`TrapSection.vue` 正常形态的布局是 `grid lg:grid-cols-[1fr_380px]`，左栏 `1fr` 轨道包着
  `TrapStage`；grid 轨道的最小尺寸默认是 `auto`（不得小于内容的最小尺寸），而陷阱二、五的演示区
  用的是 `createDefaultState()` 的默认宽 720px。当可用宽度收窄到轨道该分到的份额小于 720 时，
  `auto` 的最小尺寸把轨道从应有宽度顶回 720，`TrapStage` 内部 `max-w-full overflow-auto` 那层
  的 `max-w-full` 跟着算出 720——即「撑父层的宽度」本身，`overflow-auto` 自然没有可裁的余量，
  溢出直接冒到页面级别。
  这与本站陷阱一演示的规则是同一条：`min-width: auto`（flex 场景）/ grid 轨道的隐式 `min-width: auto`
  会让本该收缩的容器不收缩。修法也一样——给左栏显式写 `min-width: 0`，具体是
  `src/components/traps/TrapSection.vue` 里包着 `<TrapStage>` 的两处 `<div class="panel p-3">`
  （正常形态的 grid 左栏、降级形态里每一拍各自的 `<div class="panel p-3">`）都加了 `min-w-0`。
  **以后如果要重构这块布局，别顺手删掉这两个 `min-w-0`**——它们不是随手加的工具类，是这条布局规则
  的显式对冲，删掉后陷阱二、五这类默认宽较大的状态一旦落在中等视口就会复现这个溢出。
