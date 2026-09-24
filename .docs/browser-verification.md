# 浏览器验证：为什么不可省，以及本机的八个环境坑

> 什么时候读：动手做任何浏览器验证之前。
> 不读的后果：把 `visibilityState: hidden` 导致的冻帧误判成缺陷（已经踩过两次），
> 或者据着被代理拦成 502 的探活结果去重启 dev server 瞎折腾。

## 一、浏览器验证不可省

M3 有三个 bug 是单元测试原理上抓不到的（happy-dom 没有排版引擎），全靠真实浏览器暴露：

1. 装饰性 border 参与布局，导致诊断层全量误报「有规则介入」
2. `overflow: hidden` 让 `min-width: auto` 完全失效，本站的头号陷阱当场演示不出来
3. 拖拽手柄在 `pointerdown` 里 `preventDefault()`，连带抑制了焦点转移——点完手柄按方向键改的是别处，
   而 Tab 聚焦与单元测试两条路径都照常通过

**凡是涉及演示区布局的改动，跑完 test / lint / build 之后仍需在浏览器里核对明细表的数字。**

斜纹流向那次更极端：错误的前提在单元测试里全绿、在代码注释里论证得很完整，只有真实窗口能证伪它
（详见 [pitfalls.md](./pitfalls.md#斜纹流向元素形状不能承担方向语义)）。

## 二、验证纪律

- **一律以 DOM 状态与 console 输出为准，不以截图为准。** 判断弹窗是否关闭、状态是否重置，
  查元素存在性和事件日志。后台标签页的渲染可能是陈旧帧，截图只作辅助参考，绝不作为结论依据。
- **不要要求用户把标签页切到前台、保持窗口可见或不要遮挡。** 拿不到可信截图就换 DOM 状态验证，
  不要把成本转嫁出去。
- 动效一律让用户自己看——见下面第 1 条，冻帧下量到的动效数据全是假的。

## 三、本机的八个环境坑（每一条都实际踩过）

### 1. Chrome 窗口反复掉回不可见状态

本机那个 Chrome 窗口会反复掉回 `visibilityState: hidden`。一不可见就有三重后果：

- `requestAnimationFrame` 停发，GSAP 时间线与 CSS transition 冻在第一帧——已经因此两次把冻结状态误判成缺陷
- 页面**完全不重绘**，`captureVisibleTab` 返回的是上一帧，改完 DOM 再截图拿到的是旧画面
- 在这种页面里 `await` 一个 rAF 循环会永不 resolve，直接把 CDP `Runtime.evaluate` 拖到超时

所以：**先同步读一次 `document.visibilityState`**（别用 rAF 计数，它自己就会挂），
静态样式改用 `getComputedStyle` 量而不是靠截图。

### 2. 量静态尺寸前必须先注入 `transition: none !important`

否则读到的是冻住的过渡中间值——实测 `--d` 已经是 3px，伪元素的 `width` 还停在 10px。

### 3. GSAP Flip 的内联样式要一并清掉——但别用 `style.cssText = ''`

GSAP Flip 会在 `.stage-item` 上写 `width / height / max-* / min-* / transform` 一整套内联样式，
冻结时全留在中间帧。想量真实布局得把这些内联属性一并清掉，**只清 `transform` 不够**。

> ⚠️ **`el.style.cssText = ''` 会把 Vue 的 `:style` 绑定一起抹掉。**
> `.stage-item` 的内联样式同时是 `itemStyle()` 的出口（`flex` / `order` / `align-self` 都在里面），
> 清空之后盒子退回 `flex: 0 1 auto`，Vue 不重渲染就不会恢复——
> 之后量到的是**被清理动作自己破坏过的布局**，而不是真实布局。
>
> 实际踩到的样子：面板列表行显示 `flex: 1 1 0`，而 `getComputedStyle` 读出来是 `0 1 auto`，
> 本该 1200px 宽的盒子只有 80px。状态与渲染对不上时，先怀疑是不是自己刚把绑定清了。
>
> 正确做法：**逐个删掉 Flip 写的那几个属性**（`el.style.removeProperty('width')` 等），
> 或者干脆先 `location.reload()` 让 Vue 重新渲染一遍再量——窗口可见时动画会自己跑完，
> 多数情况下根本没有残留需要清。

### 4. `localhost:5175` 未必是本项目

本机另一个项目占着 `[::1]:5175`（IPv6），浏览器解析 localhost 会走到它那儿去。
用 `http://127.0.0.1:<port>` 访问，并且认一下页面标题是不是 `todo-flex`。

**另外别漏了路径前缀**：站点部署在 GitHub Pages 子路径下，`base` 是 `/todo-flex/`，
开发态与 `pnpm preview` 同样走这个前缀——访问 `http://127.0.0.1:<port>/todo-flex/`，
根路径只会拿到 404。

### 5. 本机有 HTTP 代理，`curl http://127.0.0.1:<port>` 会被拦成 502

看着就像 dev server 没起来。探活一律加 `--noproxy '*'`，别据此重启服务瞎折腾。

### 6. dev server 头一次用后台任务起可能立刻被 SIGTERM 带走（exit 143）

**内存充足时直接重启一次即可**，不必先去查 OOM。查过一次：`memory_pressure` 报 42% 空闲，与内存无关。

### 7. 探针脚本里不要写依赖 DOM 更新的 `while` 循环

Vue 的 DOM 更新是异步的。`while (删除按钮数量 > 1) 点一下` 这种写法，
循环内重新查询到的还是**这一帧的旧节点**，点击落在已经删掉的那条上，条件永远不变——
死循环直接把渲染进程卡死，CDP 的 `Runtime.evaluate` 45 秒后超时，看起来像是浏览器扩展挂了。
真踩到的话重载标签页即可恢复。

要连续操作就**用固定次数的循环 + 每次 `await` 一次 nextTick**，
或者更省事：直接用分享短码把状态一次性拼进 URL，免掉全部点击。

### 8. 页面里 `await` 长 `setTimeout` 不能跨过 `location.reload()`

会直接报「Inspected target navigated or closed」。要刷新就把刷新和读数拆成两次调用；
改了源码其实靠 Vite HMR 就够，多数时候不需要 reload。

## 四、本机已知的不可控项

claude-in-chrome 的 `resize_window` 在本机不可控：三次请求 1100 / 720 / 500，分别得到 1280 / 1120 / 1920，压不到 768 以下。
窄屏（<768px）与 `prefers-reduced-motion` 两项当年只能靠人眼，记录见 [progress.md](./progress.md#人眼核对清单已全部核对通过)。
**2026-09-24 起这两项可以自动验证了**：改用下面第六节的 CDP 驱动，`Emulation.setDeviceMetricsOverride` 能压到 390px，
`Emulation.setEmulatedMedia` 能切 `prefers-reduced-motion` 与 `prefers-color-scheme`。

## 五、headless Chrome 对拍

判据依赖真实排版（`CSS.supports`、尺寸、断行），又用不着看得见的页面时，直接起一个 headless Chrome 跑探针页。
它不是 claude-in-chrome 插件，不碰用户的标签页，也不需要窗口可见。2026-09-23 的全面 review 靠它做了数千个场景的对拍。

```bash
perl -e 'alarm 40; exec @ARGV' "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-first-run --no-default-browser-check --disable-extensions \
  --password-store=basic --use-mock-keychain --virtual-time-budget=5000 \
  --user-data-dir=<临时目录> --dump-dom "file://<探针页>.html" > out.html
```

探针页把结果写进 `<pre id="out">` 的文本，再从 dump 出的 DOM 里解析；对比推导引擎时，写一个临时 vitest spec
读这份 JSON 调用 `src/core` 的函数。踩过的坑：

1. **不加 `alarm` 会卡住不退出**。退出码 142 是超时信号，结果在那之前已经写完
2. **生成探针页的 heredoc 要加引号**（`<<'EOF'`），否则 JS 模板字符串里的反引号被 shell 当成命令替换，页面悄悄坏掉
3. **结果数量要断言对得上**。有一次页面没重新生成，Chrome 渲染的还是旧场景，差点拿旧数据下结论
4. **探针要先自证**：先跑已知答案——百分比、`calc()` 算出的宽度，或「全部关掉 min-width:auto 时推导引擎应与浏览器一致」
5. **内容块要有高度**：没设高度时每行高 0，按 `offsetTop` 分不出行
6. **用 `stretch` 渲染提取「真实分行」时要去掉 `margin: auto`**：交叉轴上的 auto margin 会让盒子居中，不受 stretch 影响；
   断行不看 auto margin，去掉不改变分行
7. **要搭 app 的真实 DOM 结构**（`.stage-item > .stage-box > .content` 加字母标签，CSS 照搬 DemoStage.vue）。
   简化结构里所有盒子交叉尺寸相同，会掩盖第 6 条那类问题
8. **临时 spec 用完挪出 `src/`**，否则 `pnpm test` 会跑到它
9. **比对 `offset*` 要留 1.5px 容差**：位置与尺寸各自取整，小数排版下会伪装成重叠或回退

## 六、CDP 驱动的 headless Chrome

第五节只能 dump 一次 DOM；要交互、要逐帧采样、要换视口，就用 `--remote-debugging-port` 起 headless Chrome，
Node 24 自带的 `WebSocket` 直接连 CDP，不用装 puppeteer。它的页面是可见的（`visibilityState: visible`），rAF 真跑，
正好补上第三节第 1 条那个窗口掉进 hidden 的坑。2026-09-24 的 M13 遗留排查全靠它，结论见
[progress.md](./progress.md#m13-遗留排查与工程项2026-09-24)。

驱动脚本很短（launch → 找 page target → 连 WebSocket → `send(method, params)`），每次按需重写即可。
开发态直接连 `http://127.0.0.1:<dev 端口>/todo-flex/`；页面里能 `await import('/todo-flex/src/core/urlCodec.ts')`，
用 `encode()` 拼出任意状态的分享链接再导航过去，免掉全部点击。

踩过的坑与用法：

1. **采 GSAP 动画要用 `gsap.ticker.add` 挂采样回调**，不要自己开 rAF。`Timeline.updateRoot` 是模块加载时第一个注册的 ticker 回调，
   后注册的回调排在根时间线渲染之后，采到的就是这一帧最终画出来的状态；自己开的 rAF 可能排在 gsap 前面，
   会采到下一次渲染前就被覆盖掉的中间值。gsap 实例从 `performance.getEntriesByType('resource')` 里找 `deps/gsap.js` 的 URL 再 `import()`，
   与应用用的是同一个模块实例
2. **`Page.addScriptToEvaluateOnNewDocument` 执行时 `document.documentElement` 还是 null**。要观察 `<html>` 的 class，
   得把 `MutationObserver` 挂在 `document` 上（`subtree: true`），再筛 `target === document.documentElement`，否则脚本第一行就抛错，日志是空的
3. **`document.elementFromPoint` 对视口外的点返回 null**。做命中测试前先 `scrollIntoView`，并且断言「总有一部分点命中目标」来自证
4. **判断实际用了哪套字体**：`DOM.getDocument` → `DOM.querySelectorAll` → `CSS.getPlatformFontsForNode`，返回每套平台字体渲染了多少个字形
5. **测首帧闪不闪要用生产构建加限速**：开发态的 CSS 由 JS 注入，本来就闪；`Network.emulateNetworkConditions` 限速让 JS 晚到，
   首帧才可能早于 Vue 挂载。比对 `PerformanceObserver` 的 `first-paint` 时刻与 class 变化时刻
6. **`vite preview` 读 `server.open`**，后台起预览要加 `BROWSER=none`；它的进程名是 `vite.js preview`，
   `pkill -f "vite preview"` 匹配不到，按端口停：`kill $(lsof -t -iTCP:<端口> -sTCP:LISTEN)`
