# 打包体积

> 什么时候读：想再压首屏体积、或想动 shiki / gsap 的引入方式之前。
> 不读的后果：把三条量过没收益的路再走一遍，它们各自都长得像稳赚不赔。

## 现状

预算：首屏 JS ≤ 150 kB gzip。2026-10-08 主包 220.8 kB / gzip 83.8 kB，懒加载的 shiki 232.6 kB / gzip 68.7 kB。
（2026-09 优化前是单个 chunk，gzip 144.25 kB；优化后 73.65 kB，之后随功能增长到现在的数字。）

## 做了的三件事

1. **shiki 整块懒加载**（收益的 96%）：[CssOutput.vue](../src/components/playground/CssOutput.vue) 首帧本来就先渲染纯文本、拿到高亮再替换，延后加载不改变可见行为。
   **切法是关键**：实现体单独放进 [shikiHighlighter.ts](../src/visual/shikiHighlighter.ts)，由 [highlight.ts](../src/visual/highlight.ts) 动态 import 这一个子模块，整棵依赖树切成 1 个 chunk。
   在 `highlight.ts` 里直接写 5 个 `import()` 会散成 5 个 chunk、gzip 多 1.6 kB；用 `advancedChunks` 手工分组更大、还要手写包名正则。
   所以 `vite.config.ts` 里**没有** chunk 分组配置——量过之后不要，不是漏了
2. **Vue 编译期开关全关**（`__VUE_PROD_DEVTOOLS__` 等一律 `'false'`）：全站只用 script setup，gzip −1.78 kB。
   例外是 Options API：由 plugin-vue 的 `features.optionsAPI` 控制，**只在构建时关**，构建产物与全关时逐字节一致。
   开发态不能关：VueDevTools 的组件检查器 `Overlay.vue` 是 Options API 写的，一关它的 `mounted` 不跑，浮层上「选中组件跳转编辑器」的按钮就整个消失，且不报任何错
3. **`modulePreload: { polyfill: false }`**：gzip −0.27 kB，modulepreload 只是加载提示，没有功能损失

## 试过没用的三条（别再走）

- **`@shikijs/langs-precompiled` + `createJavaScriptRawEngine`**：预编译语法照样 import `oniguruma-to-es`，没能 tree-shake 掉；预编译的 css 语法本身还更大，首屏只 −0.1 kB，已卸载
- **`build.cssMinify: 'lightningcss'`**：CSS 从 24.32 kB 涨到 25.36 kB，它按默认 targets 把现代语法降级展开了
- **`build.target: 'es2022'`**：JS 产物一个字节都没变，依赖本来就是现代语法

## 没做的一笔：gsap 懒加载

gsap 占首屏 gzip 约 36 kB。Flip 只在状态变化时播，首屏那一帧按设计本来就不播过渡，所以可以模块加载时发起 `import('gsap')` 不阻塞，
`watch` 回调里若还没到就跳过这次动画。**代价**：网络差时第一次操作可能没有动画；`Flip.getState()` 必须同步跑在 DOM 更新之前，拿不到只能降级。行为改动，等真需要再决定。
