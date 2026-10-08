/** 演示区、盒子列表与明细表必须用同一个标签称呼同一个盒子 */
export function itemLabel(index: number): string {
  return String.fromCharCode(65 + (index % 26))
}

export function roundTenth(value: number): number {
  return Math.round(value * 10) / 10
}

/** 推导表里负数紧跟在 × 与 − 后面，连字符会被读成另一个减号 */
export function formatNumber(value: number, digits = 1): string {
  const scale = 10 ** digits
  const rounded = Math.round(value * scale) / scale
  return rounded < 0 ? `−${-rounded}` : `${rounded === 0 ? 0 : rounded}`
}

export function px(value: number): string {
  return `${formatNumber(value)}px`
}
