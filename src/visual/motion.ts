/**
 * 动效与视觉 token。
 *
 * 组件里禁止硬编码 duration / ease / 尺寸——调参要能一处改完，
 * 也免得同一套节奏在各处漂移。CSS 里要用到的值由组件下发成自定义属性。
 */
export const motion = {
  /** 布局重排的时长（秒） */
  layoutDuration: 0.62,
  /**
   * 位移的缓动。带一点回弹，盒子停下来时会轻轻过冲再收住——
   * 这是「有惯性、有重量」的来源，纯 power 缓动会显得干瘪。
   */
  layoutEase: 'back.out(1.5)',
  /** 按索引交错，让重排有节奏而不是齐步走（秒） */
  layoutStagger: 0.045,

  /**
   * 挤压拉伸的幅度。盒子移动时沿运动方向拉长、垂直方向变窄，停下时回弹，
   * 就是水滴/果冻的手感来源。0.14 表示最多拉伸 14%。
   */
  squashAmount: 0.14,
  /** 形变的时长（秒），比位移短，先于位移收住才不会拖泥带水 */
  squashDuration: 0.5,
  /** 形变回弹的缓动，弹性比位移更明显 */
  squashEase: 'elastic.out(1, 0.55)',

  /** 悬停时的抬升（px）与放大倍率 */
  liftHeight: 6,
  liftScale: 1.03,
  /** 悬停过渡的时长（秒） */
  liftDuration: 0.28,

  /** 等距实体块的厚度上限（px），顶面与右侧面各伸出这么多 */
  blockDepth: 10,
  /** 厚度下限（px）。gap 收到 0 时也要留一点，否则方块会塌回平面 */
  blockDepthMin: 3,
  /** 悬停时的厚度倍率。用乘不用加，gap 收窄时厚度已经很薄，再加固定值会顶到邻居 */
  blockDepthHover: 1.3,
  /** 按下时的厚度倍率，块体被压回台面 */
  blockDepthActive: 0.35,

  /*
   * 演示区四周要留出的余量（px）——块体伸到容器外面的部分全靠它才不被裁掉。
   *
   * 悬停时伸出的量是三项叠加：顶面厚度 blockDepth × blockDepthHover = 13，
   * 整体抬升 liftHeight = 6，再加 liftScale 的放大（按 0.03 算，盒子越大涨得越多，
   * 演示区高度上限 600 时单边约 9）。13 + 6 + 9 = 28，取 32 留一点富余。
   * align-items 默认 stretch，盒子顶边必然贴着容器上沿，所以这个余量不够时
   * 每一次悬停都会被切——不是边界情况。
   *
   * 这份余量做成 .stage-wrapper 的外边距而不是滚动容器的内边距：
   * 叠加层是相对 wrapper 绝对定位的，wrapper 一旦有内边距，
   * 叠加层的 top/left:0 会对到内边距盒而不是 .stage 的左上角，整层就错位了。
   */
  stageOverhang: 32,
} as const
