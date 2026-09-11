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
**M4（动效）进行中**：GSAP Flip 布局过渡、惯性水滴形变、观测层挂起机制、演示区质感升级已落地。
**M6 的 URL 分享已提前落地并经浏览器验证**（i18n 与主题打磨还没动）：`core/urlCodec.ts` 纯函数编解码、
`composables/useShareUrl.ts` 防抖 300ms 写回地址栏、`useFlexState` 首屏用 `decodeOrDefault(location.search)` 初始化。
浏览器实测四条：带短码的链接直接打开能逐字段还原、改属性后地址栏跟着变、
三次属性变化 `history.length` 纹丝不动（一律 `replaceState`）、A 标签页调出的链接在 B 标签页还原后位置数值精确一致。
两条不要踩反的实现约束：**首屏必须在模块加载那一刻读地址栏**（晚到 `onMounted` 会先闪一帧默认布局，
还会让 GSAP Flip 把这一帧当成真实布局变化播一遍过渡）；**写回一律防抖 + `replaceState`**
（拖手柄时宽高每帧都变，不防抖就是每帧一次 `replaceState`，Safari 超量直接抛错；用 `pushState` 则调十次属性要按十次后退键才出得去）。
**演示区的 3D 方案已试过并放弃**——立体面的投影高度是「厚度 × sin(倾角)」，小倾角下根本读不出体积感，
大倾角又会压缩 column 方向的主轴；相关代码已删，决策记录见
`docs/superpowers/specs/2026-09-09-stage-3d-motion-design.md`（已标作废）。
**演示区方块的视觉已定案并已落地：等距实体块**（样本册第 26 号），实现方案见
`docs/superpowers/plans/2026-09-09-isometric-solid-block.md`——**再动这块视觉前先读那份文档开头的
「三轮试错的结论」**，里面记着三条已经走死的路，重蹈任何一条都会白做一遍。
三十二个候选方案的对比页：https://claude.ai/code/artifact/c94e5026-c873-4035-a93d-d00a8c3f64a1

等距实体块的实现要点：顶面与右侧面是 `.stage-box` 的两个伪元素画的二维平行四边形（`skewX` / `skewY`），
厚度 `--d` 由 `DemoStage` 按 `min(rowGap, columnGap) - 2` 算出来下发，悬停/按下用倍率 `--d-k` 缩放，
**不要写成 `--d: calc(var(--d) + 3px)`**——自引用无效。
**三个面必须从同一个体色 `--face` 派生（顶面加白、右侧面加黑），不要各自去跟 `--accent` 调色**：
后者的明暗序会随主题翻车，亮色主题下 `--panel` 接近白，会把正面拉得比顶面还亮（实测正面 0.79 > 顶面 0.67），
左上光源就读不出来了。这个缺陷只在亮色主题下出现，只看暗色发现不了。

**斜纹流向的原方案已被浏览器实测推翻并重做**。曾经只做两份 45° 斜纹，
理由是 45° 斜纹只能表达垂直于自身的运动分量（理发店转灯错觉），「向右流」与「向下流」在 pattern 内部
本来就是同一个平移，方向感便交给色块自身的长宽比去暗示：row 下宽扁读作横向流，column 下高瘦读作纵向流。
**这个前提在两个方向上都不成立**——色块长宽比取决于「剩余空间量 vs 交叉轴尺寸」，跟 `flex-direction` 不相干：
column 默认三个盒子时色块是 720×56 的宽扁横条（会读成横向流，实际沿垂直轴），
row 加到六个盒子时色块被压成 180×320 的高瘦竖条（会读成纵向流，实际沿水平轴）。两种情况方向都读反。

现在改成「流动轴 × 流向」四份 pattern，纹路朝向由 `OverlayBand.flowAxis`（`'x' | 'y'`，与 `flow` 同进同出）决定：
x 轴是垂直纹路做左右平移，y 轴靠 `patternTransform="rotate(90)"` 转成水平纹路。
**旋转把 pattern 自身的坐标系一起转了**，所以同一条 `translateX(8px)` 在 y 轴 pattern 里就是屏幕上的向下，
一套 keyframes 管四份，不要为四个方向各写一遍位移。

> **通用教训：不要让「元素形状」去承担方向语义。** 形状是布局算出来的，随内容和属性随时翻转；
> 方向感要交给纹路朝向这类自身就带方向的属性，或者箭头这类显式符号。
> 这条假设当初在单元测试里全绿、在代码注释里论证得很完整，只有真实窗口能证伪它。

已实测通过：`flex-start` 时行尾色块挂 `band-free--x-reverse`，切 `flex-end` 后色块移到行首并翻成 `x-forward`；
column 下相应翻成 `y-reverse` / `y-forward`；四份 pattern 都在 defs 里，两个 y 的带 `rotate(90)`，四条动画均在跑。
`@media (prefers-reduced-motion: reduce)` 的规则也确认进了 CSSOM（解析结果 `animation-name: none`）。

**仍待在真实窗口里人眼核对**（这四条自动化量不出来）：

1. 换成垂直 / 水平硬边条纹后，2.4s 周期会不会抢戏——硬边比 45° 斜纹更跳，这条比改之前更需要核对。
2. 系统打开「减少动态效果」后是否真的完全静止（CSSOM 规则已确认，运行时未验）。
3. 等距实体块三项：wrap 换行时跨行的面是否互压、悬停时厚度加大与接触阴影拉开的手感、重排后面有无残留。
4. `align-items: stretch` 时盒子顶边与容器上沿齐平，10px 的顶面会画到容器外面
   （容器不能加 padding，红线 6），观感是否可接受未定。
5. 顺带排除一个存疑观察：column 下三个盒子的宽度曾读到 632/542/422 递减（stretch 下本该都是 720），
   且连续 8 秒三次快照完全一致。`.stage-item` 的 width/height transition 只有 0.28s、不可能持续 8 秒，
   所以几乎可以断定是窗口转入后台导致的 transition 冻帧（紧接着扩展就断开了，时间点吻合），
   与斜纹改动无关。**别把它当成新缺陷重查一遍**，在真实窗口里扫一眼就能排除。

**浏览器验证的环境坑**（每一条都实际踩过，不要再踩）：

- 本机那个 Chrome 窗口反复掉回不可见状态（`visibilityState: hidden`）。一不可见就有三重后果：
  ① requestAnimationFrame 停发，GSAP 时间线与 CSS transition 冻在第一帧——已经因此两次把冻结状态误判成缺陷；
  ② 页面**完全不重绘**，`captureVisibleTab` 返回的是上一帧，改完 DOM 再截图拿到的是旧画面；
  ③ 在这种页面里 `await` 一个 rAF 循环会永不 resolve，直接把 CDP `Runtime.evaluate` 拖到超时。
  所以：**先同步读一次 `document.visibilityState`**（别用 rAF 计数，它自己就会挂），
  静态样式改用 `getComputedStyle` 量而不是靠截图，动效一律让用户自己看。
- 量静态尺寸前要先注入 `transition: none !important`，否则读到的是冻住的过渡中间值
  （实测 `--d` 已经是 3px，伪元素的 `width` 还停在 10px）。
- GSAP Flip 会在 `.stage-item` 上写 `width/height/max-*/min-*/transform` 一整套内联样式，冻结时全留在中间帧。
  想量真实布局得把这些内联属性一并清掉，只清 `transform` 不够。
- **`localhost:5175` 未必是本项目**：本机另一个项目占着 `[::1]:5175`（IPv6），浏览器解析 localhost 会走到它那儿去。
  用 `http://127.0.0.1:<port>` 访问，并且认一下页面标题是不是 `todo-flex`。
- **本机有 HTTP 代理，`curl http://127.0.0.1:<port>` 会被代理拦成 502**，看着就像 dev server 没起来。
  探活一律加 `--noproxy '*'`，别据此重启服务瞎折腾。
- dev server 头一次用后台任务起有可能立刻被 SIGTERM（exit 143）带走，**内存充足时直接重启一次即可**，
  不必先去查 OOM。查过一次：`memory_pressure` 报 42% 空闲，与内存无关。
- 页面里 `await` 长 `setTimeout` 跨过一次 `location.reload()`，`Runtime.evaluate` 会直接报
  「Inspected target navigated or closed」。要刷新就把刷新和读数拆成两次调用；
  改了源码其实靠 Vite HMR 就够，多数时候不需要 reload。

**浏览器验证不可省。** M3 有三个 bug 是单元测试原理上抓不到的（happy-dom 没有排版引擎），
全靠真实浏览器暴露：装饰性 border 参与布局导致全量误报、`overflow: hidden` 让 `min-width: auto` 完全失效、
拖拽手柄在 `pointerdown` 里 `preventDefault()` 连带抑制了焦点转移（点完手柄按方向键改的是别处，
而 Tab 聚焦与单元测试两条路径都照常通过）。
凡是涉及演示区布局的改动，跑完 test/lint/build 之后仍需在浏览器里核对明细表的数字。

> 注意：`docs/superpowers/plans/` 里的计划文档 checkbox 全是未勾选状态，但代码与 git 历史证明 M1+M2 已实现完毕。
> 判断进度以 git 历史和实际代码为准，不要被 checkbox 误导。

**M5（内容层）已完成并经浏览器实测**：`data/traps.ts` 五个陷阱 + `core/trapPatch.ts`（patch 合并 / 差异提取纯函数）
+ `composables/useTrapScroll.ts`（ScrollTrigger pin + 滚动进度映射成离散拍号）+ `components/traps/*`
（TrapsSection / TrapSection / TrapStage / TrapDiff）+ `useFlexState.loadState` 一键复现。

**实测通过的（数字都是真实浏览器量出来的，不是推的）**：五个陷阱的现象全部成立——
陷阱一 A 被 min-content 撑在 320（推导值 296）、三盒溢出 24px；陷阱二 312/192/192 分得不均、切 basis:0 后均分 232；
陷阱三 `flex:none` 三盒各 200 溢出 144 且拒不收缩、`flex:1` 后各 152 正好填满；陷阱四 nowrap 下 align-content 纹丝不动、
换 wrap 后分两行；陷阱五 A.offsetLeft=228、B=548、C=640 顶在右缘（与 2026-09-08 文档那条 offsetLeft 实测记录吻合）。
一键复现后明细表如实报出「A 理论 296px 实际 320px ⚠ min-width:auto 撑住了内容固有尺寸」——**陷阱→复现→诊断的闭环是通的**。
三拍：pin 生效、滚动 3 屏、beat 0→1→2，**第 2 拍演示区不动**；滞回四个边界（0.345 不换 / 0.39 换 / 0.32 不退 / 0.28 退）全对，
回滚能反复对比修复前后。

**M5 踩到并已修掉的坑**（别再犯）：

- **陷阱板块左栏必须写 `min-w-0`**。grid 轨道 `1fr` 的最小尺寸默认是 `auto`（不得小于内容），
  720px 的演示区会把轨道顶开、连带撑破页面（实测 vw=1120 时横向溢出 46px），
  `TrapStage` 里的 `overflow-auto` 就永远没东西可裁。**站点自己踩了陷阱一在教的那条规则。**
- **`useTrapScroll` 的 `degraded` 必须在模块/setup 那一刻就 `ref(shouldDegrade())` 算出来**，不能先 `ref(true)` 再到
  `onMounted` 里补判——后者会让首帧渲染降级形态（5 板块 × 3 演示区 = 15 个白挂载），
  而 `ScrollTrigger.create({pin:true})` 在同一个 onMounted 里同步执行，会照着降级形态的 DOM 高度建 pin-spacer。
  这与「首屏必须在模块加载那一刻读地址栏」是同一形状的坑。`shouldDegrade()` 自带 `typeof window === 'undefined'` 兜底，SSR 语义不受影响。
- **归因表要折叠重复行**。`diffStates` 逐条输出是对的契约，但三个盒子改同一个属性会渲染成三行一模一样的文案，
  陷阱三会出现 9 行、把「一个简写背后是三个属性」这句教学话稀释掉。折叠放展示层（`TrapDiff`），不要动纯函数。
- **陷阱文案里的推导数字必须有测试钉在 `deriveLayout` 上**。296/312/192/232/152/456/228 这些数字全是硬编码在中文正文里的，
  跟推导引擎零耦合；只做 `Σsize + Σgap` 的算术近似守卫是碰不到 `finalMainSize` 的，改个 base 数值测试照样绿、文案当场变谎话。

**M5 未能验证的两项**（本机 `resize_window` 不可控，三次请求 1100/720/500 分别得到 1280/1120/1920，压不到 768 以下）：
窄屏（<768px）降级、`prefers-reduced-motion` 降级。两者的判断逻辑有 `useTrapScroll.spec.ts` 覆盖、
降级形态的渲染有 `TrapSection.spec.ts` 覆盖，但**真实环境是空白，需要人眼拖窄窗口扫一遍**。

**下一件是 M6 的剩余部分**（URL 分享已提前落地）：i18n 与暗亮主题打磨。M6 动手时顺带清掉这几笔已知技术债：
① 状态→CSS 的映射逻辑现在有三份（`TrapStage` / `DemoStage` / `cssEmit`），前两份是逐字复制，
   该提到 `src/core/` 去——但那要连带改经过三轮浏览器试错的 `DemoStage`，所以单独排一次并重新过浏览器；
② `TrapSection` 正常/降级两套模板里卡片渲染重复约 18 行 ×2，抽成子组件的时机正好与文案抽 i18n key 撞在一起，一次动完。

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
