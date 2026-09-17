# 进度与待办

> 什么时候读：每次开工。它回答「现在做到哪了、下一件是什么、哪些结论已经被真实浏览器验证过」。
> 这里只有叙述，没有禁令——禁令在 [CLAUDE.md](../CLAUDE.md)，禁令背后的论证在 [pitfalls.md](./pitfalls.md)。

## 里程碑状态

| 里程碑 | 状态 | 说明 |
| --- | --- | --- |
| M1 推导引擎 | ✅ 完成 | `resolveBasis` → `splitLines` → `distribute`，由 `deriveLayout` 组装 |
| M2 可用的 Playground | ✅ 完成 | 表驱动控制面板 + 真实 flex 演示区 |
| M3 透明化核心 | ✅ 完成，经浏览器实测 | 观测 / 诊断 / 明细表 / 叠加层 / resize 手柄 |
| M4 动效 | 🚧 进行中 | GSAP Flip、惯性水滴形变、观测层挂起、演示区质感升级已落地 |
| M5 内容层 | ✅ 完成，经浏览器实测 | 五个陷阱 + 滚动叙事 |
| M6 打磨 | ✅ URL 分享 + 暗亮主题打磨均已完成；i18n 已移出 | 判据由 `theme.spec.ts` 钉住 |

> ⚠️ `.docs/superpowers/plans/` 里的计划文档 checkbox 全是未勾选状态，但代码与 git 历史证明这些里程碑已实现完毕。
> **判断进度以 git 历史和实际代码为准，不要被 checkbox 误导。**

## M3：透明化核心

全部经浏览器实测。落地的东西：

- 观测层 `composables/useMeasure.ts`
- 诊断层 `core/diagnostics.ts`
- 理论 vs 实际明细表
- SVG 叠加层 `components/playground/OverlayLayer.vue`（剩余空间斜纹色块、溢出标记、轴向箭头、尺寸 HUD）
- 演示区右下角 resize 拖拽手柄 `StageResizer`（已替代原来的两个 range 滑块）

M3 暴露的三个「单元测试原理上抓不到」的 bug，见
[browser-verification.md](./browser-verification.md#一浏览器验证不可省)。

## M4：动效

已落地：GSAP Flip 布局过渡、惯性水滴形变、观测层挂起机制、演示区质感升级。

**演示区的 3D 方案已试过并放弃**，原因见 [pitfalls.md](./pitfalls.md#演示区的-3d-方案已试过并放弃)。
**演示区方块的视觉已定案为等距实体块**，动它之前先读 [pitfalls.md](./pitfalls.md#等距实体块)。

## M6 的 URL 分享（已提前落地并经浏览器验证）

落地的东西：`core/urlCodec.ts` 纯函数编解码、`composables/useShareUrl.ts` 防抖 300ms 写回地址栏、
`useFlexState` 首屏用 `decodeOrDefault(location.search)` 初始化。

浏览器实测四条：

1. 带短码的链接直接打开，能逐字段还原
2. 改属性后地址栏跟着变
3. 三次属性变化 `history.length` 纹丝不动（一律 `replaceState`）
4. A 标签页调出的链接在 B 标签页还原后，位置数值精确一致

两条不要踩反的时序约束，见 [pitfalls.md](./pitfalls.md#url-分享的两条时序约束)。

## 斜纹流向的重做（已实测通过）

原方案被浏览器实测推翻并重做，完整论证见
[pitfalls.md](./pitfalls.md#斜纹流向元素形状不能承担方向语义)。

实测通过的：

- `flex-start` 时行尾色块挂 `band-free--x-reverse`，切 `flex-end` 后色块移到行首并翻成 `x-forward`
- column 下相应翻成 `y-reverse` / `y-forward`
- 四份 pattern 都在 defs 里，两个 y 的带 `rotate(90)`，四条动画均在跑
- `@media (prefers-reduced-motion: reduce)` 的规则确认进了 CSSOM（解析结果 `animation-name: none`）

## M5：内容层（已完成并经浏览器实测）

落地的东西：`data/traps.ts` 五个陷阱 + `core/trapPatch.ts`（patch 合并 / 差异提取纯函数）
+ `composables/useTrapScroll.ts`（ScrollTrigger pin + 滚动进度映射成离散拍号）
+ `components/traps/*`（TrapsSection / TrapSection / TrapStage / TrapDiff / TrapBeatCard）
+ `useFlexState.loadState` 一键复现。

### 实测通过的（数字都是真实浏览器量出来的，不是推的）

五个陷阱的现象全部成立：

| 陷阱 | 实测现象 |
| --- | --- |
| 一 `min-width: auto` | A 被 min-content 撑在 320（推导值 296）、三盒溢出 24px |
| 二 `flex-basis` | 312 / 192 / 192 分得不均；切 `basis: 0` 后均分 232 |
| 三 `flex: none` | 三盒各 200 溢出 144 且拒不收缩；`flex: 1` 后各 152 正好填满 |
| 四 `align-content` | nowrap 下纹丝不动；换 wrap 后分两行 |
| 五 `margin: auto` | A.offsetLeft=228、B=548、C=640 顶在右缘（与 2026-09-08 文档那条 offsetLeft 实测记录吻合）|

一键复现后明细表如实报出「A 理论 296px 实际 320px ⚠ `min-width:auto` 撑住了内容固有尺寸」——
**陷阱 → 复现 → 诊断的闭环是通的**。

滚动叙事三拍：pin 生效、滚动 3 屏、beat 0→1→2，**第 2 拍演示区不动**；
滞回四个边界（0.345 不换 / 0.39 换 / 0.32 不退 / 0.28 退）全对，回滚能反复对比修复前后。

M5 踩到并已修掉的四个坑，见 [pitfalls.md](./pitfalls.md#m5-陷阱板块的四个坑)。

## M6：暗亮主题打磨（已完成）

站点默认暗色，亮色主题的问题一直被默认值盖住。把两套主题的变量代进 sRGB 插值与 WCAG 相对亮度
算了一遍，六处不达标——**没有一条是「看」出来的**：

| # | 缺陷 | 亮色 | 暗色 | 修法 |
| --- | --- | --- | --- | --- |
| 1 | op-60 说明文字够不着 AA（站点八处这样用） | 4.11 | 6.33 | `--fg` 加深一档到 `#11151d`，一处管住八处 |
| 2 | 盒子描边糊在近白底上 | — | 3.68 | 描边强度拆成 `--stage-line-k`（亮 100% / 暗 55%）|
| 3 | 剩余空间斜纹基本看不见 | 1.46 | 2.20 | 不透明度拆成 `--stripe-op`（亮 0.65 / 暗 0.35）|
| 4 | 正面渐变翻成上暗下亮，与左上光源打架 | 0.591 → 0.697 | 正常 | 正面改从 `--face` 派生 |
| 5 | 方块接触阴影在台面上立不住 | 2.35 | 1.12 | 接触证据挪到方块底缘的 inset 暗边（暗 1.65 / 亮 3.03）|
| 6 | 选中态重写了一遍 background，与 `--face` 脱钩 | — | — | 删掉，三个面连同正面全部从 `--face` 派生 |

守卫测试 `src/styles/theme.spec.ts`（23 条）把这些判据钉住，两套主题各跑一遍。它自带算法自校验
（黑白 21:1、同色 1:1、对照 WCAG 文档的 `#767676` 在白底 4.54:1）——先证明算子没骗人，再谈结论。

**变异验证过**：`--fg` 退回 `#1f2430`，op-60 那条报 `expected 4.114467 to be >= 4.5`；
亮色 `--stripe-op` 退回 0.35，斜纹那条报 `expected 1.461983 to be >= 2`。数字与上表一致。

**测试只能算对比度与明暗序，观感算不出来**，仍归人眼——见下面的清单。
为什么这些参数必须分主题、为什么正面要从 `--face` 派生，见
[pitfalls.md](./pitfalls.md#暗亮主题六条只能算不能看的缺陷)。

## 仍待人眼核对的清单

这些自动化量不出来，需要在真实窗口里扫一遍。

### 斜纹与动效

1. 换成垂直 / 水平硬边条纹后，2.4s 周期会不会抢戏——硬边比 45° 斜纹更跳。
   **亮色主题下这条又加重一层**：`--stripe-op` 为追平可辨识度提到了 0.65（暗色 0.35），
   纹路更实，抢戏风险比暗色高。
2. 系统打开「减少动态效果」后是否真的完全静止（CSSOM 规则已确认，运行时未验）。

### 等距实体块

3. wrap 换行时跨行的面是否互压、悬停时厚度加大与接触阴影拉开的手感、重排后面有无残留。
4. `align-items: stretch` 时盒子顶边与容器上沿齐平，10px 的顶面会画到容器外面，观感是否可接受未定。

### M5 未能验证的两项

本机 `resize_window` 不可控（三次请求 1100 / 720 / 500 分别得到 1280 / 1120 / 1920，压不到 768 以下），
以下两项真实环境是空白：

5. 窄屏（<768px）降级
6. `prefers-reduced-motion` 降级

两者的判断逻辑有 `useTrapScroll.spec.ts` 覆盖、降级形态的渲染有 `TrapSection.spec.ts` 覆盖，
但**需要人眼拖窄窗口扫一遍**。

### 一个可以顺手排除的存疑观察

7. column 下三个盒子的宽度曾读到 632 / 542 / 422 递减（stretch 下本该都是 720），且连续 8 秒三次快照完全一致。
   `.stage-item` 的 width/height transition 只有 0.28s、不可能持续 8 秒，所以几乎可以断定是
   窗口转入后台导致的 transition 冻帧（紧接着扩展就断开了，时间点吻合），与斜纹改动无关。
   **别把它当成新缺陷重查一遍**，在真实窗口里扫一眼就能排除。

## 下一件事

M6 的两块（URL 分享、暗亮主题打磨）都已落地，i18n 已移出，两笔技术债也都还清了：

> 已还清：状态 → CSS 的映射曾经有三份（`TrapStage` / `DemoStage` / `cssEmit`），
> 已统一到 `src/core/styleMap.ts`（`5adae3c`）。
> 已还清：`TrapSection` 正常 / 降级两套模板里重复的卡片渲染，已抽成 `TrapBeatCard`（`2e51f3e`）。

代码侧没有排着队的活了，剩下的是：

- **人眼核对清单**（上面那节七条）——只有一条属于「扫一眼就能排除」，其余六条都还没在真实窗口里过过。
  其中窄屏与 `prefers-reduced-motion` 两项受本机 `resize_window` 不可控所限，只能靠人。
- **部署**：README 的在线演示仍写着「待部署」。

## 设计与计划文档

改动前务必先读对应的那份。

### 设计文档（specs）

- [2026-09-08-todo-flex-design.md](./superpowers/specs/2026-09-08-todo-flex-design.md)
  —— 定稿的总设计文档，含状态模型、模块划分、诊断层优先级、URL 短码格式、陷阱清单、里程碑表
- [2026-09-09-stage-3d-motion-design.md](./superpowers/specs/2026-09-09-stage-3d-motion-design.md)
  —— 演示区 3D 方案（**已作废**，保留作决策记录）
- [2026-09-11-traps-and-scroll-narrative-design.md](./superpowers/specs/2026-09-11-traps-and-scroll-narrative-design.md)
  —— M5 陷阱与滚动叙事

### 实现计划（plans）

- [2026-09-08-core-engine-and-playground.md](./superpowers/plans/2026-09-08-core-engine-and-playground.md) —— M1 + M2
- [2026-09-09-overlay-and-resizer.md](./superpowers/plans/2026-09-09-overlay-and-resizer.md) —— M3 叠加层与 resize 手柄
- [2026-09-09-stage-3d-motion.md](./superpowers/plans/2026-09-09-stage-3d-motion.md) —— 3D 方案（**已作废**）
- [2026-09-09-isometric-solid-block.md](./superpowers/plans/2026-09-09-isometric-solid-block.md)
  —— 等距实体块，**开头的「三轮试错的结论」是动这块视觉前的必读**
- [2026-09-11-traps-and-scroll-narrative.md](./superpowers/plans/2026-09-11-traps-and-scroll-narrative.md) —— M5
