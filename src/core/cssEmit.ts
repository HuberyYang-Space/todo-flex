import type { FlexState } from './types'
import { isRowDirection } from './axis'

function block(selector: string, rules: string[]): string {
  return `${selector} {\n${rules.map(rule => `  ${rule};`).join('\n')}\n}`
}

/** 把当前状态转成可以直接粘贴进项目的 CSS */
export function emitCss(state: FlexState): string {
  const { container, items } = state

  const containerRules = [
    `display: ${container.display}`,
    `flex-direction: ${container.direction}`,
    `flex-wrap: ${container.wrap}`,
    `justify-content: ${container.justifyContent}`,
    `align-items: ${container.alignItems}`,
  ]

  // normal 是初始值，输出出来只会增加噪音
  if (container.alignContent !== 'normal')
    containerRules.push(`align-content: ${container.alignContent}`)

  containerRules.push(`gap: ${container.rowGap}px ${container.columnGap}px`)

  const blocks = [block('.container', containerRules)]
  // 主轴方向决定该关掉哪个方向的自动最小尺寸
  const minSizeProp = isRowDirection(container.direction) ? 'min-width' : 'min-height'

  items.forEach((item, index) => {
    const rules = [`flex: ${item.grow} ${item.shrink} ${item.basis}`]

    if (item.order !== 0)
      rules.push(`order: ${item.order}`)
    if (item.alignSelf !== 'auto')
      rules.push(`align-self: ${item.alignSelf}`)
    if (!item.minWidthAuto)
      rules.push(`${minSizeProp}: 0`)
    if (item.marginAuto)
      rules.push('margin: auto')

    blocks.push(block(`.item-${index + 1}`, rules))
  })

  return blocks.join('\n\n')
}
