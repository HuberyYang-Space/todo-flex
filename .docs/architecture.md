# 架构综述

> 什么时候读：改 `src/core/` 下的模块、往数据流里新增一层、或者拿不准某段逻辑该放哪一层的时候。
> 约束性的部分（九条设计红线）留在 [CLAUDE.md](../CLAUDE.md)，这里只讲结构长什么样。

## 核心原则

**推导逻辑与 DOM 彻底隔离**，纯函数部分才能走 TDD。

```
state ──→ 渲染 ──→ 观测 ──→ 诊断 ──→ 展示
  └────→ 推导 ──────────────↗
```

上面一条是「浏览器实际怎么排」，下面一条是「规范说应该排成什么样」，两条在「展示」汇合做并排校验——
[项目定位](../CLAUDE.md#项目定位)说的「理论 vs 实际的缝隙」在架构上就是这个汇合点。

## 分层

| 层 | 位置 | 说明 |
| --- | --- | --- |
| 纯逻辑 | `src/core/` | 零 DOM、零 vue 依赖。推导引擎按步骤拆分：`resolveBasis` → `splitLines` → `distribute`，由 `deriveLayout` 组装。`cssEmit` 生成可复制 CSS，`axis` 负责 direction → 主轴/交叉轴换算，`styleMap` 负责状态 → CSS 属性的映射。`basisSyntax` 判断 flex-basis 属于哪一类、本站收不收，是 `data/` 唯一依赖的 core 模块，自身零 import，才不会与反过来依赖属性表的 `defaults` / `urlCodec` 成环。推导引擎要的常量从零依赖的 `constants` 取，不经 `defaults`，整条推导链才不间接依赖属性表 |
| 元信息 | `src/data/flexProperties.ts` | 属性元信息表（`PropertyDef` 四种 kind：enum/number/boolean/text），控制面板遍历它生成控件 |
| 状态源 | `src/composables/useFlexState.ts` | **模块级单例** `reactive(createDefaultState())`——全站唯一状态源，组件各自 `useFlexState()` 拿到的是同一份。`derived` / `css` 是从它派生的 computed |
| 视图 | `src/components/playground/` | 只负责渲染与事件。`DemoStage` 是真实 flex 容器，`PropertyField` 是表驱动的通用控件 |

## 关键类型

全部在 `src/core/types.ts`：

- `FlexState`——可序列化，无 DOM 引用。URL 短码编解码（`src/core/urlCodec.ts`）直接吃它
- `DerivedLayout` / `DerivedLine` / `DerivedItem`——推导引擎的输出
- `Diagnostic`——诊断层输出，`rule` 是它的标识

`Diagnostic.rule` 是真正的标识字段，务必保留；曾经并存的 `messageKey` 系列字段已随
i18n 一起删除，原因见 [pitfalls.md](./pitfalls.md#i18n-预埋字段为什么被删净)。
原先给「公式展开」预留的 `DerivationStep` 因零消费方已在 `38f55df` 删除。
