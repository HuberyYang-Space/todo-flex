/// <reference types="vitest/config" />
import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import VueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  // 开发态也走同一个子路径：分成两套的话，资源路径写死成绝对路径这类缺陷只在构建产物里现形
  base: '/todo-flex/',
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    UnoCSS(),
    Vue(),
    VueDevTools(),
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
    }),
  ],
  // 全站只用 script setup，关掉开关让压缩器把 Options API 运行时整段删掉
  define: {
    __VUE_OPTIONS_API__: 'false',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  build: {
    modulePreload: { polyfill: false },
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
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
  },
})
