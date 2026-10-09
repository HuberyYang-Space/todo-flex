# 浏览器验证

> 什么时候读：动手做任何浏览器验证之前，或改了下面「没有自动化守卫的判据」里的东西之后。

happy-dom 不排版，凡是取决于真实排版、字体、绘制顺序的判据，单测原理上抓不到。
真踩过的例子：装饰性 border 让诊断全量误报、`overflow: hidden` 让 `min-width: auto` 失效、标签宽度阈值溢出色块、滚动条样式悄悄失效。
**涉及演示区布局的改动，跑完 test / lint / build 之后仍要在浏览器里核对明细表的数字。**

## 纪律

- **以 DOM 状态与 console 为准，不以截图为准**。后台标签页的渲染可能是陈旧帧。
- **不要求用户把标签页切到前台或保持窗口可见**，拿不到可信截图就换 DOM 验证。
- **探针先自证**：先跑已知答案再看现象。默认状态下剩余空间应为 456px（`720 − 3×80 − 2×12`），明细表 A 行理论 80px、实际 80px。
- **修 bug 前先在真实环境复现缺陷本身**，守卫要见一次当初那个缺陷现场的红。

## 首选：CDP 驱动的 headless Chrome

用 `--remote-debugging-port` 起 headless Chrome，Node 24 自带的 `WebSocket` 直接连 CDP，不用装 puppeteer。
页面 `visibilityState` 是 `visible`、rAF 真跑，视口可用 `Emulation.setDeviceMetricsOverride` 压到 390px，
`Emulation.setEmulatedMedia` 能切 `prefers-reduced-motion` 与 `prefers-color-scheme`。驱动脚本很短（launch → 找 page target → 连 WebSocket → `send`），每次按需重写。

- 开发态连 `http://127.0.0.1:<端口>/todo-flex/`（站点 `base` 是 `/todo-flex/`，根路径只有 404；`localhost` 可能解析到本机别的项目）。
  起服务用 `BROWSER=none pnpm dev --port <端口> --strictPort`，否则会自动开浏览器
- **构造状态不要点界面**：页面里 `await import('/todo-flex/src/core/urlCodec.ts')`，用 `encode()` 拼出分享链接再导航过去。注意链接解码会把越界值夹回属性表的区间（比如容器宽下限 200）
- **改过的模块要从已加载资源里找 URL 再 `import()`**：Vite 热更新后应用引用的是带 `?t=` 的 URL，裸路径拿到另一份模块实例，单例状态是空的。在 `performance.getEntriesByType('resource')` 里按路径找
- **采 GSAP 动画用 `gsap.ticker.add` 挂采样回调**，不要自己开 rAF（可能排在 gsap 前面，采到中间值）；gsap 实例同样从已加载资源里找 `deps/gsap.js`
- **随机扫描要专门造小数排版**（任意整数宽与 gap、`7%` / `33%` 这类 basis）：整数排版下取整类缺陷几乎看不见
- `Page.addScriptToEvaluateOnNewDocument` 执行时 `document.documentElement` 还是 null；`elementFromPoint` 对视口外的点返回 null；
  判断实际用了哪套字体用 `CSS.getPlatformFontsForNode`；测首帧闪不闪要用生产构建加 `Network.emulateNetworkConditions` 限速
- `vite preview` 的进程名是 `vite.js preview`，按端口停：`kill $(lsof -t -iTCP:<端口> -sTCP:LISTEN)`

只要 dump 一次 DOM 的探针页（比如 [basisSyntax.probe.html](../src/core/basisSyntax.probe.html)）用 `--dump-dom`，命令见 [pitfalls.md](./pitfalls.md#新增一类可输入的值之前)。
要点：加 `alarm` 防卡死；生成页面的 heredoc 加引号；断言结果数量对得上；临时 spec 用完挪出 `src/`；比对 `offset*` 留 1.5px 容差。

## 本机的环境坑（每条都踩过）

- **claude-in-chrome 的窗口会掉回 `visibilityState: hidden`**：rAF 停发、动画冻在第一帧、截图是旧帧，已两次把冻结误判成缺陷。先同步读一次 `visibilityState`
- **量静态尺寸前注入 `transition: none !important`**，否则读到过渡中间值
- **清 GSAP Flip 的内联样式要逐个属性清，别用 `style.cssText = ''`**：它会抹掉 Vue 的 `:style` 绑定，盒子退回 `flex: 0 1 auto`，量到的是被自己破坏的布局
- **本机有 HTTP 代理**，`curl http://127.0.0.1:<端口>` 会被拦成 502，探活加 `--noproxy '*'`
- **dev server 头一次用后台任务起可能被 SIGTERM 带走（exit 143）**，直接重启一次即可
- **探针里不要写依赖 DOM 更新的 `while` 循环**：Vue 更新是异步的，重查到的还是旧节点，死循环会卡死渲染进程。用固定次数循环加 `await nextTick`，或直接拼分享链接
- **页面里 `await` 长 `setTimeout` 不能跨过 `location.reload()`**，刷新和读数拆成两次调用
- **claude-in-chrome 的 `resize_window` 不可控**（请求 1100 得到 1280），压视口一律用 CDP

## 没有自动化守卫的判据

改到下面这些东西，单测不会报，要按括号里的方法去浏览器或人眼重新核对：

- **滚动条**（[main.css](../src/styles/main.css) 的 `::-webkit-scrollbar` / `scrollbar-width`）：量 `offsetWidth - clientWidth - 左右边框` 应为 6，见 [pitfalls.md](./pitfalls.md#滚动条标准属性要隔离给-firefox)
- **叠加层行标签的宽度估算**（[OverlayLayer.vue](../src/components/playground/OverlayLayer.vue) `estimateLabelWidth`，Latin-1 以内 0.61 个字号）：量标签实际宽度不超过估值加 8px 留白。分界在 U+00FF 不是 U+007F，「·」是 U+00B7、按半角渲染
- **推导页的折行与面板内滚动**（[DerivationSteps.vue](../src/components/playground/DerivationSteps.vue)）：1024 宽下量各行高度与面板 `scrollHeight`。改列或文案后要重量；2026-10-08 时最长的「分行」一行 121px
- **明细表表头不折行、盒子列表整行可点**：1024 宽下表头每格一行；列表行点击采样不落在 `LI` 上
- **两个页签的表格对齐**（[CompareTable.vue](../src/components/playground/CompareTable.vue)，四列等宽、左对齐、全网格边框）：1024 / 768 / 390 宽下，
  两个页签的表头 `offsetLeft` 逐列相等，面板 `scrollWidth − clientWidth` 为 0。要在**有诊断的状态**下量（容器宽 200、三个盒子内容 120）：
  1024 宽时每列只有约 82px，诊断里的 `min-width:auto` 若改回 `whitespace-nowrap` 会撑出 12px 横向溢出；
  页签面板的 `scrollbar-gutter: stable` 一去掉，只有一边出滚动条时竖线会差 6px
- **演示区按 Delete / Backspace 删除后的焦点**（[DemoStage.vue](../src/components/playground/DemoStage.vue) `removeByKey`）：单测 mock 掉了 Flip，
  因为 happy-dom 里 Flip 拍过快照后 `focus()` 会静默失效。真实 Chrome 里分别打开和关闭 `prefers-reduced-motion`，用 `Input.dispatchKeyEvent` 删除中间的盒子，
  `document.activeElement` 应落到补位的那个盒子；删的是末尾时，应落到新的末尾。去掉接焦点的代码后会掉回 `BODY`
- **窄屏单栏**：390 / 768 宽下整页 `scrollWidth` 等于视口宽，演示区在内部横滚、`.stage` 仍是真实尺寸
- **推导引擎的传递依赖**：7 个推导模块不经 `defaults` 间接依赖属性表，只做过一次性核对
- **观感与动效，只能人眼看**（2026-09 已全部核对通过，改到相关参数要重看）：
  1. 斜纹 2.4s 周期会不会抢戏，亮色下 `--stripe-op` 0.65 更实，风险更高
  2. 悬停时加厚与抬升是否读成一个动作
  3. `stretch` 时顶面伸出容器的观感
  4. 明细面板 208px 高度是否够用
  5. 滚动条 6px 是否偏细
  6. 重排后有没有残留（冻帧下自动化分不清真残留）
  7. 系统「减少动态效果」打开后是否真的静止
  8. 等距实体块：默认态读作左上打光；gap 0 时相邻方块的面不重叠；column 下顶面不打架；换行时跨行不互压；选中后三个面一起转成紫色
