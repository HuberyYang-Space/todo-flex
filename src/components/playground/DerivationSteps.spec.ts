import type { FlexItemState, MeasuredStage } from '~/core/types'
import { mount } from '@vue/test-utils'
import fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultItem } from '~/core/defaults'
import { flexStateArb } from '~/test/flexStateArb'
import DerivationSteps from './DerivationSteps.vue'

function setItems(specs: Partial<FlexItemState>[]): void {
  const { state } = useFlexState()
  state.items = specs.map((spec, index) => ({ ...createDefaultItem(`item-${index + 1}`), ...spec }))
}

function measureAll(widths: number[]): MeasuredStage {
  const { state } = useFlexState()
  return {
    width: state.container.width,
    height: state.container.height,
    items: state.items.map((item, index) => ({ id: item.id, width: widths[index], height: state.container.height, left: 0, top: 0 })),
  }
}

function table(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid="derivation-row"]').map(row => ({
    label: row.get('[data-testid="step-label"]').text(),
    substitution: row.get('[data-testid="step-substitution"]').text(),
    result: row.get('[data-testid="step-result"]').text(),
  }))
}

/** 默认容器 720、gap 12：A 30% = 216，剩余 720 − 516 − 24 = 180，A 与 B 各分一半 */
function growScenario(): void {
  setItems([{ basis: '30%', grow: 1 }, { basis: '150px', grow: 1 }, { basis: '150px' }])
  useFlexState().selectItem('item-1')
}

describe('derivationSteps', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useMeasure().measured.value = null
  })

  it('没有选中盒子时提示怎么用', () => {
    const wrapper = mount(DerivationSteps)
    expect(wrapper.get('[data-testid="derivation-empty"]').text()).toContain('点击演示区里的任意盒子')
  })

  it('伸展场景逐行给出代入与结果', () => {
    growScenario()
    const wrapper = mount(DerivationSteps)

    expect(table(wrapper)).toEqual([
      { label: 'basis', substitution: '30% × 720', result: '216px' },
      { label: '本行剩余', substitution: '720 − (216 + 150 + 150) − 2 × 12', result: '180px' },
      { label: 'grow 分配', substitution: '1 ÷ 2 × 180', result: '90px' },
      { label: '理论最终', substitution: '216 + 90', result: '306px' },
    ])
  })

  it('收缩有冻结时，冻结那一轮点名盒子并给出剩下的溢出', () => {
    const { state } = useFlexState()
    state.container.width = 110
    state.container.columnGap = 0
    setItems([{ basis: '10px', shrink: 10 }, { basis: '300px' }])
    useFlexState().selectItem('item-1')
    const wrapper = mount(DerivationSteps)

    expect(table(wrapper)).toContainEqual({ label: '权重和', substitution: '100 + 300', result: '400' })
    expect(table(wrapper)).toContainEqual({ label: '冻结第 1 轮', substitution: '盒子 A：100 ÷ 400 × −200 = −50，basis 只有 10', result: '溢出剩 −190px' })
    expect(table(wrapper).at(-1)).toEqual({ label: '理论最终', substitution: '10 − 10', result: '0px' })
  })

  it('别的盒子的 basis 要到运行期才能确定时，点名它并停下', () => {
    setItems([{ basis: '100px' }, { basis: '10vw' }])
    useFlexState().selectItem('item-1')
    const wrapper = mount(DerivationSteps)

    expect(wrapper.text()).toContain('盒子 B 的 basis 要到运行期才能确定')
    expect(wrapper.text()).not.toContain('理论最终')
  })

  it('自己和别的盒子的 basis 都要到运行期才能确定时，一并点名', () => {
    setItems([{ basis: '10vw' }, { basis: '5vw' }])
    useFlexState().selectItem('item-1')
    const wrapper = mount(DerivationSteps)

    expect(table(wrapper).at(-1)?.label).toBe('无法推导')
    expect(wrapper.text()).toContain('盒子 A、B 的 basis 要到运行期才能确定')
  })

  it('还没有观测结果时实际行留空位，不打勾', () => {
    growScenario()
    const wrapper = mount(DerivationSteps)

    expect(wrapper.get('[data-testid="derivation-actual"]').text()).toContain('—')
    expect(wrapper.get('[data-testid="derivation-actual"]').text()).not.toContain('✓')
  })

  it('理论与实际一致时打勾', async () => {
    growScenario()
    useMeasure().measured.value = measureAll([306, 240, 150])
    const wrapper = mount(DerivationSteps)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="derivation-actual"]').text()).toContain('306px ✓')
    expect(wrapper.find('[data-testid="derivation-diagnosis"]').exists()).toBe(false)
  })

  it('对不上时在末行下方写出诊断', async () => {
    const { state } = useFlexState()
    state.container.width = 300
    setItems([{ basis: '300px', size: 240 }, { basis: '300px' }])
    useFlexState().selectItem('item-1')
    useMeasure().measured.value = measureAll([240, 144])
    const wrapper = mount(DerivationSteps)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="derivation-actual"]').text()).not.toContain('✓')
    expect(wrapper.get('[data-testid="derivation-diagnosis"]').text()).toContain('min-width:auto')
  })

  it('停在推导页时改属性，表格跟着变', async () => {
    growScenario()
    const wrapper = mount(DerivationSteps)
    useFlexState().state.items[2].grow = 1
    await wrapper.vm.$nextTick()

    expect(table(wrapper)).toContainEqual({ label: 'grow 分配', substitution: '1 ÷ 3 × 180', result: '60px' })
  })

  it('选中的盒子被删掉后回到空状态', async () => {
    growScenario()
    const wrapper = mount(DerivationSteps)
    useFlexState().removeItem('item-1')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="derivation-empty"]').exists()).toBe(true)
  })

  // 冻结与 Σshrink < 1 同时出现的状态，随机守卫 150 轮几乎碰不到，单独钉住
  it('冻结轮的未冻结项 shrink 之和小于 1 时，分摊量写成打折式', () => {
    const { state } = useFlexState()
    state.container.width = 100
    state.container.columnGap = 0
    setItems([{ basis: '10px', shrink: 0.5 }, { basis: '1000px', shrink: 0.1 }])
    useFlexState().selectItem('item-1')
    const wrapper = mount(DerivationSteps)

    expect(table(wrapper)).toContainEqual({
      label: '冻结第 1 轮',
      substitution: '盒子 A：5 ÷ 105 × max(−910, −910 × 0.6) = −26，basis 只有 10',
      result: '溢出剩 −900px',
    })
  })

  it('gap 为 0 时本行剩余不写「− 1 × 0」', () => {
    const { state } = useFlexState()
    state.container.columnGap = 0
    setItems([{ basis: '300px', grow: 1 }, { basis: '300px' }])
    useFlexState().selectItem('item-1')
    const wrapper = mount(DerivationSteps)

    expect(table(wrapper)[1]).toEqual({ label: '本行剩余', substitution: '720 − (300 + 300)', result: '120px' })
  })

  it('不到 0.05px 的溢出照实写出，不显示成「0px（溢出）」', () => {
    // 两个 50.002% 在 720 里共 720.0288，溢出 0.0288，舍到 1 位小数就成了 0
    const { state } = useFlexState()
    state.container.columnGap = 0
    setItems([{ basis: '50.002%' }, { basis: '50.002%' }])
    useFlexState().selectItem('item-1')
    const wrapper = mount(DerivationSteps)
    const rows = table(wrapper)

    expect(rows.find(row => row.label === '本行剩余')?.result).toBe('−0.0288px（溢出）')
    expect(rows.find(row => row.label === 'shrink 分摊')?.result).toBe('−0.0144px')
  })

  it('代入列的运算数不舍成 1 位小数，照着算得出结果', async () => {
    setItems([{ basis: '30pt' }, { basis: '1.25rem' }, { basis: '33.33%' }])
    const wrapper = mount(DerivationSteps)
    const basisRow = async (id: string) => {
      useFlexState().selectItem(id)
      await wrapper.vm.$nextTick()
      return table(wrapper)[0]
    }

    expect(await basisRow('item-1')).toEqual({ label: 'basis', substitution: '30 × 1.3333', result: '40px' })
    expect(await basisRow('item-2')).toEqual({ label: 'basis', substitution: '1.25 × 16', result: '20px' })
    expect(await basisRow('item-3')).toEqual({ label: 'basis', substitution: '33.33% × 720', result: '240px' })
  })

  it('不在第一行的盒子，分行那一步讲清上一行为什么放不下它这一行的开头', async () => {
    const { state } = useFlexState()
    state.container.wrap = 'wrap'
    setItems(Array.from({ length: 4 }, () => ({ basis: '300px' })))
    useFlexState().selectItem('item-3')
    const wrapper = mount(DerivationSteps)

    expect(table(wrapper)[1]).toEqual({
      label: '分行',
      substitution: '上一行 300 + 12 + 300 + 12 + 300 = 924 > 720，放不下本行开头；本行 300 + 12 + 300 = 612 ≤ 720',
      result: '第 2 / 2 行',
    })
  })

  it('末行是单个盒子时不写恒等式', async () => {
    const { state } = useFlexState()
    state.container.wrap = 'wrap'
    setItems(Array.from({ length: 3 }, () => ({ basis: '300px' })))
    useFlexState().selectItem('item-3')
    const wrapper = mount(DerivationSteps)

    expect(table(wrapper)[1].substitution).toBe('上一行 300 + 12 + 300 + 12 + 300 = 924 > 720，放不下本行开头')
  })
})

/** 把「代入」那一列当算式真的算一遍：展示层的拼装没有别的守卫，运算数舍得太粗、项拼漏了都只有这样才看得出来 */
function evaluate(expression: string): number {
  const js = expression
    .replace(/^内容尺寸 /, '')
    .replace(/px/g, '')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/max\(/g, 'Math.max(')
    .replace(/(\d+(?:\.\d+)?)%/g, '($1 / 100)')
  if (!/^(?:[\d\s.+\-*/(),]|Math\.max)+$/.test(js))
    throw new Error(`代入列不是算式：${expression}`)
  // eslint-disable-next-line no-new-func
  return new Function(`return ${js}`)() as number
}

function numberOf(text: string): number {
  return Number.parseFloat(text.replace('−', '-').replace(/px|（溢出）/g, ''))
}

const EVALUABLE = new Set(['basis', '本行剩余', 'grow 分配', '收缩权重', '权重和', 'shrink 分摊', '理论最终'])

describe('derivationSteps 随机守卫', () => {
  beforeEach(() => {
    useFlexState().resetState()
    useMeasure().measured.value = null
  })

  it('随机状态下，每一行能复算的代入都算得出它显示的结果', async () => {
    const wrapper = mount(DerivationSteps)
    const { state } = useFlexState()
    let checked = 0

    await fc.assert(fc.asyncProperty(flexStateArb, async (random) => {
      Object.assign(state.container, random.container)
      state.items = random.items
      for (const item of random.items) {
        useFlexState().selectItem(item.id)
        await wrapper.vm.$nextTick()
        for (const row of table(wrapper)) {
          if (row.label.startsWith('冻结')) {
            for (const part of row.substitution.split('；')) {
              const [, expression, share] = part.match(/：(.+) = (\S+)，basis/) ?? []
              if (!expression)
                throw new Error(`冻结行不是「盒子：算式 = 应让量」的写法：${part}`)
              expect(Math.abs(evaluate(expression) - numberOf(share))).toBeLessThan(0.001)
              checked += 1
            }
            continue
          }
          if (!EVALUABLE.has(row.label) || row.substitution === '' || row.result === '—')
            continue
          // 结果列只留 1 位小数，运算数留 4 位：差距不该超过结果的舍入半格
          expect(Math.abs(evaluate(row.substitution) - numberOf(row.result))).toBeLessThan(0.051)
          checked += 1
        }
      }
    }), { numRuns: 150 })

    expect(checked).toBeGreaterThan(1000)
  })
})
