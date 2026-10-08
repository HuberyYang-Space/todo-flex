# 架构

> 什么时候读：改 `src/core/`、往数据流里新增一层、或拿不准某段逻辑该放哪一层的时候。
> 约束性的部分（设计红线）在 [CLAUDE.md](../CLAUDE.md)，这里只讲结构和规则。

## 数据流

```
state ──→ 渲染 ──→ 观测 ──→ 诊断 ──→ 展示
  └────→ 推导 ──────────────↗
```

上一条是「浏览器实际怎么排」，下一条是「规范说应该排成什么样」，两条在展示层汇合并排校验。
**推导逻辑与 DOM 彻底隔离**，纯函数部分才能走 TDD。

## 分层

| 层 | 位置 | 内容 |
| --- | --- | --- |
| 纯逻辑 | [`src/core/`](../src/core/) | 零 DOM、零 vue。推导：`resolveBasis` → `splitLines` → `distribute`，由 `deriveLayout` 组装；`explain` 把单个盒子的推导编排成公式展开的步骤。观测后处理：`measuredLines`（按浏览器实际断行分组）、`diagnostics`（理论 vs 实际）、`overlay`（叠加层几何）。其余：`cssEmit` 生成导出 CSS、`styleMap` 状态 → 内联样式、`urlCodec` 分享链接、`basisSyntax` basis 的保守解析、`axis` 主轴 / 交叉轴换算、`labels` 盒子标签与数字格式 |
| 元信息 | [`flexProperties.ts`](../src/data/flexProperties.ts) | 属性表：控件、默认值、取值区间、basis 的 `check` 都只在这里写一份 |
| 状态与观测 | [`src/composables/`](../src/composables/) | `useFlexState` 模块级单例，全站唯一状态源，`derived` / `css` 是它的 computed；`useMeasure` 观测层；`useDiagnostics` 明细表与推导页共用的诊断与文案；`useFlip` 动画；`useShareUrl` 写回地址栏 |
| 视图 | [`src/components/playground/`](../src/components/playground/) | 只渲染与转发事件。`DemoStage` 是真实 flex 容器，`PropertyField` 是表驱动的通用控件，`ComparePanel` 承载明细表 / 推导过程两个标签页 |

依赖方向的两条隐式约束：

- `basisSyntax` 自身零 import，它是 `data/` 唯一依赖的 core 模块；反过来依赖属性表的 `defaults` / `urlCodec` 才不会成环
- 推导引擎的常量从零依赖的 `constants` 取，不经 `defaults`，整条推导链才不间接依赖属性表

## 推导引擎

按规范 §9.7 算理论主轴尺寸：basis 解析（关键字取内容尺寸 `size`，`%` 按容器主轴，`em` / `rem` 按根字号）→ 分行（按 order 累加 basis 与 gap，超出就换行）→
剩余空间（容器 − Σbasis − Σgap）→ 正剩余按 grow 占比分配，负剩余按 `shrink × basis` 加权分摊、压到 0 以下的冻结后重分，因子和小于 1 时只分出对应比例。
冻结循环的每一轮记在 `DerivedLine.shrinkRounds`。

- **不模拟 `min-width: auto`**（红线 3），收缩下限只有 0
- 容器里有要到运行期才能确定的 basis（`calc()`、`vw`、`ch` 等）时，整个容器的理论值都给 `null`
- **`explainItem` 只编排不重算**：每一步的结果都取自 `deriveLayout` 的输出，最后一步因此必然等于明细表的理论值。
  [explain.spec.ts](../src/core/explain.spec.ts) 的随机守卫断言同源、每步代入自洽、各分支都命中过；
  [DerivationSteps.spec.ts](../src/components/playground/DerivationSteps.spec.ts) 把推导页显示的代入当算式复算

## 观测层

[useMeasure.ts](../src/composables/useMeasure.ts) 读浏览器真实布局，口径必须避开 transform（红线 5）：尺寸读计算样式的小数值，位置读整数的 `offsetLeft/offsetTop`，
ResizeObserver 只通知重采，不读它的 `borderBoxSize`（尺寸只在回调里给，状态触发的那条采样路径拿不到）。主轴取宽还是取高统一走 `axis.measuredMainSize`。

三个阈值对应三种误差，不要统一：

| 位置 | 阈值 | 理由 |
| --- | --- | --- |
| `diagnostics` | 0.5px | 亚像素舍入的噪声 |
| `overlay` 色块 | 1px | 两个取整的位置各差 ±0.5，拼出的空隙最多差 1px；实测真实色块最窄 1.5px |
| `measuredLines` | 1.5px | 「位置 + 尺寸」比另一个取整的位置，最多差 1px，再留 0.5 余量 |

**叠加层与诊断按浏览器实际断行分组**，不按推导引擎：浏览器按撑宽后的假设尺寸（basis 与内容尺寸取大）断行，随机换行场景里约四成与引擎不同。
`measuredLines` 复用 `splitLines` 换掉假设尺寸，几何位置只用来核对矛盾、以及运行期 basis 时兜底（宽度为 0 的盒子光靠几何分不清是否换行）。

## 诊断规则

[diagnostics.ts](../src/core/diagnostics.ts) 逐个盒子比对理论与实际，自上而下取第一条命中的（文案在 [useDiagnostics.ts](../src/composables/useDiagnostics.ts)）：

| `rule` | 级别 | 条件 |
| --- | --- | --- |
| `runtime-basis` | info | 理论值为 `null`，且这个盒子自己的 basis 要到运行期才能确定 |
| `line-break-widened` / `line-break-shifted` | warn | 实际所在行的成员与推导不同：自己被 `min-width: auto` 撑宽 / 被别人波及 |
| `min-width-auto` | warn | 差值 > 0.5 且实际尺寸停在内容尺寸上（伸缩两种说法，靠带上的剩余空间区分） |
| `min-width-auto-sibling` | warn | 实际比理论小，同行有盒子被 `min-width: auto` 兜住并多占了空间，点名源头 `causedBy` |
| `unexplained` | warn | 其余不一致，如实说没能归因（本站没有 max 类属性，不硬套上下限） |
| `margin-auto` | info | 尺寸吻合，但 `margin: auto` 吃掉了分配后剩下的空间——它只改位置不改尺寸，只能作为提示 |

## 分享链接

[urlCodec.ts](../src/core/urlCodec.ts)：`?v=1&c=<容器>&i=<盒子>&sel=<选中索引>`。容器字段按固定顺序用 `.` 分隔，盒子之间用 `,`、字段之间用 `-`，长值走短码映射。
解码失败（版本不符、字段缺失、值非法）整条回退默认状态并由 `ShareNotice` 提示原因，数值越界夹回属性表区间，绝不白屏。
