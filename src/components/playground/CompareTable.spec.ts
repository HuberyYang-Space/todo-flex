import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CompareTable from './CompareTable.vue'

describe('compareTable', () => {
  it('按传入顺序渲染四列表头', () => {
    const wrapper = mount(CompareTable, { props: { headers: ['步骤', '公式', '代入', '结果'] } })

    expect(wrapper.findAll('thead th').map(th => th.text())).toEqual(['步骤', '公式', '代入', '结果'])
  })

  it('行内容由调用方经默认插槽放进 tbody', () => {
    const wrapper = mount(CompareTable, {
      props: { headers: ['#', '理论', '实际', '诊断'] },
      slots: { default: '<tr data-testid="slot-row"><td>A</td><td>1</td><td>2</td><td>✓</td></tr>' },
    })

    expect(wrapper.find('tbody [data-testid="slot-row"]').exists()).toBe(true)
  })
})
