/// <reference types="vitest/config" />
import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import VueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  /*
   * 站点部署在 GitHub Pages 的子路径 https://huberyyang-space.github.io/todo-flex/ 下。
   *
   * 不按 command 分成开发 '/' 与构建 '/todo-flex/' 两套：那样「资源路径写死成绝对路径」
   * 这类缺陷只在构建产物里现形，开发时一路绿灯。开发态也走同一个子路径，
   * 代价只是本地地址多一段前缀。
   */
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
  /*
   * Vue 的编译期开关全关，让压缩器把对应分支整段删掉。
   * 本站只用 script setup，Options API 那套运行时是纯死码（实测省 4.7 kB）。
   */
  define: {
    __VUE_OPTIONS_API__: 'false',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  build: {
    // modulepreload 只是加载提示，不支持的老浏览器忽略它即可，不必为此背一段 polyfill
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
    // 推导引擎是纯函数，默认跑在 node 环境；组件测试用 happy-dom
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
  },
})
