import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { readSfcStyle } from '~/test/sfcStyle'
import CompareTable from './CompareTable.vue'

const STYLE = readSfcStyle('src/components/playground/CompareTable.vue')

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

  /*
   * 页签面板是滚动容器，行一多只让表体滚、表头钉在顶上。happy-dom 不排版，只能读样式断言；
   * 同时挂载确认这条规则真的落在表头单元格上，而不只是样式表里有这么一条。
   */
  it('表头吸顶，滚动时只有表体在走', () => {
    expect(STYLE.decl('.compare-table th', 'position')).toBe('sticky')
    expect(STYLE.decl('.compare-table th', 'top')).toBe('0')
    // 单元格里的 op-70 会建层叠上下文，与 z-index: auto 的吸顶表头同层、按文档顺序后画，压在表头上
    expect(Number(STYLE.decl('.compare-table th', 'z-index'))).toBeGreaterThanOrEqual(1)

    const wrapper = mount(CompareTable, { props: { headers: ['#', '理论', '实际', '诊断'] } })
    expect(wrapper.get('table').classes()).toContain('compare-table')
    expect(wrapper.findAll('table thead th')).toHaveLength(4)
  })

  // collapse 模型下边框归表格统一画，吸顶的表头单元格只带走背景，表头那两条横线留在原地随表体滚走
  it('表格用分离边框模型，吸顶时表头带着自己的边框走', () => {
    const wrapper = mount(CompareTable, { props: { headers: ['#', '理论', '实际', '诊断'] } })
    expect(wrapper.get('table').classes()).toContain('border-separate')
    expect(wrapper.get('table').classes()).not.toContain('border-collapse')
  })
})
