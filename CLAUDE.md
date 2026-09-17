# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

todo-flex 是一个 CSS Flexbox 交互演示站。**它不是又一个 flex playground**——市面上的工具全在演示「对齐」，
todo-flex 演示的是「尺寸是怎么算出来的」：把剩余空间画出来、把 grow/shrink 的分配公式展开、
把纯函数推导出的理论值与浏览器实际渲染值并排校验，不一致时指出是哪条规则（`min-width: auto` 等）介入了。

这个「理论 vs 实际的缝隙」是产品的核心差异化，所有技术决策都为它服务。

## 每次必读

- **每次开工** → 读 [`.docs/progress.md`](./.docs/progress.md)，接上「做到哪了、下一件是什么」。
- **每次提交** → 走 `/commit` skill，不要手写 `git add` + `git commit` 绕过它。当前工作分支是 `dev`。

## 按触发条件去读的文档

- **跑任何浏览器验证之前** → 读 [`.docs/browser-verification.md`](./.docs/browser-verification.md)
  → 不读的后果：把 `visibilityState: hidden` 导致的冻帧误判成缺陷（已踩两次），
  或据着被代理拦成 502 的探活结果去重启 dev server 瞎折腾。
- **改 `src/core/` 或往数据流里新增一层之前** → 读 [`.docs/architecture.md`](./.docs/architecture.md)
  → 不读的后果：把该留在纯函数里的逻辑写进组件，`src/core/` 零 DOM 依赖的前提一破，TDD 那条路就断了。
- **想推翻下面任何一条禁令之前** → 读 [`.docs/pitfalls.md`](./.docs/pitfalls.md)
  → 不读的后果：重蹈一条已经走死的路，白做一遍。
- **改某个里程碑的既有实现之前** → 读 [`.docs/superpowers/`](./.docs/superpowers/) 下对应的 spec 与 plan
  （索引在 [`.docs/progress.md`](./.docs/progress.md#设计与计划文档)）
  → 不读的后果：推翻一个当初有理由的取舍而不自知。

## 常用命令

```bash
pnpm dev                      # 开发服务器（自动打开浏览器）
pnpm test                     # 单元测试（vitest run）
pnpm test:watch               # 监听模式
pnpm vitest run src/core/distribute.spec.ts   # 跑单个测试文件
pnpm vitest run -t "剩余空间"                  # 按测试名过滤
pnpm lint                     # eslint 检查
pnpm lint:fix                 # 自动修复（antfu 风格问题优先用它）
pnpm tscheck                  # 仅类型检查（vue-tsc --noEmit）
pnpm build                    # 类型检查 + 生产构建
```

测试文件与源码同目录，命名 `*.spec.ts`（vitest 的 include 是 `src/**/*.{test,spec}.ts`）。

## 设计红线（不要"顺手"违反）

1. **演示区必须是真实 DOM + 真实 CSS flex 渲染**。禁止用 JS 计算盒子位置来模拟布局——
   站点的可信度和「复制这段 CSS 到项目里」的承诺都建立在这上面。
2. **`src/core/` 下所有模块零 DOM 依赖**，推导引擎连 vue 都不 import。
3. **推导引擎故意不模拟 `min-width: auto` 的下限截断**。这个缝隙是留给诊断层去发现并解释的，
   是产品的差异化所在，不要当成 bug 补上。
4. **控制面板必须由 `data/flexProperties.ts` 驱动生成**，禁止为每个属性手写一遍 select/radio 模板。
5. **观测层禁止使用 `getBoundingClientRect()`**。GSAP Flip 用 transform 做动画，
   rect 会返回动画中间态导致明细表数字乱跳；尺寸用 `ResizeObserver`，位置用 `offsetLeft/offsetTop`，两者都不受 transform 影响。
   `useMeasure.spec.ts` 里有一条测试直接 spy 这个方法并断言从未被调用。
6. **演示区的描边一律用 `outline`，禁止 `border` 与 `padding`**。border 占布局空间：容器少 2px 可用宽度、
   每个盒子实际尺寸比推导值多 2px，诊断层会把这个恒定偏差误报成「有规则介入」。而 `emitCss` 输出的 CSS 里没有 border，
   演示区一旦引入导出 CSS 之外的布局影响，「复制这段 CSS 即可复现」就不成立了。
7. **`.stage-item` 禁止 `overflow: hidden`**。CSS 规范规定自动最小尺寸只在主轴 `overflow` 为 `visible` 时生效，
   一旦裁剪，`min-width: auto` 立刻失效，本站的头号陷阱就演示不出来。盒子被压得比内容还窄时，内容溢出正是要给用户看的现象。
8. **item 的内容只用一个 `size` 数字表示**（主轴方向上的内容固有尺寸），不支持自定义文本——
   它要驱动 `min-width: auto` 陷阱，也让后续 URL 序列化免于处理文本转义。

## 现役禁令

每条都踩过。完整论证与实测数字在 [`.docs/pitfalls.md`](./.docs/pitfalls.md)。

### 状态与时序

- **首屏状态必须在模块加载那一刻读地址栏**，不要挪到 `onMounted`
  （晚到会先闪一帧默认布局，还会让 GSAP Flip 把这一帧当成真实布局变化播一遍过渡）。
  → [详见](./.docs/pitfalls.md#首屏必须在模块加载那一刻读地址栏)
- **URL 写回一律防抖 + `replaceState`**
  （拖手柄时每帧都变，不防抖 Safari 超量抛错；用 `pushState` 则调十次属性要按十次后退键才出得去）。
  → [详见](./.docs/pitfalls.md#写回一律防抖--replacestate)
- **`useTrapScroll` 的 `degraded` 必须在模块 / setup 那一刻就 `ref(shouldDegrade())` 算出来**，
  不要先 `ref(true)` 再到 `onMounted` 里补判（首帧会渲染降级形态，同一个 onMounted 里同步执行的
  `ScrollTrigger.create({ pin: true })` 会照着降级形态的 DOM 高度建 pin-spacer）。
  → [详见](./.docs/pitfalls.md#2-usetrapscroll-的-degraded-必须在模块--setup-那一刻就算出来)

### 演示区视觉

- **等距实体块的每一个面都必须从同一个体色 `--face` 派生**——顶面加白、右侧面加黑、
  正面走 `white 8%` → `black 6%` 的渐变、选中态只换 `--face` 不重写 `background`。
  任何一个面绕开 `--face` 去直接跟 `--accent` 调色，明暗序都会随主题翻车
  （面各自调色：亮色下正面 0.79 > 顶面 0.67；正面渐变自己调色：翻成上暗下亮 0.591 → 0.697，
  读作光从下方来。**两次都只在亮色主题下出现，只看暗色发现不了**）。
  → [详见](./.docs/pitfalls.md#三个面必须从同一个体色派生)
- **不要写 `--d: calc(var(--d) + 3px)`**——CSS 自定义属性自引用无效，整条声明被丢弃且不报错。
  要改厚度改倍率 `--d-k`。
  → [详见](./.docs/pitfalls.md#--d-不能自引用)
- **斜纹的方向感必须由纹路朝向承担，不要靠色块长宽比**——长宽比取决于「剩余空间量 vs 交叉轴尺寸」，
  跟 `flex-direction` 不相干，两个方向上都会读反。**通用教训：不要让「元素形状」去承担方向语义。**
  → [详见](./.docs/pitfalls.md#斜纹流向元素形状不能承担方向语义)
- **y 轴 pattern 的 `rotate(90)` 把坐标系一起转了**，一套 keyframes 管四份 pattern，
  不要为四个方向各写一遍位移。
  → [详见](./.docs/pitfalls.md#现方案)

### 暗亮主题

- **改 `src/styles/main.css` 的主题变量前，先跑 `pnpm vitest run src/styles/theme.spec.ts`**——
  23 条守卫钉住两套主题的对比度与明暗序。M6 修的六条缺陷没有一条是「看」出来的，
  而站点默认暗色，亮色下才出现的问题只看默认主题永远发现不了。
- **`--stage-line-k` / `--stage-line-hover-k` / `--stripe-op` 不是冗余，不要合并成单一取值**——
  它们混的底色一亮一暗，统一取值必然有一套不达标（描边亮色要 100%、暗色 55% 就够且上满会刺眼；
  斜纹亮色要 0.65、暗色 0.35 再高就抢戏）。
- **斜纹不透明度必须写在 CSS 里，不要写回 `<line>` 的 `stroke-opacity` 属性**——
  SVG 属性没法跟着 `html.dark` 走。
- **方块的接触阴影靠底缘 inset 暗边，不要改回加深台面投影**——暗色台面亮度只有 0.015，
  没有可压的余量（对比度 1.12，提亮台面上限也才 1.42）。台面那五层投影负责环境光衰减，一层不动。
  → 以上四条详见 [`.docs/pitfalls.md`](./.docs/pitfalls.md#暗亮主题六条只能算不能看的缺陷)

### 陷阱板块

- **陷阱板块左栏必须写 `min-w-0`**（grid 轨道 `1fr` 的最小尺寸默认是 `auto`，720px 的演示区会顶开轨道、
  撑破页面，实测 vw=1120 时横向溢出 46px。**站点自己会踩它在教的那条规则**）。
  → [详见](./.docs/pitfalls.md#1-陷阱板块左栏必须写-min-w-0)
- **归因表的重复行折叠放展示层（`TrapDiff`），不要动 `diffStates` 纯函数**——逐条输出是对的契约。
  → [详见](./.docs/pitfalls.md#3-归因表要折叠重复行但折叠放展示层)
- **陷阱文案里的推导数字必须有测试钉在 `deriveLayout` 上**——只做 `Σsize + Σgap` 的算术近似守卫
  碰不到 `finalMainSize`，改个 base 数值测试照样绿、文案当场变谎话。
  → [详见](./.docs/pitfalls.md#4-陷阱文案里的推导数字必须有测试钉在-derivelayout-上)

### i18n

- **首版是纯简体中文单语站**，`src/i18n/` 与 `useI18n.ts` 都不建，中文硬编码就是终态。
- **不要把 `labelKey` / `messageKey` 这批预埋字段加回来**——它们零消费方、恒等于 `'derive.' + kind`
  这类纯冗余，且从未被任何界面验证过。将来若重启 i18n，按届时的实际需要重新设计 key 结构，不要考古这批字段名。
  → [详见](./.docs/pitfalls.md#i18n-预埋字段为什么被删净)

## 工程约定

- 包管理器固定 **pnpm**。
- **TypeScript 锁定 6.x，不得升级到 7.x**：`@typescript-eslint@8` 要求 `typescript < 6.1.0`，升级会让整条 lint 链失配。
  已有依赖同理不要自行升级。
- 路径别名 `~/` → `src/`（`vite.config.ts` 与 `tsconfig.json` 两处都配了）。
- **自动导入**：vue、@vueuse/core 的 API 与 `src/composables/` 下的导出都由 unplugin-auto-import 注入，
  组件由 unplugin-vue-components 注入，模板里可直接用，**不要手写这些 import**。
  `auto-imports.d.ts` / `components.d.ts` 是生成物，不要手改。
- **UnoCSS 主题色走 CSS 变量**：`uno.config.ts` 里 `bg/fg/panel/bd/accent/accent2` 映射到
  `src/styles/main.css` 的变量，暗亮主题切换（`html.dark`）无需重写工具类。快捷类 `panel` / `btn` 已定义。
- 代码风格由 `@antfu/eslint-config` 决定，格式问题一律交给 `pnpm lint:fix`，不要手动排版。
- lint-staged 的命令不加 `.`（现为 `eslint --fix`），否则会对整个仓库跑 lint。
- husky：`commit-msg` 跑 commitlint（Conventional Commits），`pre-commit` 跑 lint-staged。

## 协作约定

- **代码注释、提交信息、对话回复一律用简体中文**（代码标识符除外）。
- **改核心逻辑走 TDD**：`src/core/` 下每个模块先写失败的测试，再写实现。
- **完成前必须给证据**：跑 `pnpm test` + `pnpm lint` + `pnpm build`，把结果贴出来，不要只说"已完成"。
  涉及 UI 效果时先问用户是否需要浏览器验证，不要自行调用 claude-in-chrome。
- **叙述性文档一律写进 `.docs/`，不要写进 CLAUDE.md**。CLAUDE.md 每轮常驻，只放约束性内容
  （现役禁令、跨文件的隐式契约、踩过的坑及其理由）；进度、实测记录、方案讨论、审计报告都外放。
  判据是时态——写不成「现在要 / 不要做什么」的句子，就该外放。
- **spec 与 plan 写到 `.docs/superpowers/{specs,plans}/`**，这覆盖 superpowers 技能 `docs/superpowers/` 的默认值
  → 照默认值写会让文档目录当场分叉成两处。
- **`.docs/` 与 CLAUDE.md 里指向文件的文本必须写成 markdown 链接**，能直接跳转，不要用反引号裸路径。
- 非简单任务（3 步以上或涉及架构决策）先进 Plan Mode；创造性工作先走 superpowers:brainstorming。
