import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

// 工具链自检：确认 vitest + happy-dom + @vue/test-utils 三件套可用
// 后续被 core/deriveLayout 的真实用例取代后可删除
describe('工具链自检', () => {
  it('能挂载组件并读到渲染结果', () => {
    const Demo = defineComponent({
      setup: () => () => h('div', { class: 'flex' }, 'todo-flex'),
    })
    expect(mount(Demo).text()).toBe('todo-flex')
  })
})
