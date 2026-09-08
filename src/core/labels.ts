/** 盒子在界面上的标签：A、B、C……演示区、盒子列表与明细表必须叫同一个名字 */
export function itemLabel(index: number): string {
  return String.fromCharCode(65 + (index % 26))
}
