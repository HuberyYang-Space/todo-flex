import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import pkg from '../package.json'

const html = new DOMParser().parseFromString(readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8'), 'text/html')
const css = readFileSync(resolve(process.cwd(), 'src/styles/main.css'), 'utf-8')

function metaContent(selector: string): string | null {
  return html.querySelector(`meta[${selector}]`)?.getAttribute('content') ?? null
}

function background(selector: string): string | undefined {
  const block = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1]
  return block && /--bg:\s*([^;\s]+)/.exec(block)?.[1]
}

// 分享卡片的文案各自再写一份，改标题或描述时就会漏掉一处；这里钉住它们都取自页面已有的那一份
describe('index.html 的分享与浏览器外观 meta', () => {
  it('og 标题与描述和页面标题、description 一致', () => {
    expect(metaContent('property="og:title"')).toBe(html.title)
    expect(metaContent('property="og:description"')).toBe(metaContent('name="description"'))
  })

  it('og:url 指向 package.json 里的站点地址', () => {
    expect(metaContent('property="og:url"')).toBe(pkg.homepage)
    expect(metaContent('property="og:type"')).toBe('website')
  })

  it('没有预览图，Twitter 用不带大图的 summary 卡片', () => {
    expect(metaContent('name="twitter:card"')).toBe('summary')
  })

  it('浏览器外观色按系统暗亮主题取对应主题的背景色', () => {
    expect(metaContent('name="theme-color"][media="(prefers-color-scheme: light)"')).toBe(background(':root'))
    expect(metaContent('name="theme-color"][media="(prefers-color-scheme: dark)"')).toBe(background('html.dark'))
  })
})
