/// <reference types="vitest/config" />
import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import VueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig(({ command }) => ({
  // 开发态也走同一个子路径：分成两套的话，资源路径写死成绝对路径这类缺陷只在构建产物里现形
  base: '/todo-flex/',
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    UnoCSS(),
    Vue({
      // 全站只用 script setup，构建时关掉让压缩器把 Options API 运行时整段删掉；
      // 开发态必须开着：VueDevTools 的组件检查器 Overlay.vue 是 Options API 写的，关掉它的 mounted 不跑，浮层上的检查器按钮就不出现
      features: { optionsAPI: command !== 'build' },
    }),
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
  define: {
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
}))
