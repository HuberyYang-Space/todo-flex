/**
 * 主题选 github 这一对是量出来的：本站面板底色下 vitesse-light 的选择器名与属性名
 * 够不着 AA 的 4.5，而它们恰是这个站最该让人读清的。判据钉在 highlight.spec.ts 里。
 */
import type { HighlighterCore } from 'shiki/core'

let pending: Promise<HighlighterCore> | undefined

/** 整块动态 import：调用方首帧本就先渲染纯文本，延后加载不改变可见行为，却能把 shiki 移出首屏 */
function getHighlighter(): Promise<HighlighterCore> {
  // 加载失败（常见于发版后旧 chunk 已下线）时清掉缓存，下一次调用才会重试，而不是永远拿到同一个 rejection
  pending ??= import('./shikiHighlighter')
    .then(m => m.createCssHighlighter())
    .catch((error: unknown) => {
      pending = undefined
      throw error
    })
  return pending
}

/**
 * 双主题模式：每个 token 同时带 `--shiki-light` 与 `--shiki-dark`，由 main.css 挑一套。
 * 单主题模式切主题时得整段重新高亮，代码块会闪一下。
 */
export async function highlightCss(code: string): Promise<string> {
  const highlighter = await getHighlighter()
  return highlighter.codeToHtml(code, {
    lang: 'css',
    themes: { light: 'github-light', dark: 'github-dark' },
    // 不把任何一套写进 color，两套都只落在自定义属性里
    defaultColor: false,
  })
}
