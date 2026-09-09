/**
 * 动效与视觉 token。
 *
 * 组件里禁止硬编码 duration / ease / 角度 / 像素上限——调参要能一处改完，
 * 也免得同一套节奏在各处漂移。CSS 里要用到的值由组件下发成自定义属性。
 */
export const motion = {
  /** 布局重排的时长（秒） */
  layoutDuration: 0.45,
  /** 布局重排的缓动：末端减速，收得干净 */
  layoutEase: 'power3.out',
  /** 按索引交错，让重排有节奏而不是齐步走（秒） */
  layoutStagger: 0.025,
  /** 悬停抬起的时长（秒） */
  liftDuration: 0.2,
  /** --depth 为 ±1 时的方块厚度（px） */
  maxDepth: 26,
  /** 悬停或选中时额外抬起的高度（px） */
  liftHeight: 18,
  /** 演示区俯视角度（deg）。10 度以内横向投影误差可忽略，读数不受损 */
  tiltDeg: 10,
  /** 透视距离（px），越大越接近正交投影 */
  perspective: 1400,
} as const
