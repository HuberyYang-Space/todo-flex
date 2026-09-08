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
    fontFamily: {
      mono: '"JetBrains Mono", "SF Mono", "Fira Code", Consolas, monospace',
      sans: '"Inter", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
    },
  },
  shortcuts: [
    ['panel', 'bg-panel border border-bd rounded-2'],
    ['btn', 'px-3 py-1 rounded-2 border border-bd bg-panel cursor-pointer transition-colors hover:border-accent'],
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
