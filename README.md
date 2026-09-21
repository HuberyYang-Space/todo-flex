<h1 align="center">🧭 todo-flex</h1>

<div align="center">
  <b>把「剩余空间」与「尺寸分配」画出来的 CSS Flexbox 交互演示站</b>
</div>

<br/>

<div align="center">
  <a href="https://huberyyang-space.github.io/todo-flex/"><img src="https://img.shields.io/badge/%F0%9F%9A%80-在线演示-0891b2?style=flat-square" alt="在线演示"></a>
  <a href="https://github.com/HuberyYang-Space/todo-flex"><img src="https://img.shields.io/static/v1?label=%F0%9F%8C%9F&message=If%20Useful&style=flat-square&color=BC4E99" alt="star badge"/></a>
  <a href="https://opensource.org/license/MIT"><img src="https://img.shields.io/github/license/HuberyYang-Space/todo-flex?style=flat-square" alt="license"/></a>
</div>

### 💡 说明

一个讲清楚「flex 尺寸是怎么算出来的」的 CSS Flexbox 交互演示站

### ✨ 为什么选择 todo-flex

市面上的 Flexbox 演示工具几乎都在演示「对齐」，而实际开发里的疑难杂症绝大多数出在尺寸侧：

- `flex: 1` 为什么没把空间等分
- `min-width: auto` 为什么让子元素撑爆了容器
- `flex-basis: 0` 和 `auto` 到底差在哪

todo-flex 把这段被浏览器藏起来的计算过程摊开：

- **剩余空间画出来** —— 演示区用斜纹标出 free space 与溢出量，改 `justify-content` 就能看到它怎么被切分
- **理论 vs 实际并排校验** —— 实际值取自浏览器渲染观测，理论值来自零 DOM 依赖的纯函数推导，每行还标出「实际剩余 vs 理论剩余」
- **不一致时指名道姓** —— 两个值对不上时直接说是哪条规则介入了：`min-width: auto` 撑住了内容固有尺寸、`margin: auto` 吃掉了剩余空间、尺寸被某个上下限截断
- **链接即状态** —— 布局实时编码进地址栏，复制链接就把当前画面原样分享出去

演示区是真实 DOM + 真实 CSS flex 渲染，不用 JS 计算盒子位置——所以「把导出的这段 CSS 复制进项目」是真的能复现。

### 🎬 在线体验

<div align="center">
  <a href="https://huberyyang-space.github.io/todo-flex/"><b>👉 huberyyang-space.github.io/todo-flex</b></a>
</div>

### 🎛 能调什么

**容器**：`display` · `flex-direction` · `flex-wrap` · `justify-content` · `align-items` · `align-content` · `row-gap` · `column-gap`，尺寸由右下角手柄拖拽调整

**盒子**：`flex-grow` · `flex-shrink` · `flex-basis` · `order` · `align-self` · 内容固有尺寸 · `min-width: auto` 开关 · `margin: auto` 开关，外加 `flex` 简写预设（`1` / `auto` / `initial` / `none`）

调完即得：右栏实时输出带高亮的 CSS，一键复制。

### 🚀 本地开发

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm test       # 单元测试
pnpm lint       # 代码检查
pnpm build      # 类型检查 + 生产构建
pnpm preview    # 预览生产产物
```

> [!NOTE]
> 站点部署在 GitHub Pages 子路径下，`vite.config.ts` 的 `base` 是 `/todo-flex/`，开发态同样走这个前缀——
> 本地地址是 `http://localhost:5173/todo-flex/`，访问根路径只会拿到 404。

推到 `main` 由 [部署工作流](./.github/workflows/deploy.yml) 自动跑 lint / test / build 并发布。

### 🧱 技术栈

Vue 3（`script setup`）· Vite · TypeScript · UnoCSS · VueUse · GSAP Flip · Shiki · Vitest · [@antfu/eslint-config](https://github.com/antfu/eslint-config)

推导引擎住在 `src/core/`，零 DOM 依赖、连 Vue 都不 import，全部由单元测试驱动——
「理论值」这一侧的可信度就建立在这上面。

---

### 📜 许可证

MIT License © 2026 [Hubery Yang](https://github.com/Hub-yang)
