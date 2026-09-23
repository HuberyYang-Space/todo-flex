/** 组件里禁止硬编码 duration / ease / 尺寸；CSS 要用的值由组件下发成自定义属性 */
export const motion = {
  /** 秒 */
  layoutDuration: 0.62,
  layoutEase: 'back.out(1.5)',
  /** 秒 */
  layoutStagger: 0.045,

  /** 0.14 表示最多拉伸 14% */
  squashAmount: 0.14,
  /** 秒。比位移短，先于位移收住才不拖泥带水 */
  squashDuration: 0.5,
  squashEase: 'elastic.out(1, 0.55)',

  /** px */
  liftHeight: 6,
  liftScale: 1.03,
  /** 秒 */
  liftDuration: 0.28,

  /** 顶面与右侧面各伸出这么多（px），是上限 */
  blockDepth: 10,
  /** px。gap 收到 0 时也要留一点，否则方块塌回平面 */
  blockDepthMin: 3,
  /** 用乘不用加：gap 收窄时厚度已经很薄，再加固定值会顶到邻居 */
  blockDepthHover: 1.3,
  blockDepthActive: 0.35,

  /**
   * 演示区四周的余量（px），伸出容器的面全靠它才不被裁掉。
   * 悬停时伸出 = 顶面 blockDepth × blockDepthHover（13）+ liftHeight（6）+ liftScale 放大（高 600 时单边约 9）= 28，取 32。
   * 做成 .stage-wrapper 的外边距而不是内边距：叠加层按 wrapper 绝对定位，有内边距整层就错位。
   */
  stageOverhang: 32,
} as const
