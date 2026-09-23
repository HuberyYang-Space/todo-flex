/** 演示区、盒子列表与明细表必须用同一个标签称呼同一个盒子 */
export function itemLabel(index: number): string {
  return String.fromCharCode(65 + (index % 26))
}
