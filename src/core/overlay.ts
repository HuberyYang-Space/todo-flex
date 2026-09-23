import type {
  DerivedLayout,
  FlexState,
  MeasuredItem,
  MeasuredStage,
} from './types'
import { isRowDirection, mainAxisGap } from './axis'
import { measuredLines } from './measuredLines'

/** 与 diagnostics.ts 的 TOLERANCE 同一个理由：不设阈值会画出满屏发丝色块 */
const EPSILON = 0.5

type BandKind = 'free' | 'overflow'

/** 屏幕坐标：forward 朝右 / 下，reverse 朝左 / 上 */
type FlowDirection = 'forward' | 'reverse'

/**
 * 主轴落在屏幕的哪根轴上。纹路朝向必须由它决定，不能看色块形状：
 * 色块长宽比取决于「剩余空间量 vs 交叉轴尺寸」，与 direction 无关，拿形状当线索会把方向读反。
 */
type FlowAxis = 'x' | 'y'

/** 坐标以演示区左上角为原点 */
export interface OverlayBand {
  kind: BandKind
  lineIndex: number
  x: number
  y: number
  width: number
  height: number
  /** 只有 free 色块有，溢出标记不吃斜纹 */
  flow?: FlowDirection
  /** 与 flow 同进同出 */
  flowAxis?: FlowAxis
}

/** 理论值来自推导引擎，实际值由观测值反算 */
interface OverlayLine {
  index: number
  /** 理论值无法推导时为 null */
  theoretical: number | null
  actual: number
}

export interface OverlayGeometry {
  bands: OverlayBand[]
  lines: OverlayLine[]
}

/**
 * 算出浏览器排完版之后，行内哪些像素是空的。
 *
 * 一律在屏幕坐标里从左上角向右 / 向下扫，与主轴正负无关：
 * 反向排列只改变盒子的坐标顺序，空白像素还是那些像素。
 */
export function computeOverlay(
  state: FlexState,
  derived: DerivedLayout,
  measured: MeasuredStage,
): OverlayGeometry {
  const { container } = state
  const isRow = isRowDirection(container.direction)
  const gap = mainAxisGap(container)
  // 取实测值而非状态值：状态值是我们要求的，实测值才是浏览器给的
  const containerMain = isRow ? measured.width : measured.height
  const measuredById = new Map(measured.items.map(item => [item.id, item]))
  // 被两个盒子夹住的空间没有唯一去向，只能按主轴正方向来定
  const mainForward: FlowDirection = container.direction.endsWith('-reverse') ? 'reverse' : 'forward'

  const mainStart = (record: MeasuredItem): number => (isRow ? record.left : record.top)
  const mainSize = (record: MeasuredItem): number => (isRow ? record.width : record.height)
  const crossStart = (record: MeasuredItem): number => (isRow ? record.top : record.left)
  const crossSize = (record: MeasuredItem): number => (isRow ? record.height : record.width)

  // 推导引擎的某一行与实际某一行的盒子完全相同时，它的理论剩余才有对照意义
  const theoreticalByMembers = new Map(derived.lines.map(line => [[...line.itemIds].sort().join(' '), line.remainingFreeSpace]))

  const bands: OverlayBand[] = []
  const lines: OverlayLine[] = []

  for (const [index, ids] of measuredLines(state, measured, derived.fontSize).entries()) {
    const line = { index, remainingFreeSpace: theoreticalByMembers.get([...ids].sort().join(' ')) ?? null }
    const records = ids
      .map(id => measuredById.get(id))
      .filter((record): record is MeasuredItem => Boolean(record))
      .sort((a, b) => mainStart(a) - mainStart(b))

    // 盒子刚增删、观测还没跟上时跳过这一行，不猜
    if (records.length === 0)
      continue

    const crossFrom = Math.min(...records.map(crossStart))
    const crossTo = Math.max(...records.map(record => crossStart(record) + crossSize(record)))

    const push = (kind: BandKind, from: number, length: number, flow?: FlowDirection): void => {
      bands.push(makeBand(kind, line.index, isRow, from, length, crossFrom, crossTo - crossFrom, flow))
    }

    let cursor = 0
    for (const record of records) {
      // gap 是用户显式要的间距，扣掉它剩下的才是剩余空间。
      // 约定：色块紧贴后一个盒子画，gap 留在前一个盒子那侧
      const deduct = cursor === 0 ? 0 : gap
      const free = mainStart(record) - cursor - deduct
      if (free > EPSILON) {
        // 斜纹讲的是「这块空间一旦被分配会流向谁」：行首只能流向后面那个盒子，
        // 被两个盒子夹住时两边都可能吃，退回主轴正方向
        push('free', mainStart(record) - free, free, cursor === 0 ? 'forward' : mainForward)
      }

      // 盒子可能重叠（如负 margin），游标只进不退
      cursor = Math.max(cursor, mainStart(record) + mainSize(record))
    }

    const tail = containerMain - cursor
    if (tail > EPSILON)
      push('free', cursor, tail, 'reverse')
    else if (tail < -EPSILON)
      push('overflow', containerMain, -tail)

    const used = records.reduce((sum, record) => sum + mainSize(record), 0)
    lines.push({
      index: line.index,
      theoretical: line.remainingFreeSpace,
      actual: containerMain - used - gap * Math.max(records.length - 1, 0),
    })
  }

  return { bands, lines }
}

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
