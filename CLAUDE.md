# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

todo-flex 是 CSS Flexbox 交互演示站，已上线（<https://huberyyang-space.github.io/todo-flex/>），处于长期维护阶段。
它不演示「对齐」，演示「尺寸是怎么算出来的」：画出剩余空间、展开 grow/shrink 的分配公式、
把纯函数推导出的理论值与浏览器实际渲染值并排校验，不一致时指出是哪条规则（`min-width: auto` 等）介入了。
**这道「理论 vs 实际的缝隙」是产品的差异化，所有技术决策都为它服务。**

## 每次必读

- **每次开工** → 读 [`.docs/progress.md`](./.docs/progress.md)：现在的状态与待办。
- **每次提交** → 走 `/commit` skill，不要手写 `git add` + `git commit`。工作分支是 `dev`；推 `main` 会触发 GitHub Pages 部署。

## 按触发条件去读的文档

- **改 `src/core/` 或往数据流里新增一层之前** → [`.docs/architecture.md`](./.docs/architecture.md)
  → 不读的后果：把该留在纯函数里的逻辑写进组件，`src/core/` 零 DOM 依赖一破，TDD 那条路就断了。
- **跑任何浏览器验证之前、或改了下面「没有自动化守卫」的东西之后** → [`.docs/browser-verification.md`](./.docs/browser-verification.md)
  → 不读的后果：把冻帧误判成缺陷（已踩两次）；或改完只跑单测，漏掉只有真实排版才量得出的失效。
- **想推翻下面任何一条禁令之前** → [`.docs/pitfalls.md`](./.docs/pitfalls.md)
  → 不读的后果：重走一条已经走死的路。
- **想压打包体积、或动 shiki / gsap 的引入方式之前** → [`.docs/bundle-optimization.md`](./.docs/bundle-optimization.md)
  → 不读的后果：重走三条量过零收益的路，或把 shiki 切成 5 个 chunk，比现在还大。

## 常用命令

```bash
pnpm dev                      # 开发服务器（自动打开浏览器）
pnpm test                     # 单元测试（vitest run）
pnpm vitest run src/core/distribute.spec.ts   # 跑单个测试文件
pnpm vitest run -t "剩余空间"                  # 按测试名过滤
pnpm lint / pnpm lint:fix     # eslint 检查 / 自动修复
pnpm tscheck                  # 仅类型检查（vue-tsc --noEmit）
pnpm build                    # 类型检查 + 生产构建
```

测试文件与源码同目录，命名 `*.spec.ts`；测试共用的随机状态生成器在 [`src/test/`](./src/test/)。

## 设计红线（不要"顺手"违反）

1. **演示区必须是真实 DOM + 真实 CSS flex 渲染**，禁止用 JS 算盒子位置来模拟布局——站点的可信度和「复制这段 CSS 到项目里」的承诺都建立在这上面。
2. **`src/core/` 下所有模块零 DOM 依赖**，推导引擎连 vue 都不 import；界面文案住在展示层，core 只产出标识与数值。
3. **推导引擎故意不模拟 `min-width: auto` 的下限截断**。这道缝隙留给诊断层去发现并解释，不要当成 bug 补上。
4. **控制面板由 [`flexProperties.ts`](./src/data/flexProperties.ts) 驱动生成**，禁止为每个属性手写一遍控件模板。
5. **观测层禁止 `getBoundingClientRect()`**：GSAP Flip 用 transform 做动画，rect 会返回中间态让数字乱跳。
   尺寸读计算样式（小数），位置读 `offsetLeft/offsetTop`，ResizeObserver 只负责触发重采。
   尺寸不要改回 `offsetWidth`：它取整，差出的 0.5px 会撞上诊断容差造成误报。`useMeasure.spec.ts` 有测试断言它从未被调用。
6. **演示区描边一律用 `outline`，禁止 `border` 与 `padding`**：它们占布局空间，诊断层会把恒定偏差误报成「有规则介入」，导出的 CSS 也就复现不出演示区。
7. **`.stage-item` 禁止 `overflow: hidden`**：自动最小尺寸只在主轴 `overflow: visible` 时生效，一裁切，`min-width: auto` 这个头号陷阱就演示不出来。
8. **item 的内容只用一个 `size` 数字表示**（主轴方向的内容固有尺寸），不支持自定义文本——它驱动 `min-width: auto` 陷阱，也让分享链接免于处理文本转义。
9. **设置区、演示区、CSS 区三处必须一致**：`flex` 简写遇到某些 basis 会整条失效，单项属性只丢 basis，所以 basis 由属性表的 `check` 把关、分享链接走同一道关，
   只收确定合法的写法；新增可输入的值类型前先用 [basisSyntax.probe.html](./src/core/basisSyntax.probe.html) 在真实 Chrome 里重测，[夹具](./src/core/basisSyntax.chrome.json)的守卫钉着「收下即一致」→ [详见](./.docs/pitfalls.md#新增一类可输入的值之前)

## 现役禁令

每条都踩过，论证与实测数字在 [`.docs/pitfalls.md`](./.docs/pitfalls.md)。

### 状态与时序

- **首屏状态在模块加载那一刻读地址栏**，不要挪到 `onMounted`（会先闪一帧默认布局，还会让 Flip 播一遍过渡）。→ [详见](./.docs/pitfalls.md#首屏必须在模块加载那一刻读地址栏)
- **URL 写回一律防抖 + `replaceState`**（不防抖 Safari 超量抛错；`pushState` 让调十次属性要按十次后退）。→ [详见](./.docs/pitfalls.md#写回一律防抖--replacestate)

### 演示区视觉

- **等距实体块的每个面都从同一个体色 `--face` 派生**，选中态只换 `--face`。任何一个面绕开它直接跟 `--accent` 调色，明暗序都会随主题翻车，而且只在亮色下出现。→ [详见](./.docs/pitfalls.md#三个面必须从同一个体色派生)
- **不要写 `--d: calc(var(--d) + 3px)`**：自定义属性自引用无效、整条被丢弃且不报错。要改厚度改倍率 `--d-k`。
- **伸出去的顶面与右侧面只由 `.stage-wrapper` 的 `--overhang` 兜住**，不要给演示区滚动容器加内边距去补——那是第二份留白，只会白缩可视范围。
  `DemoStage.spec.ts` 与 `ThePlayground.spec.ts` 各有守卫。→ [详见](./.docs/pitfalls.md#伸出去的面靠-overhang-兜住不是靠滚动容器的内边距)
- **斜纹的方向感由纹路朝向承担，不靠色块长宽比**（长宽比跟 `flex-direction` 无关，两个方向都会读反）；y 轴 pattern 的 `rotate(90)` 把坐标系一起转了，一套 keyframes 管四份。→ [详见](./.docs/pitfalls.md#斜纹流向元素形状不能承担方向语义)
- **滚动条样式的 `@supports not selector(::-webkit-scrollbar)` 不是多余的**：Chrome 一见到标准属性 `scrollbar-width` 就整个忽略伪元素样式，滚动条退回 2px 细条。→ [详见](./.docs/pitfalls.md#滚动条标准属性要隔离给-firefox)

### 暗亮主题

- **改 [`main.css`](./src/styles/main.css) 的主题变量前先跑 `pnpm vitest run src/styles/theme.spec.ts`**：两套主题的对比度与明暗序都钉在那里，站点默认暗色，亮色下的问题只看默认主题永远发现不了。
- **`--stage-line-k` / `--stage-line-hover-k` / `--stripe-op` 不要合并成单一取值**：它们混的底色一亮一暗，统一取值必有一套不达标。斜纹不透明度写在 CSS 里，不要写回 SVG 属性（属性跟不了 `html.dark`）。
- **方块的接触阴影靠底缘 inset 暗边，不要改回加深台面投影**：暗色台面没有可压的余量。→ 以上详见 [pitfalls.md](./.docs/pitfalls.md#暗亮主题只能算不能看的缺陷)

### i18n

- **站点是纯简体中文单语站**，`src/i18n/` 与 `useI18n.ts` 都不建；不要把 `labelKey` / `messageKey` 这批零消费方的预埋字段加回来，真要重启 i18n 按届时需要重新设计。→ [详见](./.docs/pitfalls.md#i18n-预埋字段为什么被删净)

## 工程约定

- 包管理器固定 **pnpm**。**TypeScript 锁 6.x**：`@typescript-eslint@8` 要求 `typescript < 6.1.0`，升级会让 lint 链失配。已有依赖不要自行升级。
- 路径别名 `~/` → `src/`（`vite.config.ts` 与 `tsconfig.json` 两处都配了）。
- **自动导入**：vue、@vueuse/core 的 API 与 `src/composables/` 的导出由 unplugin-auto-import 注入，组件由 unplugin-vue-components 注入，**不要手写这些 import**。
  `auto-imports.d.ts` / `components.d.ts` 是生成物，不要手改，跟着引入它们的提交一起提交。
- **UnoCSS 主题色走 CSS 变量**：`bg/fg/panel/bd/accent/accent2` 映射到 `main.css` 的变量，切主题无需重写工具类。快捷类 `panel` / `btn` / `icon-btn` / `panel-title` 已定义。
- 代码风格由 `@antfu/eslint-config` 决定，格式问题一律 `pnpm lint:fix`。测试标题不要以 `Σ` 开头：`prefer-lowercase-title` 的自动修复会把它改成 `σ`。
- husky：`commit-msg` 跑 commitlint，`pre-commit` 跑 lint-staged（命令是 `eslint --fix`，不加 `.`，否则会对整个仓库跑）。

## 协作约定

- **代码注释、提交信息、对话回复一律用简体中文**（代码标识符除外）。
- **改核心逻辑走 TDD**：`src/core/` 下先写失败的测试，再写实现。
- **完成前给证据**：跑 `pnpm test` + `pnpm lint` + `pnpm build`，把结果贴出来。涉及 UI 效果时先问用户是否需要浏览器验证。
- **叙述性内容写进 `.docs/`，不写进 CLAUDE.md**：这里只放现在要 / 不要做什么，以及理由。新的 spec 与计划写到 `.docs/superpowers/{specs,plans}/`，功能落地后删掉，结论迁进 architecture / pitfalls，过程留给 git 历史。
- **`.docs/` 与 CLAUDE.md 里指向文件的文本写成 markdown 链接**，不要用反引号裸路径。
- 非简单任务（3 步以上或涉及架构决策）先进 Plan Mode；创造性工作先走 superpowers:brainstorming。
