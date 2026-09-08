/// <reference types="vitest/config" />
import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import VueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    UnoCSS(),
    Vue(),
    VueDevTools(),
    Icons({
      autoInstall: true,
    }),
    AutoImport({
      imports: [
        'vue',
        '@vueuse/core',
      ],
      dts: true,
      vueTemplate: true,
      dirs: ['./src/composables'],
    }),
    Components({
      dts: true,
      resolvers: [
        IconsResolver({
          enabledCollections: ['carbon'],
        }),
      ],
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        minify: {
          compress: {
            dropConsole: true,
            dropDebugger: true,
          },
        },
      },
    },
  },
  server: {
    open: true,
    host: true,
  },
  test: {
    // 推导引擎是纯函数，默认跑在 node 环境；组件测试用 happy-dom
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
  },
})
