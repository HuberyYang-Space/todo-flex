# 踩坑档案：禁令背后的论证

> 什么时候读：[CLAUDE.md](../CLAUDE.md) 里某条禁令你想推翻、或想不通它为什么存在的时候。
> 禁令本身在 CLAUDE.md，这里只回答「为什么」。

## 等距实体块

### 为什么是这个方案

演示区方块定案为**等距实体块**：顶面与右侧面是 `.stage-box` 的两个伪元素画的二维平行四边形（`skewX` / `skewY`）。之前三条路都走死了：

- **CSS 3D transform**：面垂直于视线，投影高度只有「厚度 × sin(倾角)」，小倾角读不出体积，大倾角压缩 column 方向的主轴。等距投影的面要当二维平行四边形直接画，不进 3D 空间
- **只换表面材质**（玻璃、黏土、霓虹、渐变，13 个方案）与**只做光学**（菲涅尔边、扫光，12 个方案）：读起来仍是一个平面

实体成立的三个必要条件：看得见的第二个面；统一的左上光源（顶面最亮、正面居中、右侧面最暗）；
接触阴影（五层投影、模糊值倍增，第一层紧而暗）。外层 `.stage-item` 的 `transform` 归 GSAP Flip 所有，**一切视觉与形变只写在内层 `.stage-box`**。

### 厚度公式

厚度 `--d` 由 `DemoStage` 下发：`Math.max(blockDepthMin, Math.min(blockDepth, min(rowGap, columnGap) - 2))`，下限 3px、上限 10px，悬停 / 按下用倍率 `--d-k` 缩放。
`gap < 5` 时下限生效、厚度大于间距，相邻行会互相遮住——这是对的：等距投影里靠下即靠前，DOM 靠后的盒子画在上面，遮挡方向正确。

**`--d` 不能自引用**：`--d: calc(var(--d) + 3px)` 整条声明被丢弃且不报错，要改厚度改 `--d-k`。

### 三个面必须从同一个体色派生

顶面加白、右侧面加黑、正面走 `white 8%` → `black 6%` 的渐变，全部从 `--face` 派生；选中态只换 `--face`，不重写 `background`。
任何一个面直接跟 `--accent` 调色，明暗方向就取决于 `accent` 与 `panel` 谁更亮——亮色主题下 `panel` 是白的，
实测正面 0.79 > 顶面 0.67，正面渐变还会翻成上暗下亮（0.591 → 0.697），读作光从下面来。**两次都只在亮色主题下出现。**

### 伸出去的面靠 overhang 兜住，不是靠滚动容器的内边距

顶面上伸、右侧面右伸，裁掉它们的是 `ThePlayground.vue` 里的外层 `.overflow-auto`；`align-items: stretch` 下盒子贴着容器上沿，裁切每次都发生。
兜住它们的是 `.stage-wrapper` 的外边距 `--overhang`（`motion.stageOverhang`，32px），按悬停总伸出量算：顶面厚度 × `blockDepthHover` + `liftHeight` + 放大量。
`DemoStage.spec.ts` 钉着「overhang ≥ 这个总和」，改 `blockDepth` / `liftHeight` / `blockDepthHover` 会让它变红。

用外边距而不是内边距：叠加层相对 `.stage-wrapper` 绝对定位，wrapper 一有内边距，叠加层就错位。

早先滚动容器的 padding 扛过这件事，`--overhang` 落地后它成了第二份留白（左侧留白 56px、上侧 44px，删掉后 40 / 32），防裁切能力一点没增加。
余量不够就调 `stageOverhang`，不要把 padding 加回来——同一件事拆到两个文件各写一半，下次谁都不知道该改哪个。`ThePlayground.spec.ts` 拦着这层的任何内边距类。

`stretch` 时 10px 的顶面会画到容器外面（容器不能加 padding，红线 6），这是有意的，观感已人眼核对。

## 斜纹流向：元素形状不能承担方向语义

曾经只做两份 45° 斜纹，把方向感交给色块长宽比：row 下宽扁读作横向流，column 下高瘦读作纵向流。
**长宽比取决于「剩余空间量 vs 交叉轴尺寸」，跟 `flex-direction` 不相干**：column 默认三盒时色块是 720×56 的横条，row 六个盒子时是 180×320 的竖条，两个方向都读反。

现在是「流动轴 × 流向」四份 pattern，纹路朝向由 `OverlayBand.flowAxis` 决定：x 轴垂直纹路左右平移，y 轴靠 `patternTransform="rotate(90)"` 转成水平纹路。
旋转把 pattern 的坐标系一起转了，同一条 `translateX(8px)` 在 y 轴 pattern 里就是向下，一套 keyframes 管四份。

> 通用教训：不要让「元素形状」承担方向语义。形状是布局算出来的，随内容随时翻转。

## 滚动条：标准属性要隔离给 Firefox

全局滚动条对齐 Element Plus 的 `el-scrollbar`（6px、4px 圆角、滑块 `#909399` 30% → 悬停 50%）。
第一版把 `scrollbar-width: thin` 写在 `*` 上，**Chrome 一见到标准属性就整个忽略 `::-webkit-scrollbar`**，滚动条退回自带样式、实测只占 2px。
规则全在构建产物里、单测也不报，只有真实渲染量得出来。现在用 `@supports not selector(::-webkit-scrollbar)` 把标准属性隔离给 Firefox。
这条没有自动化守卫，改动后去浏览器量一次 `offsetWidth - clientWidth - 左右边框`。

## 暗亮主题：只能算不能看的缺陷

站点默认暗色，亮色的问题一直被默认值盖住。把两套主题的变量代进 sRGB 插值与 WCAG 相对亮度算出过六处不达标，没有一条是「看」出来的。
判据钉在 [theme.spec.ts](../src/styles/theme.spec.ts)，它先用已知值自校验（黑白 21:1、`#767676` 白底 4.54:1）。

- **`-k` / `-op` 参数不是冗余**：描边亮色底要上满 100% 才有 3:1，暗色 55% 已有 3.68、上满刺眼；斜纹亮色 0.35 只有 1.46 几乎看不见，要 0.65，暗色 0.35（2.20）再高就抢戏
- **斜纹不透明度写在 CSS 里**：原来写在 `<line>` 的 `stroke-opacity` 上，SVG 属性跟不了 `html.dark`
- **接触阴影挪到方块底缘**：暗色台面亮度只有 0.015，落在台面上的黑影对比度仅 1.12，提亮台面上限也才 1.42；
  改由正面底缘的 inset 暗边承担（暗 1.65 / 亮 3.03）。台面的五层投影负责环境光衰减，一层不动
- **代码高亮主题是算出来选的**：vitesse 在亮色面板上有三个 token 不到 AA（标点 2.85、选择器 3.58、属性名 3.70），
  24 个主题跑下来改用 `github-light` / `github-dark`（最低 4.57 / 6.88），判据在 [highlight.spec.ts](../src/visual/highlight.spec.ts)

## URL 分享的两条时序约束

### 首屏必须在模块加载那一刻读地址栏

晚到 `onMounted` 会先闪一帧默认布局，还会让 GSAP Flip 把这一帧当成真实布局变化播一遍过渡。`useFlexState` 在模块级用 `decodeOrDefault(location.search)` 初始化。

### 写回一律防抖 + `replaceState`

拖手柄时宽高每帧都变：不防抖就是每帧一次 `replaceState`，Safari 超量直接抛错；用 `pushState` 则调十次属性要按十次后退键。现在是 `useShareUrl` 防抖 300ms + `replaceState`。

## flex 简写与单项属性对 basis 的分歧

演示区用单项属性渲染，CSS 区导出 `flex` 简写。真实 Chrome 实测（720px 容器里一个 80px 内容的盒子，`flex: 2 3 <值>` 对比三条单项属性）：

| 类别 | 例子 | 简写 | 单项属性 |
| --- | --- | --- | --- |
| 关键字、长度、百分比、运行期单位、数学函数 | `auto` `0` `100px` `30%` `2em` `10vw` `calc()` | 正常 | 正常，两边一致 |
| 没带单位的非 0 数、拼错的值、负值 | `50` `100pxx` `-10px` | 整条失效 → `0 1 auto` | 只丢 basis → `2 3 auto` |
| CSS 全局关键字 | `initial` `inherit` `unset` | 整条失效 | 只丢 basis |
| 无回退的替换函数 | `var(--x)` `env(x)` | 计算期整条失效 | 只丢 basis |
| 带回退的替换函数 | `var(--x, 10px)` | 取回退值 | 取回退值，两边一致 |
| `calc-size()` | `calc-size(auto, size)` | 整条失效 | 正常生效 |

收下后四类任何一个值，导出的 CSS 就复现不出演示区。写错的数学函数（`calc(100%-20px)`）、小数点结尾的数（`0.`）、首尾带 NBSP 的值同属「简写整条失效」。规矩：

- 判断在 [basisSyntax.ts](../src/core/basisSyntax.ts)，属性表 basis 条目的 `check` 调它，面板输入框与分享链接解码走同一道关
- **判定是保守的**：只收写法确定合法的子集，拿不准就拒。错拒只少一种写法，错收会让导出的 CSS 整条失效；不要为了多支持一种写法放宽，除非先在夹具里测过
- **只去 CSS 空白，不要换回 `trim()`**：`trim()` 连 NBSP 一起去掉，而 CSS 不把 NBSP 当空白
- **替换函数与 `calc-size()` 嵌在哪一层都拒**：只看最外层函数名，`calc(var(--x))` 会漏过去
- **带回退的替换函数照样拒**：演示区没有可引用的东西，写它只会让人以为本站支持自定义属性
- **不用 `CSS.supports` 判定**：会让 core 依赖 DOM，happy-dom 测不出真实语义，各浏览器判定不一

守卫在 [basisSyntax.spec.ts](../src/core/basisSyntax.spec.ts)：[探针页](../src/core/basisSyntax.probe.html)在真实 Chrome 里测 1000 个候选值，
夹具是 [basisSyntax.chrome.json](../src/core/basisSyntax.chrome.json)，单测断言分类器收下的每一个两边都一致——往单位表里加 `fr` 会让它变红。
最初那版只钉住了例子表，同样的改动全绿，别退回去。

### 新增一类可输入的值之前

1. 把示例加进探针页的 `ACCEPTED`（写错的变体加进 `EXPLICIT`），重新生成夹具：

   ```bash
   perl -e 'alarm 40; exec @ARGV' "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --headless=new --disable-gpu --no-first-run --no-default-browser-check --disable-extensions \
     --password-store=basic --use-mock-keychain --virtual-time-budget=5000 \
     --user-data-dir=<临时目录> --dump-dom "file://$PWD/src/core/basisSyntax.probe.html" > out.html
   ```

   从 `out.html` 的 `<pre id="out">` 取出 JSON，每行一个对象写回 basisSyntax.chrome.json，再跑 `node_modules/.bin/eslint --fix`（非 ASCII 空白写成 ` `）
2. 再把示例放进 basisSyntax.spec.ts 的 `STATIC` / `RUNTIME`，改分类器

顺序反过来，「夹具覆盖了每个收下的示例和它的每个打字前缀」那条守卫会红——它就是为这一步设的。

## i18n 预埋字段：为什么被删净

站点是纯简体中文单语站，中文硬编码就是终态。当年为 i18n 预埋的 `PropertyDef.labelKey`（从无消费方）、
`Diagnostic.messageKey`（恒等于 `'diag.' + rule`）等字段已删净，真正的标识 `rule` 保留。
**将来若重启 i18n，按届时需要重新设计 key 结构，不要考古这批字段名**——它们是在零消费方的情况下凭空设计的。
