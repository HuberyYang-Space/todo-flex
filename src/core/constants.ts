/**
 * 零依赖的常量。推导引擎只从这里取，不经 defaults：defaults 依赖属性表，
 * 从那里取会让整个纯推导引擎间接依赖属性表，将来 basisSyntax 一碰 defaults 就成环。
 */

/** 浏览器的默认根字号；页面里读不到时的兜底 */
export const DEFAULT_FONT_SIZE = 16

/** 再多面板与演示区都会失去可读性，也超出 A–Z 标签的可读范围 */
export const MAX_ITEMS = 8
