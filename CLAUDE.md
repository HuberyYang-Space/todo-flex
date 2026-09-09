# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

todo-flex 是一个 CSS Flexbox 交互演示站。**它不是又一个 flex playground**——市面上的工具全在演示「对齐」，
todo-flex 演示的是「尺寸是怎么算出来的」：把剩余空间画出来、把 grow/shrink 的分配公式展开、
把纯函数推导出的理论值与浏览器实际渲染值并排校验，不一致时指出是哪条规则（`min-width: auto` 等）介入了。

这个「理论 vs 实际的缝隙」是产品的核心差异化，所有技术决策都为它服务。

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

## 当前进度

M1（推导引擎）、M2（可用的 Playground）、M3（透明化核心）已完成。
M3 全部经浏览器实测：观测层 `useMeasure`、诊断层 `core/diagnostics.ts`、理论 vs 实际明细表、
SVG 叠加层 `OverlayLayer`（剩余空间斜纹色块、溢出标记、轴向箭头、尺寸 HUD）、
演示区右下角 resize 拖拽手柄 `StageResizer`（已替代原来的两个 range 滑块）。
**下一步是 M4（动效）**：GSAP Flip 布局过渡、叠加层动画（含设计文档 §7 说的「剩余空间流动斜纹」，
当前是静态斜纹）、`prefers-reduced-motion` 降级。接入 Flip 时注意红线 5：观测层已经绕开
`getBoundingClientRect()`，改动观测层前先读那条。

**浏览器验证不可省。** M3 有三个 bug 是单元测试原理上抓不到的（happy-dom 没有排版引擎），
全靠真实浏览器暴露：装饰性 border 参与布局导致全量误报、`overflow: hidden` 让 `min-width: auto` 完全失效、
拖拽手柄在 `pointerdown` 里 `preventDefault()` 连带抑制了焦点转移（点完手柄按方向键改的是别处，
而 Tab 聚焦与单元测试两条路径都照常通过）。
凡是涉及演示区布局的改动，跑完 test/lint/build 之后仍需在浏览器里核对明细表的数字。

> 注意：`docs/superpowers/plans/` 里的计划文档 checkbox 全是未勾选状态，但代码与 git 历史证明 M1+M2 已实现完毕。
> 判断进度以 git 历史和实际代码为准，不要被 checkbox 误导。

设计与计划文档（改动前务必先读）：

- `docs/superpowers/specs/2026-09-08-todo-flex-design.md` —— 定稿的设计文档，含状态模型、模块划分、
  诊断层优先级、URL 短码格式、陷阱清单、里程碑表
- `docs/superpowers/plans/2026-09-08-core-engine-and-playground.md` —— M1+M2 的逐 task 实现计划

## 架构

核心原则：**推导逻辑与 DOM 彻底隔离**，纯函数部分才能走 TDD。

```
state ──→ 渲染 ──→ 观测 ──→ 诊断 ──→ 展示
  └────→ 推导 ──────────────↗
```

| 层 | 位置 | 说明 |
| --- | --- | --- |
| 纯逻辑 | `src/core/` | 零 DOM、零 vue 依赖。推导引擎按步骤拆分：`resolveBasis` → `splitLines` → `distribute`，由 `deriveLayout` 组装并同时输出 `DerivationStep[]`（给 UI 展示公式用）。`cssEmit` 生成可复制 CSS，`axis` 负责 direction → 主轴/交叉轴换算 |
| 元信息 | `src/data/flexProperties.ts` | 属性元信息表（`PropertyDef` 四种 kind：enum/number/boolean/text），控制面板遍历它生成控件 |
| 状态源 | `src/composables/useFlexState.ts` | **模块级单例** `reactive(createDefaultState())`——全站唯一状态源，组件各自 `useFlexState()` 拿到的是同一份。`derived` / `css` 是从它派生的 computed |
| 视图 | `src/components/playground/` | 只负责渲染与事件。`DemoStage` 是真实 flex 容器，`PropertyField` 是表驱动的通用控件 |

关键类型全部在 `src/core/types.ts`：`FlexState`（可序列化，无 DOM 引用）与 `DerivedLayout` / `DerivedLine` / `DerivedItem` / `DerivationStep`。

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
- **提交走 `/commit` skill**，不要手写 `git add` + `git commit` 绕过它。当前工作分支是 `dev`。
- 非简单任务（3 步以上或涉及架构决策）先进 Plan Mode；创造性工作先走 superpowers:brainstorming。
