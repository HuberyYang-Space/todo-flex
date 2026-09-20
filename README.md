<h4 align='center'>
🧭 An interactive CSS Flexbox playground that visualizes free space and size distribution | 把「剩余空间」与「尺寸分配」画出来的 CSS Flexbox 交互演示站
</h4>

## 这个站点解决什么问题

市面上的 Flexbox 演示工具都在演示「对齐」，却没有一个讲清楚「尺寸是怎么算出来的」。
而实际开发中的 flex 疑难杂症，绝大多数出在尺寸侧：`flex: 1` 为什么不等分、
`min-width: auto` 为什么让子元素撑爆容器、`flex-basis: 0` 和 `auto` 到底差在哪。

todo-flex 把这段被隐藏的计算过程显式画出来：

- **剩余空间可视化** —— 演示区里用色块画出 free space，`justify-content` 一变就能看到它怎么被切分
- **分配公式展开** —— 选中某个盒子，展示 `剩余空间 × grow 占比 → 最终尺寸` 的完整推导
- **理论 vs 实际校验** —— 真实渲染尺寸来自浏览器观测，理论值来自纯函数推导；两者不一致时高亮解释是哪条规则介入了
- **链接即状态** —— 布局实时编码进地址栏，复制链接就能把当前画面原样分享出去

演示区是真实 DOM + 真实 CSS flex 渲染，不用 JS 模拟盒子位置——所以「把这段 CSS 复制到项目里」这句承诺是成立的。

## 技术栈

Vue 3 (script setup) · Vite · TypeScript · UnoCSS · VueUse · GSAP (Flip) · Vitest · @antfu/eslint-config

## 开发

```bash
pnpm install
pnpm dev        # 开发
pnpm test       # 单元测试
pnpm lint       # 代码检查
pnpm build      # 类型检查 + 生产构建
```

## License

[MIT](./LICENSE)
