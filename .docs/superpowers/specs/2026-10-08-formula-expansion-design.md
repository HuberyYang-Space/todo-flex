# 公式展开：把一个盒子从 basis 到最终尺寸的推导逐步摊开

> 状态：2026-10-08 用户确认，同日实施完毕（[progress.md 的公式展开节](../../progress.md#公式展开2026-10-08)）。实施计划见 [2026-10-08-formula-expansion.md](../plans/2026-10-08-formula-expansion.md)。
> 来源：progress.md 原有的待办节「公式展开」（功能落地后已删，见 `a1fafec` 之前的版本）；
> 原总设计里对应的是[目标第 2 条](./2026-09-08-todo-flex-design.md#目标)「公式展开 grow/shrink 的分配过程」。

## 要回答的问题

读者在学 flex，看到明细表里「理论 306px」，想知道这个数字是怎么来的。
本站的差异化是「尺寸是怎么算出来的」，明细表只给结论，这个功能把过程给出来。

## 已定的取舍

| 问题 | 决定 | 理由 |
| --- | --- | --- |
| 理论与实际对不上时讲到哪 | **只展开理论推导**，末行对照实际值，对不上时引用诊断那句话 | 引擎故意不模拟 `min-width:auto`（[红线 3](../../../CLAUDE.md#设计红线不要顺手违反)），缝隙交给诊断层解释；另建一套「含下限的推导」工作量翻倍，且要重新划红线 3 的边界 |
| 放在哪 | 底部「理论 vs 实际」面板加标签页，**跟随选中的盒子** | 面板固定 208px，行内展开必然要滚；左栏只有 320px 宽 |
| 每步怎么写 | 四列表格：**步骤 \| 公式 \| 代入 \| 结果** | 通用公式与代入数字并排，既教规则又教应用，行数不翻倍 |
| 数据从哪来 | 引擎补上冻结轮次 + core 新增只编排不重算的 `explainItem` | 冻结循环的每一轮只有引擎知道；编排逻辑留在 core 才能走 TDD；文案留在展示层 |

## 步骤清单

一个盒子一张表，一步一行。

| 步骤 | 何时出现 | 公式 | 代入示例 | 结果 |
| --- | --- | --- | --- | --- |
| basis | 总是 | 按写法分：关键字（`auto` `content` 等）取内容尺寸；`px` 与 `0` 直接取值；`%` × 容器主轴；`em` / `rem` × 根字号；其余绝对单位 × 换算率 | `30% × 720` | 216px |
| 分行 | 容器排成了 ≥ 2 行 | 按 order 累加 basis 与 gap，超过容器主轴就换行 | `216 + 12 + 300 + 12 + 300 = 840 > 720` | 第 2 行（共 3 行） |
| 本行剩余 | 总是 | 容器主轴 − Σbasis − (n − 1) × gap | `720 − (216 + 150 + 150) − 2 × 12`，每项展开 | 180px；负数标「溢出」 |
| grow 分配 | 剩余 > 0 | grow ÷ Σgrow × 剩余 | `1 ÷ 3 × 180` | 60px |
| 收缩权重 | 剩余 < 0 | shrink × basis | `1 × 216` | 216 |
| 权重和 | 剩余 < 0 | Σ(shrink × basis)，只计未冻结的盒子 | `216 + 300 + 300` | 816 |
| 冻结第 k 轮 | 剩余 < 0 且确有盒子被压到 0 以下 | 分摊后会被压到 0 以下的盒子冻结在 0，剩下的溢出在其余盒子间重新分摊 | `盒子 A 应让 −130，basis 只有 50` | 冻结在 0，溢出剩 −80 |
| shrink 分摊 | 剩余 < 0 且本盒子没被冻结 | 权重 ÷ 权重和 × 溢出 | `216 ÷ 816 × −180` | −47.6px |
| 理论最终 | 总是 | basis + 分配 | `216 + 60` | 276px |
| 实际 | 总是（展示层拼接） | 浏览器排版 | — | `276px ✓`；对不上时下方整行写诊断文案 |

### 边界情况

- **剩余恰好为 0**：一行「剩余为 0，不伸不缩」，分配为 0。
- **Σgrow = 0**：grow 分配行写「Σgrow = 0，不伸展」，结果 0。
- **Σgrow 介于 0 与 1 之间**（界面滑块步长为 1 调不出来，只能从分享链接带入小数）：
  公式换成「grow ÷ Σgrow × (剩余 × Σgrow)」，并注明「Σgrow < 1，只分出这个比例」（规范 §9.7 第 4b 步）。
- **未冻结项的 Σshrink 介于 0 与 1 之间**：shrink 分摊的「溢出」换成本轮实际分摊量
  `max(剩余溢出, 初始溢出 × Σshrink)`，并注明原因。注意乘的是**初始**溢出，与引擎实现一致。
- **权重和为 0**（行里所有 shrink 都是 0）：一行「Σ(shrink × basis) = 0，不收缩，溢出留在行上」。
- **本盒子在第 k 轮被冻结**：列出第 1 到第 k 轮，本盒子分配 = −basis，不再有 shrink 分摊行。
- **单个盒子比容器还宽**：分行那一步写「独占一行」。
- **`wrap-reverse`**：「第 N 行」按视觉行序（与 `splitLines`、叠加层同一约定），累加仍按 order 顺序；
  「下一个放不下的盒子」取 order 顺序上的下一个，而不是视觉上的下一行。

### 不单列「假设尺寸」

理论推导里假设尺寸恒等于 basis：basis 不可能为负（`basisSyntax` 拒收负值），引擎又不计 `min-width:auto`。
单列只会是一行恒等式 `max(0, 216) = 216`。公式统一写 `Σbasis`。
浏览器把 `min-width:auto` 计入假设尺寸的那一步，由末行的诊断讲。

### 算不出理论值时

- **选中的盒子自己的 basis 要到运行期才能确定**（`calc()`、`vw`、`ch` 等）：basis 行写「运行期才能确定」，随即一行「无法推导」，停止。
- **运行期 basis 在别的盒子上**：本盒子的 basis 照常解析，随即一行「盒子 N 的 basis 要到运行期才能确定，整个容器的理论值都给不出」，停止。
  分行与剩余空间都建立在占位数字上，不展开。

## 数据层（`src/core/`，走 TDD）

### ① 引擎补上冻结轮次

`distributeShrink` 的返回值改为 `{ deltas, rounds }`，数值算法不动。每轮记录：

```ts
interface ShrinkRound {
  /** 本轮开始时还要消化的溢出（负） */
  overflow: number
  /** 本轮未冻结项的 Σshrink；小于 1 时实际分摊量被打折 */
  factorSum: number
  /** 本轮实际分摊的量 */
  effective: number
  /** 本轮未冻结项的 Σ(shrink × basis) */
  weightSum: number
  /** 本轮被冻结在 0 的项与它们原本应让出的量；最后一轮为空 */
  frozen: { id: string, share: number }[]
}
```

`DerivedLine` 新增 `shrinkRounds: ShrinkRound[]`，不收缩的行为空数组。类型放在 [types.ts](../../../src/core/types.ts)。

### ② `explainItem`

新文件 `src/core/explain.ts`，纯函数 `explainItem(state, layout, itemId): ExplainStep[]`。

- 步骤是以 `kind` 区分的联合类型，只含数值，不含文案。种类与上面的步骤清单一一对应，外加「剩余为 0」「无法推导」。
- **只编排不重算**：每一步的**结果**取自 `DerivedItem` / `DerivedLine` 的现成字段
  （`basisResolved`、`hypotheticalMainSize`、`freeSpace`、`totalGrow`、`deltaFromGrow`、`deltaFromShrink`、`finalMainSize`、`shrinkRounds`）；
  **代入**里的各项可以从状态与这些字段取，但不调用 `resolveBasis` / `distribute*` 重新推一遍。
- 判断 basis 写法用现成的 `basisKind` / `staticLength`；换算率取 `PX_PER_UNIT`，根字号取 `layout.fontSize`。
- 「实际」行不归它管：实际值来自观测层，诊断来自诊断层，由界面拼在末尾。
- 找不到 `itemId` 时返回空数组。

### ③ 守卫

- **同源**：随机生成一批状态，断言 `explainItem` 最后一步（理论最终）的结果恒等于 `deriveLayout` 的 `finalMainSize`——也就是明细表的「理论」列。
- **代入自洽**：对同一批状态的每一步，把「代入」的各项真的算一遍，必须等于这一步的「结果」（容差 1e-9）。
  公式写错、项漏了、符号反了都会当场变红。
- 随机状态必须专门造出各条分支：grow / shrink / 剩余为 0、多行、冻结、因子和小于 1、运行期 basis。
  测试先统计每条分支实际命中了多少次，任何一条为 0 就判失败，防止「随机扫描从没走到那条路」的瞎守卫。
- 随机生成用 [fast-check](https://github.com/dubzzz/fast-check)（新增 devDependency，取最新稳定版）：它找到反例会自动缩到最小，
  手写伪随机做不到这点，排查时要自己缩。
- 两类守卫都做变异验证：逐条改坏（结果取错字段、代入漏项、符号取反、冻结轮次少记一轮），确认每条都变红。

### ④ 零消费方收尾

做完后重查当初为本功能保留的字段：`basisResolved`、`deltaFromGrow`、`deltaFromShrink`、
`freeSpace`、`usedMainSize`、`totalGrow`、`totalShrinkWeighted`、`Diagnostic.theoretical` / `actual`。
届时仍无生产代码读取的，按规则删除（如 `totalShrinkWeighted` 可能被每轮的 `weightSum` 取代）。
progress.md 待办节里「不要按零消费方规则删掉」那条保留说明随之撤掉（已随待办节一并删除）。

## 展示层

### ① 面板结构

- 把底部「理论 vs 实际」那块从 [ThePlayground.vue](../../../src/components/playground/ThePlayground.vue) 抽成独立组件，标题不变，仍固定 208px、内容在面板内滚动。
- 标题下两个标签：`明细表`、`推导过程 · 盒子 B`（标签随选中盒子变，用 `itemLabel`）。

### ② 标签页行为

- 默认停在明细表；选中盒子时**不自动跳转**——在演示区点盒子是为了编辑它，明细表不该因此消失。
- 当前标签是组件局部状态，不进分享链接（链接只序列化 `FlexState`）。
- 未选中盒子时推导页提示「点击演示区里的任意盒子，看它的尺寸是怎么算出来的」。
- 按 WAI-ARIA tabs 模式：`role="tablist"` / `tab` / `tabpanel`、`aria-selected`、`aria-controls`，左右方向键切换。
  项目没有 tabs 组件库，两个按钮的规模不值得为此引入依赖。

### ③ 共用部分挪到一处

- 诊断的计算与 `ruleText` 文案现在住在 [MetricsTable.vue](../../../src/components/playground/MetricsTable.vue)，推导页末行要用同一份。
  挪进新 composable `useDiagnostics()`，用 vueuse 的 `createSharedComposable` 共享同一份计算。
  仍不放进 `useFlexState`（状态层不反向依赖观测层）。
- 数字格式化（1 位小数 + `px`）合成一个函数：现在明细表的 `px` 与叠加层的 `round` 各一份。

### ④ 推导表

- 新组件 `DerivationSteps.vue`：一张「步骤 kind → 名称 / 公式 / 代入」的映射表生成四列，与 `ruleText` 同一写法，不为每种步骤手写模板。
- 末行「实际」：实际值缺失时写 `—`；有诊断时按 `severity` 标 ⚠ / ℹ，下方整行写诊断文案；否则 ✓。
- 中间栏在 1024px 宽时约 330px，公式列与代入列允许折行，不隐藏任何一列。

## 验证

- **core**：`distribute.spec.ts` 补轮次记录；新 `explain.spec.ts` 覆盖每种步骤与边界情况，外加上面两类随机守卫。
- **组件**：标签切换与方向键、空状态、grow 场景逐行文字、收缩冻结场景、运行期 basis 场景、末行 ✓ / ⚠ / ℹ 与诊断文案、
  明细表行为不变（现有 `MetricsTable.spec.ts` 照常通过）。
- **浏览器**（CDP 驱动 headless Chrome，以 DOM 为准）：1024px 宽下四列折行后是否可读、面板内滚动、
  末行实际值与明细表一致、冻结场景的轮次行。happy-dom 不排版，**折行与滚动没有自动化守卫**，交付时单独说明。

## 不做

- 浏览器那条路（含 `min-width:auto` 的冻结）的展开。
- 交叉轴（`align-*`）的推导。
- 推导页的「整行视角」（一次展开一行里所有盒子）。
- 标签状态写进 URL。
