import type { FlexState } from '~/core/types'
import fc from 'fast-check'
import { createDefaultItem, createDefaultState } from '~/core/defaults'

const factorArb = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 10 }) },
  { weight: 1, arbitrary: fc.constantFrom(0.2, 0.3, 0.5) },
)

const basisArb = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom('auto', 'content', '0') },
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 500 }).map(value => `${value}px`) },
  { weight: 2, arbitrary: fc.integer({ min: 0, max: 80 }).map(value => `${value}%`) },
  // 带小数的写法：展示层把运算数舍得太粗时，复算对不上结果，只有这类值暴露得出来
  { weight: 1, arbitrary: fc.constantFrom('33.33%', '12.5%', '1.25rem', '0.75in') },
  { weight: 1, arbitrary: fc.integer({ min: 0, max: 20 }).map(value => `${value}em`) },
  { weight: 1, arbitrary: fc.constantFrom('1in', '2cm', '30pt') },
)

/** 随机容器：推导守卫与推导页的展示守卫共用，各分支的权重调到 1000 次运行里每条都能命中 */
export const flexStateArb = fc.record({
  items: fc.array(fc.record({
    grow: factorArb,
    shrink: factorArb,
    basis: basisArb,
    size: fc.integer({ min: 0, max: 300 }),
    order: fc.integer({ min: -1, max: 1 }),
  }), { minLength: 1, maxLength: 8 }),
  main: fc.integer({ min: 100, max: 1200 }),
  gap: fc.integer({ min: 0, max: 64 }),
  direction: fc.constantFrom('row', 'row-reverse', 'column', 'column-reverse'),
  wrap: fc.constantFrom('nowrap', 'wrap', 'wrap-reverse'),
  // 运行期 basis 只放在一成的状态里：放进每个盒子的候选里，大半状态整个容器都推不出来，其余分支就喂不饱
  runtime: fc.integer({ min: 0, max: 9 }).map(value => value === 0),
}).map(({ items, main, gap, direction, wrap, runtime }): FlexState => {
  const state = createDefaultState()
  Object.assign(state.container, { direction, wrap, width: main, height: main, rowGap: gap, columnGap: gap })
  state.items = items.map((spec, index) => ({ ...createDefaultItem(`i${index + 1}`), ...spec }))
  if (runtime)
    state.items[0].basis = '10vw'
  return state
})
