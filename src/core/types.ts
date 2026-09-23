export type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse'
export type Wrap = 'nowrap' | 'wrap' | 'wrap-reverse'

/** width/height 由演示区拖拽调整，不在控制面板的属性表里 */
export interface FlexContainerState {
  display: 'flex' | 'inline-flex'
  direction: Direction
  wrap: Wrap
  justifyContent: string
  alignItems: string
  alignContent: string
  rowGap: number
  columnGap: number
  width: number
  height: number
}

export interface FlexItemState {
  id: string
  grow: number
  shrink: number
  /** 'auto' | 'content' | '0' | '120px' | '30%' */
  basis: string
  order: number
  alignSelf: string
  /** 主轴方向上的内容固有尺寸（px），决定 min-width:auto 的下限与 baseline 位置 */
  size: number
  /** 关闭则写入 min-width:0 */
  minWidthAuto: boolean
  marginAuto: boolean
}

export interface FlexState {
  container: FlexContainerState
  items: FlexItemState[]
  selectedId: string | null
}

export interface DerivedItem {
  id: string
  /** 解析后的 flex-basis（px） */
  basisResolved: number
  /** 假设主轴尺寸：basis 解析值下限截到 0 */
  hypotheticalMainSize: number
  /** 容器里有运行期才能确定的 basis 时为 null */
  finalMainSize: number | null
  /** 由 grow 分得（≥ 0） */
  deltaFromGrow: number
  /** 由 shrink 让出（≤ 0） */
  deltaFromShrink: number
  lineIndex: number
}

export interface DerivedLine {
  index: number
  itemIds: string[]
  /** 已占用主轴尺寸，含 gap */
  usedMainSize: number
  /** 分配之前：正 = 有剩余，负 = 溢出 */
  freeSpace: number
  /** grow / shrink 分配之后还剩多少：正的交给 justify-content 与 auto margin，负的是溢出 */
  remainingFreeSpace: number | null
  totalGrow: number
  /** Σ(shrink × basis) */
  totalShrinkWeighted: number
}

export interface DerivedLayout {
  lines: DerivedLine[]
  items: DerivedItem[]
}

/** 尺寸与位置都取自 offset*，不受 transform 影响，GSAP Flip 动画期间数字照样准 */
export interface MeasuredItem {
  id: string
  width: number
  height: number
  left: number
  top: number
}

export interface MeasuredStage {
  width: number
  height: number
  items: MeasuredItem[]
}

export type DiagnosticRule = 'invalid-basis' | 'runtime-basis' | 'min-width-auto' | 'margin-auto' | 'max-size-clamp'

/**
 * - `warn`：理论值与实际值对不上，指出是哪条规则介入了；或状态本身就不合法（如非法的 flex-basis）
 * - `info`：由状态直接推出的提示，如 `margin: auto`——它只改位置、不改尺寸，不会体现为尺寸偏差
 */
export interface Diagnostic {
  itemId: string
  rule: DiagnosticRule
  severity: 'warn' | 'info'
  theoretical: number | null
  actual: number
  /** 补充数值，供展示层写进文案（如被 margin 吃掉的剩余空间） */
  params: Record<string, number>
}
