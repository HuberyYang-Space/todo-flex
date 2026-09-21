/**
 * CSS 代码高亮。
 *
 * 放 visual/ 而不是 core/：core/ 是零 DOM 依赖的推导引擎，高亮属于呈现层。
 *
 * 主题选 github 这一对，是量出来的不是挑好看的：本站面板底色下
 * vitesse-light 有三个 token 够不着 AA 的 4.5（标点 2.85、选择器名 3.58、属性名 3.70），
 * 而选择器名与属性名恰是这个站最该让人读清的两样东西。判据钉在 highlight.spec.ts 里。
 */
import type { HighlighterCore } from 'shiki/core'

let pending: Promise<HighlighterCore> | undefined

/**
 * 高亮器初始化要读语法与主题，只做一次，后续调用复用同一个实例。
 *
 * shiki 整块走动态 import：调用方本来就把高亮当异步的后补结果
 * （`CssOutput.vue` 首帧先渲染纯文本），所以延后加载不改变任何可见行为，
 * 却能把首屏 JS 从 gzip 144 kB 砍到 76 kB。
 */
function getHighlighter(): Promise<HighlighterCore> {
  pending ??= import('./shikiHighlighter').then(m => m.createCssHighlighter())
  return pending
}

/**
 * 把 CSS 源码渲染成带高亮的 HTML。
 *
 * 双主题模式：每个 token 同时带上 `--shiki-light` 与 `--shiki-dark` 两个自定义属性，
 * 由 main.css 决定当前跟哪一个走。单主题模式得在切主题时整段重新高亮，
 * 而本站的主题开关随时可点，重新高亮会让代码块闪一下。
 */
export async function highlightCss(code: string): Promise<string> {
  const highlighter = await getHighlighter()
  return highlighter.codeToHtml(code, {
    lang: 'css',
    themes: { light: 'github-light', dark: 'github-dark' },
    // false 表示不挑一个主题写进 color，两套都只落在自定义属性里，交给 CSS 选
    defaultColor: false,
  })
}
