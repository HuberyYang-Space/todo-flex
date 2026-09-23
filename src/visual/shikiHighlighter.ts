/**
 * 独立成模块只为了打包：highlight.ts 动态 import 它，整棵 shiki 依赖树就整块落进一个懒加载 chunk。
 * 写成 highlight.ts 里的多个 `import()` 会散成 5 个 chunk，合计反而更大。
 * 细粒度引入（core + 单语法 + 双主题 + JS 正则引擎）而非整包，省掉几 MB 语法与 WASM。
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
