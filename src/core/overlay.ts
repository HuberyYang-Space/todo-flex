import type {
  DerivedLayout,
  FlexState,
  MeasuredItem,
  MeasuredStage,
} from './types'
import { isRowDirection, mainAxisGap } from './axis'

/**
 * 低于这个像素数的空隙不画。
 * 亚像素舍入随时带来零点几像素的偏差，不设阈值会画出满屏发丝色块。
 * 与 diagnostics.ts 的 TOLERANCE 同一个量级，出于同一个理由。
 */
const EPSILON = 0.5

export type BandKind = 'free' | 'overflow'

/**
 * 斜纹的流动方向，一律用屏幕坐标表述：
 * forward = 朝坐标增大的一侧（右 / 下），reverse = 朝减小的一侧（左 / 上）。
 */
export type FlowDirection = 'forward' | 'reverse'

/**
 * 斜纹的流动轴，也就是主轴落在屏幕的哪根轴上：x = 水平，y = 垂直。
 * 纹路朝向必须由它决定：色块的长宽比取决于「剩余空间量 vs 交叉轴尺寸」，与 direction 无关，
 * row 下盒子一多色块就成了高瘦竖条，column 下行数不多色块就是宽扁横条——拿形状当线索会把方向读反。
 */
export type FlowAxis = 'x' | 'y'

/** 叠加层里的一块矩形，坐标以演示区左上角为原点 */
export interface OverlayBand {
  kind: BandKind
  lineIndex: number
  x: number
  y: number
  width: number
  height: number
  /** 斜纹朝哪边流，只有 free 色块有——溢出标记不吃斜纹 */
  flow?: FlowDirection
  /** 斜纹沿哪根轴流，与 flow 同进同出：纹路朝向垂直于它，方向才读得出来 */
  flowAxis?: FlowAxis
}

/** 每行的剩余空间对照：理论值来自推导引擎，实际值由观测值反算 */
export interface OverlayLine {
  index: number
  theoretical: number
  actual: number
}

export interface OverlayGeometry {
  bands: OverlayBand[]
  lines: OverlayLine[]
}

/**
 * 算出「浏览器排完版之后，行内哪些像素是空的」。
 *
 * 一切都在屏幕坐标空间里算：从容器左上角 0 出发向右/向下扫，
 * 与 row-reverse 这类主轴方向的正负无关——反向排列只是让盒子的坐标顺序变了，
 * 空白像素还是那些空白像素。
 */
export function computeOverlay(
  state: FlexState,
  derived: DerivedLayout,
  measured: MeasuredStage,
): OverlayGeometry {
  const { container } = state
  const isRow = isRowDirection(container.direction)
  const gap = mainAxisGap(container)
  // 容器主轴尺寸取实测值而非状态值：状态值是我们要求的，实测值才是浏览器给的
  const containerMain = isRow ? measured.width : measured.height
  const measuredById = new Map(measured.items.map(item => [item.id, item]))
  // 主轴正方向落在屏幕的哪一侧。被两个盒子夹住的空间没有唯一去向，只能按它来定
  const mainForward: FlowDirection = container.direction.endsWith('-reverse') ? 'reverse' : 'forward'

  const mainStart = (record: MeasuredItem): number => (isRow ? record.left : record.top)
  const mainSize = (record: MeasuredItem): number => (isRow ? record.width : record.height)
  const crossStart = (record: MeasuredItem): number => (isRow ? record.top : record.left)
  const crossSize = (record: MeasuredItem): number => (isRow ? record.height : record.width)

  const bands: OverlayBand[] = []
  const lines: OverlayLine[] = []

  for (const line of derived.lines) {
    const records = line.itemIds
      .map(id => measuredById.get(id))
      .filter((record): record is MeasuredItem => Boolean(record))
      .sort((a, b) => mainStart(a) - mainStart(b))

    // 观测还没跟上状态（盒子刚增删）时跳过这一行，不猜
    if (records.length === 0)
      continue

    const crossFrom = Math.min(...records.map(crossStart))
    const crossTo = Math.max(...records.map(record => crossStart(record) + crossSize(record)))

    const push = (kind: BandKind, from: number, length: number, flow?: FlowDirection): void => {
      bands.push(makeBand(kind, line.index, isRow, from, length, crossFrom, crossTo - crossFrom, flow))
    }

    let cursor = 0
    for (const record of records) {
      // 盒子之间的空隙里，gap 是用户显式要的间距，扣掉它，剩下的才是「没人要的剩余空间」。
      // 色块紧贴后一个盒子画，gap 留在前一个盒子那侧——视觉上二者不可分，这是约定。
      const deduct = cursor === 0 ? 0 : gap
      const free = mainStart(record) - cursor - deduct
      if (free > EPSILON) {
        /*
         * 斜纹讲的是「这块空间一旦被分配，会流向谁」。
         * 前面还没有盒子（cursor === 0）时唯一的去向就是后面那个，朝屏幕后方流；
         * 被两个盒子夹住时两边都可能吃，没有唯一答案，退回主轴正方向。
         */
        push('free', mainStart(record) - free, free, cursor === 0 ? 'forward' : mainForward)
      }

      // 盒子可能重叠（margin 为负等），游标只前进不后退
      cursor = Math.max(cursor, mainStart(record) + mainSize(record))
    }

    const tail = containerMain - cursor
    // 行尾的空间后面再没有盒子了，只能流回前面那个
    if (tail > EPSILON)
      push('free', cursor, tail, 'reverse')
    else if (tail < -EPSILON)
      push('overflow', containerMain, -tail)

    const used = records.reduce((sum, record) => sum + mainSize(record), 0)
    lines.push({
      index: line.index,
      theoretical: line.freeSpace,
      actual: containerMain - used - gap * Math.max(records.length - 1, 0),
    })
  }

  return { bands, lines }
}

/** 把「主轴 + 交叉轴」的一段范围翻译成屏幕坐标的矩形 */
function makeBand(
  kind: BandKind,
  lineIndex: number,
  isRow: boolean,
  mainFrom: number,
  mainLength: number,
  crossFrom: number,
  crossLength: number,
  flow?: FlowDirection,
): OverlayBand {
  const rect = isRow
    ? { x: mainFrom, y: crossFrom, width: mainLength, height: crossLength }
    : { x: crossFrom, y: mainFrom, width: crossLength, height: mainLength }

  return { kind, lineIndex, ...rect, ...(flow ? { flow, flowAxis: isRow ? 'x' as const : 'y' as const } : {}) }
}
