# todo-flex

[![在线演示](https://img.shields.io/badge/%F0%9F%9A%80-在线演示-0891b2?style=flat-square)](https://huberyyang-space.github.io/todo-flex/)
[![star badge](https://img.shields.io/static/v1?label=%F0%9F%8C%9F&message=If%20Useful&style=flat-square&color=BC4E99)](https://github.com/HuberyYang-Space/todo-flex)
[![license](https://img.shields.io/github/license/HuberyYang-Space/todo-flex?style=flat-square)](https://opensource.org/license/MIT)

CSS Flexbox 交互演示站，讲 flex 的尺寸是怎么算出来的。

在线演示：**[huberyyang-space.github.io/todo-flex](https://huberyyang-space.github.io/todo-flex/)**

## 🤔 为什么再做一个

现有的 Flexbox 演示工具几乎都在演示对齐，而开发里真正卡住人的问题大多出在尺寸侧：

- `flex: 1` 为什么没把空间等分
- `min-width: auto` 为什么让子元素撑爆了容器
- `flex-basis: 0` 和 `auto` 到底差在哪

todo-flex 把浏览器藏起来的这段计算摊开：

- 剩余空间用斜纹画在演示区里，改 `justify-content` 就能看到它是怎么被切分的
- 每一行同时给出实际值和理论值：实际值来自浏览器渲染观测，理论值来自一套零 DOM 依赖的纯函数推导
- 两个值对不上时直接说明是哪条规则介入了，`min-width: auto` 撑住了内容固有尺寸、`margin: auto` 吃掉了剩余空间，或者尺寸被某个上下限截断
- 布局实时编码进地址栏，复制链接就能把当前画面原样分享出去

演示区是真实 DOM 加真实 CSS flex 渲染，没有用 JS 去算盒子位置，所以右栏输出的那段 CSS 复制进项目是真能复现的。

如果你只是想看 `justify-content` 的几个取值长什么样，MDN 或 Flexbox Froggy 更快，不必打开它。

## 🎛 能调什么

容器：`display` `flex-direction` `flex-wrap` `justify-content` `align-items` `align-content` `row-gap` `column-gap`，尺寸由右下角手柄拖拽。

盒子：`flex-grow` `flex-shrink` `flex-basis` `order` `align-self`、内容固有尺寸、`min-width: auto` 与 `margin: auto` 开关，另有 `flex` 简写预设（`1` / `auto` / `initial` / `none`）。

调完右栏实时输出带高亮的 CSS，一键复制。

## 🧱 技术栈

Vue 3（`script setup`）· Vite · TypeScript · UnoCSS · VueUse · GSAP Flip · Shiki · Vitest · [@antfu/eslint-config](https://github.com/antfu/eslint-config)

推导引擎住在 [`src/core/`](./src/core)，零 DOM 依赖，连 Vue 都不 import，全部由单元测试驱动。理论值那一侧的可信度就建立在这上面。

## 📜 许可证

MIT License © 2026 [Hubery Yang](https://github.com/Hub-yang)
