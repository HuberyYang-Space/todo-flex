/**
 * shiki 高亮器的实现体，独立成一个模块**只为了打包**：
 * [highlight.ts](./highlight.ts) 动态 import 它，整棵 shiki 依赖树（约 241 kB）
 * 就整块落进一个懒加载 chunk，不进首屏。
 *
 * 不把这几行直接写成 `highlight.ts` 里的多个 `import()`：那样 shiki core、
 * 正则引擎、语法、两套主题会各自成 chunk（实测散成 5 个请求且合计还大 1.6 kB gzip），
 * 而静态 import 一个子模块能让打包器把整棵树当一个整体切走。
 *
 * 用 shiki 的细粒度打包（core + 单语法 + 双主题）而不是默认整包：
 * 整包带上全部语法与主题有几 MB，而本站只需要 css 一种语法。
 * 正则引擎选 JS 版而不是 oniguruma，省掉一份 WASM 的加载与体积。
 * （试过 `@shikijs/langs-precompiled` + raw 引擎想再省掉 `oniguruma-to-es`，
 * 实测它照样被 `EmulatedRegExp` 拖进来，预编译语法本身还更大，净收益为零。）
 */
import css from '@shikijs/langs/css'
import githubDark from '@shikijs/themes/github-dark'
import githubLight from '@shikijs/themes/github-light'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

export function createCssHighlighter() {
  return createHighlighterCore({
    langs: [css],
    themes: [githubLight, githubDark],
    engine: createJavaScriptRegexEngine(),
  })
}
