export type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse'
export type Wrap = 'nowrap' | 'wrap' | 'wrap-reverse'

/** 容器属性。width/height 由演示区拖拽调整，不出现在控制面板的属性表里 */
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
  /** 是否保留 min-width:auto（关闭则写入 min-width:0） */
  minWidthAuto: boolean
  /** 是否给该项加 margin:auto */
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
  /** 理论最终主轴尺寸 */
  finalMainSize: number
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
  /** 正 = 有剩余，负 = 溢出 */
  freeSpace: number
  totalGrow: number
  /** Σ(shrink × basis) */
  totalShrinkWeighted: number
}

export type DerivationStepKind
  = | 'resolveBasis'
    | 'lineBreak'
    | 'freeSpace'
    | 'growDistribute'
    | 'shrinkDistribute'

/** 一条可展示给用户的推导步骤，params 交给 i18n 渲染成公式文案 */
export interface DerivationStep {
  kind: DerivationStepKind
  lineIndex: number
  itemId?: string
  params: Record<string, number>
  messageKey: string
}

export interface DerivedLayout {
  lines: DerivedLine[]
  items: DerivedItem[]
  steps: DerivationStep[]
}
