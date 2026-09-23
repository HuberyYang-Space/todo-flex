import {
  defineConfig,
  presetIcons,
  presetWind3,
} from 'unocss'

export default defineConfig({
  theme: {
    colors: {
      // 映射到 main.css 的变量，切换主题时无需重写工具类
      bg: 'var(--bg)',
      fg: 'var(--fg)',
      panel: 'var(--panel)',
      bd: 'var(--border)',
      accent: 'var(--accent)',
      accent2: 'var(--accent-2)',
    },
    spacing: {
      space: 'var(--space)',
      tight: 'var(--space-tight)',
    },
    fontFamily: {
      // 组件 <style> 里的 var(--font-mono) 与工具类 font-mono 必须落在同一套字体上
      mono: 'var(--font-mono)',
      sans: 'var(--font-sans)',
    },
  },
  shortcuts: [
    ['panel', 'bg-panel border border-bd rounded-2'],
    ['panel-title', 'flex items-center gap-tight text-sm font-bold'],
    ['btn', 'px-3 py-1 rounded-2 border border-bd bg-panel cursor-pointer transition-colors hover:border-accent'],
    // text-base 必须写死：图标尺寸是 1.2em，不写就跟着各自父级的字号漂
    ['icon-btn', 'flex items-center justify-center rounded-2 p-1 text-base op-70 cursor-pointer transition-colors hover:op-100 hover:text-accent'],
  ],
  presets: [
    presetWind3(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
  ],
})
