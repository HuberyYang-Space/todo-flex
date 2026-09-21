# 打包体积：手上这一版的实测数字，以及三条试过没用的路

> 什么时候读：想再压首屏体积、或者想动 shiki / gsap 的引入方式之前。
> 不读的后果：把下面三条已经量过没收益的路再走一遍（`langs-precompiled`、`lightningcss`、
> 抬高 `build.target` 各自都长得很像稳赚不赔）。

## 一、基线与现状

优化前是单个 chunk，全部依赖一起挡在首屏前面：

| | 优化前 | 优化后 |
| --- | --- | --- |
| 首屏 JS | 431.39 kB / gzip **144.25 kB** | 194.33 kB / gzip **73.65 kB** |
| 懒加载 shiki | —— | 232.62 kB / gzip 68.66 kB |
| CSS | 24.32 kB / gzip 6.25 kB | 不变 |
| 构建耗时 | 556 ms | 499 ms |

首屏 gzip 降 48.9%。产物成分（压缩前 rendered，用 rolldown 的 `generateBundle` 逐模块累加量的）：

| 来源 | 体积 | 占比 |
| --- | --- | --- |
| shiki 全家（core / vscode-textmate / langs / themes / oniguruma-to-es …） | ~356 kB | 45% |
| gsap（gsap-core 107 + CSSPlugin 42 + Flip 37 + matrix 9） | 196 kB | 25% |
| vue runtime（runtime-core 92 + reactivity 39 + runtime-dom 14） | ~145 kB | 18% |
| src | 64 kB | 8% |

## 二、做了的三条

### 1. shiki 整块懒加载（这一笔占了全部收益的 96%）

`highlightCss` 的调用方本来就把高亮当异步后补结果——[`CssOutput.vue`](../src/components/playground/CssOutput.vue)
首帧先渲染未高亮的纯文本，拿到结果再替换。所以延后加载不改变任何可见行为。

**关键是切法，不是要不要切。** shiki 的实现体单独放进
[`src/visual/shikiHighlighter.ts`](../src/visual/shikiHighlighter.ts)，由
[`highlight.ts`](../src/visual/highlight.ts) 动态 import 这一个子模块：

- 这样切 → 整棵依赖树当一个整体切走，**1 个 chunk / 232.62 kB / gzip 68.66**
- 在 `highlight.ts` 里直接写 5 个 `import()`（core、引擎、语法、两套主题）
  → 散成 **5 个 chunk / 合计 gzip 72.69**，多 4 个请求还大 1.6 kB
- 用 `build.rolldownOptions.output.advancedChunks` 手工把 shiki 系包分一组
  → **241.03 kB / gzip 71.05**，比子模块法还大，而且那条 `test` 正则要手写一串包名，脆

所以 `vite.config.ts` 里**没有**任何 chunk 分组配置——不是漏了，是量过之后不要。

### 2. Vue 编译期开关全关

`define` 里 `__VUE_OPTIONS_API__` / `__VUE_PROD_DEVTOOLS__` /
`__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` 一律 `'false'`，让压缩器把对应分支整段删掉。
全站只用 script setup（grep 过，零 `defineComponent` 与 `export default {}`），实测 −4.70 kB / gzip −1.78 kB。

### 3. `modulePreload: { polyfill: false }`

−0.53 kB / gzip −0.27 kB。modulepreload 只是加载提示，不支持的浏览器忽略它就是了，
模块图照样靠 import 语句加载，没有功能损失。

## 三、试过没用的三条（别再走一遍）

### `@shikijs/langs-precompiled` + `createJavaScriptRawEngine`

预期：预编译语法自带编译结果，能把 `oniguruma-to-es`（44.9 kB）加 `oniguruma-parser`（29.5 kB）
加 `regex*`（15 kB）整条链干掉。

实测：**净收益为零，还倒亏。** 预编译语法文件开头就是 `import { EmulatedRegExp } from 'oniguruma-to-es'`，
那个包没能 tree-shake 掉转换器部分，照样进来 55.96 kB（原方案的 JS 引擎 chunk 是 57.63 kB）；
而预编译的 css 语法本身 52.82 kB，比原版 49.03 kB 还大 3.8 kB。多一个依赖，换首屏 −0.1 kB。**已卸载。**

### `build.cssMinify: 'lightningcss'`

实测 CSS **从 24.32 kB 涨到 25.36 kB**。它按默认 targets 把现代语法降级展开了。
本站 CSS gzip 后只有 6.25 kB，天花板本来就低，不值得为它配一套 targets 再调。

### `build.target: 'es2022'`

实测 JS 产物**一个字节都没变**。默认的 `baseline-widely-available` 不是瓶颈
（依赖本身就已经是现代语法），抬 target 只是白白牺牲兼容性。
当初那次 −0.53 kB 全部来自上面第 3 条，与 target 无关——两条分开量过。

## 四、还没做的那一笔：gsap 懒加载

gsap 是首屏剩下 194 kB 里的 93.76 kB（gzip 35.81 kB，用 `advancedChunks` 单独切出来量的）。
技术上可以挪走：Flip 只在状态变化时播，而首屏那一帧按设计本来就不许播过渡
（见 [CLAUDE.md](../CLAUDE.md#状态与时序) 首屏那条）。做法是模块加载时就发起 `import('gsap')` 但不阻塞启动，
`watch` 回调里若还没到就跳过这次动画、布局照常变。首屏能再降到 gzip ≈ 38 kB。

**代价**：网络很差时用户的第一次操作可能没有动画。这是行为改动而不是打包配置调整，
`Flip.getState()` 必须同步跑在 DOM 更新之前（`flush: 'pre'`），拿不到就只能降级。
所以单独列着，等真需要再决定。

## 五、验证记录

单测 276 条全绿、eslint 无输出、`vue-tsc --noEmit` + `vite build` 通过。另外两条：

**守卫的变异验证。** [`CssOutput.spec.ts`](../src/components/playground/CssOutput.spec.ts)
那条高亮守卫原来一次 `flushPromises()` 就断言，动态 import 比微任务队列长，拍到的是未高亮首帧，
所以改成 `vi.waitFor` 轮询。改完按规矩让它见了一次红：把 `highlightCss` 改成
`return code || highlighter.codeToHtml(...)`（`diff` 确认变异确实落在被断言的那行），该条超时变红，还原后恢复绿。

**浏览器实测**（`pnpm preview` 跑生产产物，`http://127.0.0.1:4173`，
`document.visibilityState === 'visible'` 已确认，不是冻帧）：

1. 两个 chunk 确实分开走网络：`index` 72979 B 于 33 ms 起、`shikiHighlighter` 68015 B 于 100 ms 起，
   传输字节数与构建报告的 gzip 数字对得上
2. 高亮照常落地：`.shiki` 根节点在，57 个带内联样式的 token，`--shiki-light` 与 `--shiki-dark` 两套都在
3. 交互照常：点 `space-between` 后 CSS 重新生成并重新高亮，地址栏短码跟着变，
   720 px 容器里三个 80 px 盒子的 `offsetLeft` 量到 0 / 320 / 640（480 px 剩余空间均分成两段 240），GSAP Flip 无异常
4. console 零消息——并且先注入过一条 `console.error` 金丝雀确认读取通道是通的，
   不是工具哑了读成的「干净」
