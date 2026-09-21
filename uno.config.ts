import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetWind3,
} from 'unocss'

export default defineConfig({
  theme: {
    colors: {
      // 与 src/styles/main.css 的 CSS 变量对应，切换暗/亮色时无需重写工具类
      bg: 'var(--bg)',
      fg: 'var(--fg)',
      panel: 'var(--panel)',
      bd: 'var(--border)',
      accent: 'var(--accent)',
      accent2: 'var(--accent-2)',
    },
    spacing: {
      // 与 src/styles/main.css 的间距变量对应：p-space / gap-space / mb-space / gap-tight
      space: 'var(--space)',
      tight: 'var(--space-tight)',
    },
    fontFamily: {
      mono: '"JetBrains Mono", "SF Mono", "Fira Code", Consolas, monospace',
      sans: '"Inter", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
    },
  },
  shortcuts: [
    ['panel', 'bg-panel border border-bd rounded-2'],
    // 全站标题只有这一种写法：icon 在左、文字在右、gap 走紧凑档
    ['panel-title', 'flex items-center gap-tight text-sm font-bold'],
    ['btn', 'px-3 py-1 rounded-2 border border-bd bg-panel cursor-pointer transition-colors hover:border-accent'],
    /*
     * 只有图标、没有边框的按钮。留出 p-1 而不是贴着图标裁——
     * 点击热区要够得着，无边框按钮本来就少了一圈可瞄准的轮廓。
     * 用 op 而不是换色做静默态：图标是单色 mask，降透明度才不会和主题色打架。
     * text-sm 是为了让图标落在 16.8px（presetIcons 的 scale 是 1.2em），
     * 和 panel-title 里的图标一样大——不写就跟着各自父级的字号漂。
     */
    ['icon-btn', 'flex items-center justify-center rounded-2 p-1 text-sm op-70 cursor-pointer transition-colors hover:op-100 hover:text-accent'],
  ],
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
  ],
})
