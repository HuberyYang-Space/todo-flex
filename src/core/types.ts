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

/** 一条可展示给用户的推导步骤，params 是公式里的各项数值 */
export interface DerivationStep {
  kind: DerivationStepKind
  lineIndex: number
  itemId?: string
  params: Record<string, number>
}

export interface DerivedLayout {
  lines: DerivedLine[]
  items: DerivedItem[]
  steps: DerivationStep[]
}

/**
 * 观测层读到的单个盒子的真实布局。
 * 尺寸来自 ResizeObserver 报告的 border-box、位置来自 offsetLeft/offsetTop，
 * 两者都不受 transform 影响——M4 接入 GSAP Flip 后动画照播、数字照准。
 */
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

export type DiagnosticRule = 'min-width-auto' | 'margin-auto' | 'max-size-clamp'

/**
 * 诊断结论，两类：
 * - `warn`：理论值与实际值对不上，指出是哪条规则介入了
 * - `info`：由状态直接推出的提示。`margin: auto` 属于这类——浏览器实测确认它
 *   吃掉剩余空间时只改变位置、不改变尺寸，因此永远不会体现为尺寸偏差
 */
export interface Diagnostic {
  itemId: string
  rule: DiagnosticRule
  severity: 'warn' | 'info'
  theoretical: number
  actual: number
  /** 补充数值，供展示层写进文案（如被 margin 吃掉的剩余空间） */
  params: Record<string, number>
}

/** 陷阱状态的一处局部改动。item 按索引定位——陷阱数据不关心 id 是怎么生成的 */
export interface TrapItemPatch {
  index: number
  patch: Partial<Omit<FlexItemState, 'id'>>
}

/**
 * 一层状态改动。只写要改的字段，其余从上一层继承。
 * 陷阱大多只差一两个字段，写完整 state 会被噪音淹掉真正的差异点，
 * 而「差异点是什么」恰恰是陷阱要教的东西。
 */
export interface TrapVariant {
  container?: Partial<FlexContainerState>
  /** 盒子数量。给了就按这个数量重建 items，不给则沿用上一层 */
  itemCount?: number
  items?: TrapItemPatch[]
}

export interface TrapBeat {
  title: string
  body: string
  /** 可选的展示用代码块，交给 prismjs 高亮 */
  code?: string
}

export interface Trap {
  id: string
  title: string
  /** 一句话钩子，放在板块标题下 */
  hook: string
  /** 这个陷阱的公共起点，打在 createDefaultState() 上 */
  base: TrapVariant
  /** 现象态 = default + base + before */
  before: TrapVariant
  /** 修复态 = default + base + after */
  after: TrapVariant
  /** 恰好三拍：现象 / 归因 / 修复 */
  beats: [TrapBeat, TrapBeat, TrapBeat]
}

/** 归因拍展示的一条属性差异。值一律转成字符串，格式化成人话是展示层的事 */
export interface PropertyDiff {
  scope: 'container' | 'item'
  /** scope 为 item 时才有 */
  itemIndex?: number
  key: string
  from: string
  to: string
}
