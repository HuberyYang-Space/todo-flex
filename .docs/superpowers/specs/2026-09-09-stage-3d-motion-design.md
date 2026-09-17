# 演示区 3D 化与运动编排 设计文档

> 日期：2026-09-09
> 状态：**已作废（2026-09-09）**。3D 方案实现并浏览器验证后，实际观感不成立——
> 立体面垂直于盒子平面，投影高度只有「厚度 × sin(倾角)」，把倾角提到 22 度仍读不出体积感，
> 反而让 column 方向的主轴被压缩。演示区改走「平面 + 质感 + 惯性动效」路线，
> 相关代码（core/depth.ts、useStageView、倾角与立体面）已全部删除。
> 本文保留作决策记录，**不要照它实现**。文中的调研结论（CSS3DRenderer 出局、GSAP 免费、
> View Transitions 的取舍、grouping property 陷阱）仍然有效。
> 关系：本文是 `2026-09-08-todo-flex-design.md` §7「视觉与特效分层」的细化与**局部修订**，
> 覆盖里程碑 M4（动效）。原文档把 three.js 的预算全给了 Hero、把演示区的视觉留白，本文填上这块空白，
> 并修订一条既有实现（`.stage` 的 `overflow: hidden`，见 §7.1）。

## 1 目标

让演示区的盒子成为**有体积、会呼吸、丝滑重排的 3D 方块**，同时不动摇产品的立身之本：
盒子的位置与尺寸仍然完全由浏览器的 flex 排版决定。

炫酷不是装饰目的。Z 轴是本站白送的第三个信息维度——推导引擎早就算出了
`deltaFromGrow` / `deltaFromShrink`（每个盒子分得多少、让出多少），但明细表只呈现最终尺寸，
「谁在扩张、谁在被压缩」现在得读数字才知道。3D 把这件事变成一眼可见的物理现象。

## 2 调研结论（决策依据）

| 结论 | 依据 |
| --- | --- |
| **three.js `CSS3DRenderer` 出局** | 它给 DOM 套 CSS transform 假装在 3D 场景里，但用不了 three.js 的材质与几何体（拿不到真光照），且对 flex 布局识别不全、祖先 `offsetLeft/offsetTop` 有小数就整体错位。既丢布局真实性，又换不来 WebGL 的好处 |
| **WebGL 镜像层是伪选项** | 真正想要的体积感、光照、景深、丝滑重排，CSS 3D 全都做得到；而 WebGL 要付出的代价是让「你看到的就是 CSS 算出来的」这个核心叙事失效 |
| **GSAP 可以放心用** | Webflow 2024 收购 GreenSock 后，2025 年起全部插件（含 Flip、SplitText、MorphSVG）免费商用。`gsap` 已在依赖里 |
| **View Transitions API 不做主驱** | 三大浏览器均已支持同文档过渡（Chrome 自 111 起最早，Safari 与 Firefox 随后跟进——具体版本号调研时资料互相矛盾，真要依赖需另行核实），原生插值位置尺寸、零 bundle。但它是一次性快照 morph：拖滑块这类连续变化会疯狂重启事务，也做不了交错与弹性。留作未来的降级路径候选，不作主驱 |
| **立体感不需要 WebGL** | 伪元素做面 + `preserve-3d` + `translateZ`，明暗用 `filter: brightness()`——DeSandro 的 3D transforms 教程与 CSS-Tricks「用立方体思考」是这套技法的经典出处 |
| **竞品全是 2D** | Flexbox Labs、Flexy Boxes、Loading.io、CSS Portal 等主流 flex 工具无一做 3D。这块地是空的 |
| **同类实现可参考 antfu/vue-starport** | FLIP 思路的产品化：代理元素持有位置信息，真实组件在其间「飞过去」 |

## 3 三个已定的决策

1. **渲染路线**：真实 DOM + CSS 3D，GSAP Flip 主驱运动。
2. **默认视角**：轻度俯视（`rotateX(10deg)`）+ 交互抬起。横向尺寸几乎无透视失真，读数不受损；
   hover / 选中时该块 `translateZ` 抬起并投下阴影。
3. **Z 轴语义**：厚度编码伸缩量。`basis` 原尺寸是一块平板，grow 分得越多越凸，shrink 让出越多越凹。

## 4 架构

核心原则不变：**推导逻辑与 DOM 彻底隔离**，新增的几何换算继续走纯函数。

```
state ──→ 推导 derived ──┬──→ core/depth.ts（纯函数：厚度归一化）──→ CSS 变量 --depth
                         └──→ 明细表 / 叠加层（不变）
state 变化 ──→ useFlip（Flip 编排 + scrubbing 抑制）──→ 真实 DOM 位移动画
                         └──→ useMeasure.pause() / resume()
```

| 文件 | 职责 | 状态 |
| --- | --- | --- |
| `src/core/depth.ts` | `computeDepths(derived, containerMainSize)`：把每个盒子的 `deltaFromGrow + deltaFromShrink` 归一化到 −1..1。**只归一化，不产出像素**——像素是视觉参数 | 新增，TDD |
| `src/visual/motion.ts` | 动效与视觉 token：duration / ease / stagger / 厚度像素上限 / 倾角。禁止在组件里硬编码 | 新增 |
| `src/composables/useFlip.ts` | GSAP Flip 封装；持有 `scrubbing` 标志抑制连续拖拽期间的动画 | 新增 |
| `src/composables/useStageView.ts` | 3D / 平面视图开关。与 `useOverlay` 同定位：UI 偏好，**不进 `FlexState`**，不污染 M6 的 URL 短码 | 新增 |
| `src/composables/useMeasure.ts` | 新增 `pause()` / `resume()`：Flip 动画期间挂起采样 | 改 |
| `src/components/playground/DemoStage.vue` | 加 `.scene` 倾斜层、写 `--depth`、伪元素立体面 | 改 |
| `src/components/playground/StageResizer.vue` | 拖拽期间置 `scrubbing` | 改 |
| `src/components/playground/PropertyField.vue` | range 控件拖动期间置 `scrubbing` | 改 |
| `src/components/playground/ThePlayground.vue` | 叠加层开关旁增加 3D 视图开关 | 改 |

`core/depth.ts` 只归一化、不给像素，是为了让 `src/core/` 继续保持零视觉参数——
换个厚度上限不该动纯逻辑层，也不该让纯函数的测试跟着视觉调参一起改。

## 5 立体表现

### 5.1 面的构造

`.stage-item` 上 `transform-style: preserve-3d`，顶面与侧面用 `::before` / `::after` 旋转 90° 拼出。
**伪元素不进 DOM、不占布局空间**，因此不违反红线 6（演示区禁 border 与 padding）。

厚度由内联 CSS 变量 `--depth` 驱动，值域 −1..1，组件乘以 `motion.ts` 里的像素上限：

- `--depth > 0`（grow 分得空间）：方块凸起，顶面面积增大
- `--depth < 0`（shrink 让出空间）：方块凹陷
- `--depth === 0`（平衡态）：一块平板

**归一化基准是容器主轴尺寸，不是行内最大 delta**：`depth = clamp(delta / containerMainSize, -1, 1)`。

按行内最大值归一化的话，任何状态下总有一个方块顶到满厚度，视觉对比是强了，
但厚度就只剩「组内排名」的意思——改一下 gap 让最大值变了，全体厚度会跟着整体跳动，
同一个盒子在不同状态下的厚度也不再可比。按容器尺寸归一化则是绝对量：
分到容器的三分之一就是三分之一的厚度，跨状态、跨截图都能对照。
代价是 shrink 场景的 delta 通常较小、方块偏薄——但「让出得少所以薄」本身就是正确的表达。

### 5.2 grouping property：两条必须避开的陷阱

CSS Transforms 规范里，若干属性会强制把元素的 `transform-style` 变成 `flat`，掐断 3D 链条：

1. **`overflow` 非 `visible`**。`.stage` 当前带 `overflow: hidden`，它一旦被扁平化，
   `.scene` 的 `perspective` 就传不到方块上，方块会各自为政、没有共同灭点。
   **修订：移除 `.stage` 的 `overflow: hidden`**（见 §7.1）。
2. **`filter` 与 `opacity < 1`**。因此明暗的 `brightness()` **只能加在面（伪元素）上**，
   不能加在 `.stage-item` 自己身上，否则它的立体面会被压平。

反过来说，红线 7（`.stage-item` 禁 `overflow: hidden`）顺手保住了 `preserve-3d`——
当初为 `min-width: auto` 立的规矩，在这里第二次发挥作用。

### 5.3 倾斜层 `.scene`

倾斜**不能加在 `.stage` 上**，否则叠加层的 SVG 不跟着转、剩余空间色块会与方块错位。
在 wrapper 内插一层 `.scene`（`perspective` + `rotateX` + `preserve-3d`），
**把 `.stage` 与 `OverlayLayer` 一起包进去**，两者共用同一个变换，坐标对应关系不变。

祖先元素的 transform 不影响 `offsetLeft` / `offsetTop`，观测层照常准确——这与红线 5 是同一个道理。

## 6 运动编排

### 6.1 离散播动画，连续不播

| 变化类型 | 例子 | 行为 |
| --- | --- | --- |
| 离散 | 点 `justify-content`、切 `direction`、增删盒子、点 flex 预设 | GSAP Flip 带交错飞过去 |
| 连续 | 拖 gap 滑块、拖 grow/shrink/size 滑块、拖 resize 手柄 | **不播动画，直接跟手** |

连续拖拽播 Flip 会拖泥带水——手已经到了，方块还在追。区分靠 `useFlip` 的 `scrubbing` 标志，
由滑块与手柄在 `pointerdown` / `pointerup` 期间维护。

### 6.2 接入点

沿用原设计文档 §7 定死的写法：`watch(state, …, { flush: 'pre' })` 中 `Flip.getState()`，
`await nextTick()` 后 `Flip.from()`；换行场景启用 `absolute: true`。

动效参数一律取自 `visual/motion.ts`，不在组件里硬编码 duration 与 ease。

## 7 风险与修订

### 7.1 修订：移除 `.stage` 的 `overflow: hidden`

**原状**：`.stage` 带 `overflow: hidden`，被 `min-width: auto` 撑出容器的盒子会被裁掉，
只剩叠加层画出的越界标记可见。

**修订理由**：一是 §5.2 说的技术硬约束——它会掐断 3D 链条；二是本来它就与产品意图相悖，
红线 7 的原话是「盒子被压得比内容还窄时，内容溢出正是要给用户看的现象」，裁掉正好看不见。

**影响面**：溢出的方块会真的伸出容器。`ThePlayground` 里包着演示区的滚动容器带 `overflow-auto`，
溢出内容会触发横向滚动条而不是撑破页面布局。实现时需在浏览器核对这一点。

### 7.2 `Flip.from(absolute: true)` 会污染观测

设计文档 §7 要求换行场景启用 `absolute: true`。**这会临时把元素设成 `position: absolute`——
那是真的改布局**，而观测层正盯着布局。动画期间 `useMeasure` 会采到绝对定位状态下的错误尺寸，
明细表的数字会在动画过程中乱跳。

红线 5 挡住的是 `getBoundingClientRect` 返回 transform 中间态那一半风险，**没挡住这一半**。

**处理**：`useMeasure` 暴露 `pause()` / `resume()`。Flip 动画开始前挂起采样，
动画结束后 `resume()` 并强制重采一次。这是本次唯一需要改动观测层的地方。

## 8 降级

| 场景 | 行为 |
| --- | --- |
| `prefers-reduced-motion: reduce` | **关动效、留 3D**。静态透视不引起前庭不适，而丢掉 3D 等于丢掉信息（厚度编码着伸缩量）。Flip 时长归零、悬停过渡归零 |
| 用户主动切「平面视图」 | 倾角与厚度归零，回到纯平面。服务截图与教学场景 |
| 低端设备 | 不额外降级。CSS 3D 走 GPU 合成，开销远低于 three.js；原设计文档给 three.js 的性能预算仍然只属于 Hero |

## 9 测试策略

| 层 | 手段 |
| --- | --- |
| `core/depth.ts` | TDD 纯函数测试。happy-dom 无排版引擎不影响纯数据计算 |
| 组件 | 断言 `--depth` 变量写对、reduced-motion 下时长为 0、`scrubbing` 期间不调用 Flip |
| 动画本身 | **单测覆盖不了**（happy-dom 既没有排版引擎也没有合成器），靠真实浏览器核对 |

浏览器核对清单必须包含一条：**Flip 动画期间明细表的数字不许跳**（即 §7.2 的处理确实生效）。

## 10 非目标

- **不做演示区的 WebGL 层**。原设计文档给 three.js 的预算属于 Hero，不在这里花掉。
- **不用 View Transitions 做主驱**。理由见 §2；未来若要替换 Flip，需要单独的 spike 验证
  3D 变换过的元素在 VT 快照下是否失真。
- **不做自由旋转视角**。视角是固定的轻度俯视加一个平面开关，不给用户轨道控制器——
  自由视角会让「比较盒子宽度」这件事彻底不可靠。
- **不动推导引擎**。厚度是从既有的 `deltaFromGrow` / `deltaFromShrink` 派生的，不新增推导步骤。
