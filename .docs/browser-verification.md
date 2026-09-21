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

`resize_window` 在本机不可控：三次请求 1100 / 720 / 500，分别得到 1280 / 1120 / 1920，压不到 768 以下。
因此窄屏（<768px）降级与 `prefers-reduced-motion` 降级两项**无法自动验证**，只能靠人眼。
两项都已核对通过，记录见 [progress.md](./progress.md#人眼核对清单已全部核对通过)——
但这个限制本身不会消失：再动这两处，自动化照样不会报。
