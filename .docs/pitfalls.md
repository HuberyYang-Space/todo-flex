# 踩坑档案：禁令背后的论证

> 什么时候读：[CLAUDE.md](../CLAUDE.md) 里某条禁令你想推翻、或者想不通它为什么存在的时候。
> 这里存的是每条禁令的完整论证与实测数字。**禁令本身在 CLAUDE.md，不在这里**——
> 这份文档只回答「为什么」，不承担「现在要不要做」。

## 等距实体块

### 三轮试错的结论

演示区方块的视觉已定案为**等距实体块**（样本册第 26 号），实现方案见
[2026-09-09-isometric-solid-block.md](./superpowers/plans/2026-09-09-isometric-solid-block.md)。
**再动这块视觉前先读那份文档开头的「三轮试错的结论」**，里面记着三条已经走死的路，
重蹈任何一条都会白做一遍。

三十二个候选方案的对比页：<https://claude.ai/code/artifact/c94e5026-c873-4035-a93d-d00a8c3f64a1>

### 实现要点

顶面与右侧面是 `.stage-box` 的两个伪元素画的二维平行四边形（`skewX` / `skewY`），
厚度 `--d` 由 `DemoStage` 下发，悬停 / 按下用倍率 `--d-k` 缩放。完整公式是
`Math.max(blockDepthMin, Math.min(blockDepth, min(rowGap, columnGap) - 2))`——**双向钳制**，
下限 3px（gap 收到 0 也要留一点，否则方块塌回平面）、上限 10px。
别记成单纯的 `min(gap) - 2`：`gap < 5` 时下限生效，厚度会大于间距，
那是有意为之的取舍而不是 bug，理由见 [progress.md](./progress.md#顺带查清的两件事)。

### `--d` 不能自引用

**不要写成 `--d: calc(var(--d) + 3px)`**——CSS 自定义属性自引用无效，整条声明会被丢弃，
表现是厚度纹丝不动、而且不报错。要改厚度就改倍率 `--d-k`。

### 三个面必须从同一个体色派生

**三个面必须从同一个体色 `--face` 派生（顶面加白、右侧面加黑），不要各自去跟 `--accent` 调色。**

后者的明暗序会随主题翻车：亮色主题下 `--panel` 接近白，会把正面拉得比顶面还亮
（实测正面 0.79 > 顶面 0.67），左上光源就读不出来了。

**这个缺陷只在亮色主题下出现，只看暗色发现不了。** 改配色相关的东西时两个主题都要过一遍。

### 伸出去的面靠 overhang 兜住，不是靠滚动容器的内边距

顶面往上伸 `--d`（上限 10px），右侧面往右伸同样多。这两个面**不受 `.stage-box` 自己控制**——
裁掉它们的是更外层那个 `.overflow-auto`（在 `ThePlayground.vue`）。
`align-items` 默认 `stretch`，盒子顶边必然贴着容器上沿，所以裁切每次都发生，不是边界情况。

**兜住它们的是 `.stage-wrapper` 的 `--overhang` 外边距**（`motion.stageOverhang`，现为 32px）。
这个数是按悬停时的总伸出量算出来的：顶面厚度 × `blockDepthHover` + `liftHeight` + `liftScale`
的放大量。`DemoStage.spec.ts` 有守卫钉住 `stageOverhang ≥ 这个总和`，
**改 `motion.blockDepth` / `liftHeight` / `blockDepthHover` 任何一个都会让它变红。**

#### 曾经走过的弯路：让滚动容器也出一份内边距

最早是滚动容器的 padding 在扛这件事。`p-2`（8px）装不下 10px 的顶面，**顶面上沿被稳定裁掉 2px**，
于是提到 `p-3`（12px），并配了一条 `padding ≥ motion.blockDepth` 的守卫。

后来 `--overhang` 落地，防裁切的责任整体挪到了 `.stage-wrapper`，那层 padding 就变成**第二份留白**：
演示区被往右下推（左侧留白实测 56px、上侧 44px），可视范围白缩，而防裁切能力一点没增加。
现已删除，实测左侧降到 40px、上侧 32px。

**不要为了"补余量"把它加回来。** 余量不够就调 `motion.stageOverhang`，那里只有一个数、
一条守卫；加回滚动层的 padding 等于把同一件事拆到两个文件里各写一半，下次谁都不知道该改哪个。
`ThePlayground.spec.ts` 有守卫拦着这层的任何内边距类（`p-*` / `pt-*` / `lg:p-*` 全算）。

水平方向同样由这份 overhang 兜。它比竖直方向宽松：右侧面不参与抬升，只有厚度和放大两项。
真正会被裁的场景是演示区宽度逼近滚动容器可用宽度——那时右侧面连同盒子一起落到横向滚动区里，
`overflow-auto` 还滚得到，不是永久丢失。

### `align-items: stretch` 下顶面会画出容器

`stretch` 时盒子顶边与容器上沿齐平，10px 的顶面会画到容器外面（容器不能加 padding，见设计红线第 6 条）。
观感已由人眼核对通过——伸出容器是有意为之，不是缺陷，见 [progress.md](./progress.md#人眼核对清单已全部核对通过)。

## 斜纹流向：元素形状不能承担方向语义

### 原方案与它错在哪

曾经只做两份 45° 斜纹，理由是 45° 斜纹只能表达垂直于自身的运动分量（理发店转灯错觉），
「向右流」与「向下流」在 pattern 内部本来就是同一个平移，方向感便交给色块自身的长宽比去暗示：
row 下宽扁读作横向流，column 下高瘦读作纵向流。

**这个前提在两个方向上都不成立**——色块长宽比取决于「剩余空间量 vs 交叉轴尺寸」，跟 `flex-direction` 不相干：

- column 默认三个盒子时，色块是 720×56 的宽扁横条（会读成横向流，实际沿垂直轴）
- row 加到六个盒子时，色块被压成 180×320 的高瘦竖条（会读成纵向流，实际沿水平轴）

两种情况方向都读反。

### 现方案

改成「流动轴 × 流向」四份 pattern，纹路朝向由 `OverlayBand.flowAxis`（`'x' | 'y'`，与 `flow` 同进同出）决定：
x 轴是垂直纹路做左右平移，y 轴靠 `patternTransform="rotate(90)"` 转成水平纹路。

**旋转把 pattern 自身的坐标系一起转了**，所以同一条 `translateX(8px)` 在 y 轴 pattern 里就是屏幕上的向下，
一套 keyframes 管四份，不要为四个方向各写一遍位移。

### 通用教训

> **不要让「元素形状」去承担方向语义。** 形状是布局算出来的，随内容和属性随时翻转；
> 方向感要交给纹路朝向这类自身就带方向的属性，或者箭头这类显式符号。

这条假设当初在单元测试里全绿、在代码注释里论证得很完整，只有真实窗口能证伪它。

## 暗亮主题：六条只能算不能看的缺陷

六条缺陷没有一条是「看」出来的，全是把两套主题的变量代进 sRGB 插值 + WCAG 相对亮度算出来的。
完整的缺陷表与实测数字在 [progress.md](./progress.md#m6暗亮主题打磨已完成)，这里只记三条会被后人误删的取舍。

### `-k` / `-op` 参数不是冗余，不要合并成一个值

`--stage-line-k`、`--stage-line-hover-k`、`--stripe-op` 看着像「同一个语义色在两处重复定义」，
很容易被当成可以统一的冗余清掉。它们存在的唯一理由是：**这些值混的底色一亮一暗，统一取值必然有一套不达标。**

- 描边：亮色底接近白，`accent` 掺水就糊，必须上满 100% 才有 3:1；暗色底本就衬得出 `accent`，
  55% 已有 3.68，上满会过冲成刺眼的实线。
- 斜纹：亮色下 0.35 只有 1.46，基本看不见，提到 0.65 才追平；暗色的 0.35 是取舍过的基准（2.20），
  再高会让 2.4s 的流动抢戏。

它们不是语义色板的一部分，是「同一个视觉效果在两套主题下必须取不同值」的参数。
判据全部钉在 `src/styles/theme.spec.ts` 里，**改动前先看那份测试**。

### 斜纹的不透明度必须写在 CSS 里，不能写成 SVG 属性

原来写在 `<line>` 的 `stroke-opacity` 属性上。SVG 属性没法跟着 `html.dark` 走，
要分主题就只能挪进 CSS 用变量接。

### 正面渐变也必须从 `--face` 派生

曾经写成「`accent` 40% → 28% 混 `panel`」，看着只是深浅两档，但混合比例的明暗方向
取决于 `accent` 与 `panel` 谁更亮——**亮色主题下 `panel` 是纯白，`accent` 掺得越多越暗，
渐变整个翻过来变成上暗下亮（0.591 → 0.697）**，读作光从下面打上来，跟顶面加白的左上光源正好打架。

这与顶面 / 右侧面那条是同一个坑的第二次发作（见[上文](#三个面必须从同一个体色派生)）：
**只要还有任何一个面绕开 `--face` 直接跟 `--accent` 调色，明暗序就会随主题翻车。**
选中态同理——它只该换体色 `--face`，不该再写一遍 `background`。

### 接触阴影在暗色台面上立不住，证据挪到了方块底缘

落在台面上的黑影在暗色主题里几乎不成立：台面亮度只有 0.015、纯黑是 0，没有可压的余量，
对比度仅 1.12（亮色下有 2.35）。提亮台面换不来多少（上限 1.42）却要改掉定案的暗色观感，
所以接触的证据改由方块自己的底缘承担——`inset` 暗边落在有余量的正面上，暗色 1.65 / 亮色 3.03。
**台面的五层投影一层不动**，它负责的是环境光衰减，不是接触。

## 演示区的 3D 方案：已试过并放弃

立体面的投影高度是「厚度 × sin(倾角)」，小倾角下根本读不出体积感，大倾角又会压缩 column 方向的主轴。
相关代码已删，决策记录见
[2026-09-09-stage-3d-motion-design.md](./superpowers/specs/2026-09-09-stage-3d-motion-design.md)（已标作废）。

## URL 分享的两条时序约束

### 首屏必须在模块加载那一刻读地址栏

晚到 `onMounted` 会先闪一帧默认布局，还会让 GSAP Flip 把这一帧当成真实布局变化播一遍过渡。
`useFlexState` 现在用 `decodeOrDefault(location.search)` 在模块级初始化。

### 写回一律防抖 + `replaceState`

拖手柄时宽高每帧都变：

- 不防抖就是每帧一次 `replaceState`，Safari 超量直接抛错
- 用 `pushState` 则调十次属性要按十次后退键才出得去

现在是 `composables/useShareUrl.ts` 防抖 300ms + `replaceState`。

## flex 简写与单项属性对 basis 的分歧

演示区用单项属性渲染（`flex-grow` / `flex-shrink` / `flex-basis`），CSS 区导出的是 `flex` 简写。
2026-09-23 在真实 Chrome（HeadlessChrome/154）里逐个实测：720px 容器里一个 80px 内容的盒子，
分别写 `flex: 2 3 <值>` 与三条单项属性，比较计算值与 `offsetWidth`。

| 类别 | 例子 | 简写 | 单项属性 |
| --- | --- | --- | --- |
| 关键字、长度、百分比、运行期单位、数学函数 | `auto` `content` `0` `100px` `30%` `2em` `10vw` `5ch` `calc()` `min()` `round()` `abs()` | 正常 | 正常，两边一致 |
| 没带单位的非 0 数、拼错的值、负值 | `50` `100pxx` `-10px` `fit-content(100px)` | 整条失效 → `0 1 auto` | 只丢 basis → `2 3 auto` |
| CSS 全局关键字 | `initial` `inherit` `unset` `revert` `revert-layer` | 整条失效 | 只丢 basis |
| 无回退的替换函数 | `var(--x)` `env(x)` `attr(data-x px)` | 计算期整条失效 | 只丢 basis |
| 带回退的替换函数 | `var(--x, 10px)` `env(x, 10px)` `attr(data-x px, 10px)` | 取回退值 | 取回退值，两边一致 |
| `calc-size()` | `calc-size(auto, size)` | `CSS.supports` 为假，整条失效 | 正常生效 |

所以只要收下后四类里的任何一个值，「复制这段 CSS 到项目里」得到的布局就和演示区不一样。
写错的数学函数（`calc(100%-20px)`、`calc(50)`）、小数点结尾的数（`0.`）、首尾带 NBSP 的值也属于「简写整条失效」这一类。现在的规矩：

- 判断在 [basisSyntax.ts](../src/core/basisSyntax.ts)，属性表 basis 条目的 `check` 调它，面板输入框与分享链接解码走同一道关
- **判定是保守的**：只收写法确定合法的子集，拿不准的一律拒。错拒只是少一种写法，错收会让导出的 CSS 整条失效。
  所以 `pi`、`sign()`、省略第二参数的 `round()`、`stretch` 这些 Chrome 其实认的写法也拒——**不要为了「多支持一种写法」放宽判定，除非先在夹具里测过**
- **只去 CSS 空白，不要换回 `trim()`**：`trim()` 连 NBSP 一起去掉，而 CSS 不把 NBSP 当空白，从网页复制来的值常带它
- **替换函数与 `calc-size()` 嵌在哪一层都拒**：只看最外层函数名的话 `calc(var(--x))` 会漏过去
- **带回退的替换函数照样拒**：两边虽一致，但演示区没有可引用的东西，写它等于绕一圈写回退值，只会让人以为本站支持自定义属性
- **`calc-size()` 最初不在拒收清单里**，是实测时发现、按「放进简写也不失效」的同一原则补上的——这类分歧靠读规范推不出来，只能实测
- **不用 `CSS.supports` 做判定**：会让 core 依赖 DOM；happy-dom 测不出真实语义；各浏览器判定不一，同一条分享链接会解出不同状态

守卫在 [basisSyntax.spec.ts](../src/core/basisSyntax.spec.ts)：[basisSyntax.probe.html](../src/core/basisSyntax.probe.html) 在真实 Chrome 里测 1000 个候选值
（全部长度单位与一批非长度单位 × 各种数字写法、写错的数学函数、注入串、各种空白、收下示例的每个打字前缀），
单测断言**分类器收下的每一个都一致**。它钉的是分类器本身：往单位表里加 `fr` 这种改动会让它变红。
最初那版只钉住了例子表，同样的改动全绿——这是一条被变异证实过的瞎守卫，别退回去。

### 新增一类可输入的值之前

1. 把示例加进 [basisSyntax.probe.html](../src/core/basisSyntax.probe.html) 的 `ACCEPTED`（写错的变体加进 `EXPLICIT`），重新生成夹具：

   ```bash
   perl -e 'alarm 40; exec @ARGV' "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --headless=new --disable-gpu --no-first-run --no-default-browser-check --disable-extensions \
     --password-store=basic --use-mock-keychain --virtual-time-budget=5000 \
     --user-data-dir=<临时目录> --dump-dom "file://$PWD/src/core/basisSyntax.probe.html" > out.html
   ```

   从 `out.html` 的 `<pre id="out">` 取出 JSON，每行一个对象写回 [basisSyntax.chrome.json](../src/core/basisSyntax.chrome.json)，
   再跑 `node_modules/.bin/eslint --fix` 统一格式（非 ASCII 空白要写成 `\u00a0` 转义，否则 lint 报错）
2. 再把示例放进 [basisSyntax.spec.ts](../src/core/basisSyntax.spec.ts) 的 `STATIC` / `RUNTIME`，改分类器

顺序反过来，「夹具覆盖了每个收下的示例和它的每个打字前缀」那条守卫会红——它就是为这一步设的。

## i18n 预埋字段：为什么被删净

2026-09-11 决定：站点首版就是纯简体中文单语站，`src/i18n/` 与 `useI18n.ts` 都不建，
界面与规则文案的中文硬编码就是终态、不再有「待抽取」这一步。

当年为它预埋的三个字段已一并删净：

- `PropertyDef.labelKey`——从来没有消费方（面板显示的一直是 `cssName`，CSS 属性名本身不需要翻译）
- `DerivationStep.messageKey`——恒等于 `'derive.' + kind`，纯冗余
- `Diagnostic.messageKey`——恒等于 `'diag.' + rule`，纯冗余

真正的标识 `kind` 与 `rule` 保留。

**将来若重启 i18n，按届时的实际需要重新设计 key 结构，不要考古这批字段名**——
它们是在零消费方的情况下凭空设计的，从未被任何界面验证过。
决策全文见 [2026-09-08-todo-flex-design.md](./superpowers/specs/2026-09-08-todo-flex-design.md) 第 9 节。
