import { afterEach, describe, expect, it, vi } from 'vitest'

// 单独成文件：要换掉 shikiHighlighter 并拿到全新的模块实例，不干扰跑真 shiki 的对比度守卫
describe('高亮器加载失败后的重试', () => {
  afterEach(() => {
    vi.doUnmock('./shikiHighlighter')
    vi.resetModules()
  })

  it('一次失败不会被永久缓存，下一次调用会重新加载', async () => {
    let attempts = 0
    vi.doMock('./shikiHighlighter', () => ({
      createCssHighlighter: async () => {
        attempts += 1
        if (attempts === 1)
          throw new Error('chunk 404')
        return { codeToHtml: (code: string) => `<pre>${code}</pre>` }
      },
    }))
    vi.resetModules()
    const { highlightCss } = await import('./highlight')

    await expect(highlightCss('a{}')).rejects.toThrow('chunk 404')
    await expect(highlightCss('a{}')).resolves.toBe('<pre>a{}</pre>')
    expect(attempts).toBe(2)
  })
})
