import type { Trap } from '~/core/types'

/**
 * 五个陷阱，顺序即页面展示顺序。
 *
 * 状态一律写成相对 `createDefaultState()` 的 patch，只列改动的字段。
 * 默认状态是：容器 720×320、gap 12、三个 size 80 的盒子（flex: 0 1 auto，min-width: auto 开着）。
 *
 * 数值都是算过的，改动前先把 `traps.spec.ts` 里那几条现象守卫测试看一遍——
 * 它们钉住的是「这个陷阱还演不演得出来」，不是格式。
 */
export const traps: Trap[] = [
  {
    id: 'min-width-auto',
    title: 'min-width: auto 让 flex: 1 不肯收缩',
    hook: '明明写了 flex: 1，盒子却撑爆容器——Flexbox 最高频的一个坑。',
    base: {
      container: { width: 480 },
      items: [{ index: 0, patch: { grow: 1, basis: '0', size: 320 } }],
    },
    before: { items: [{ index: 0, patch: { minWidthAuto: true } }] },
    after: { items: [{ index: 0, patch: { minWidthAuto: false } }] },
    beats: [
      {
        title: '现象',
        body: 'A 写着 flex: 1 1 0，按理该老实分剩余空间。可它偏偏卡在 320px 上不动，三个盒子加起来 504px，把 480px 的容器顶出去 24px。',
      },
      {
        title: '归因',
        body: 'flex item 的 min-width 初始值不是 0，是 auto——意思是「不得小于内容的最小尺寸」。A 的内容固有尺寸正好 320px，收缩在这里被截停，flex-shrink 算出来的值根本没机会落地。',
        code: '/* 浏览器实际在用的是这个 */\n.item {\n  flex: 1 1 0;\n  min-width: auto; /* ← 初始值，不是 0 */\n}',
      },
      {
        title: '修复',
        body: '显式写 min-width: 0 把这道下限撤掉，A 才落回推导值 296px，容器不再溢出。主轴是纵向时，要改的是 min-height。',
      },
    ],
  },
  {
    id: 'basis-source',
    title: 'flex-basis 才是主轴尺寸的起点',
    hook: '三个盒子都写了 flex-grow: 1，为什么分出来还是不一样宽？',
    base: {
      items: [
        { index: 0, patch: { grow: 1, size: 200 } },
        { index: 1, patch: { grow: 1 } },
        { index: 2, patch: { grow: 1 } },
      ],
    },
    before: {
      items: [
        { index: 0, patch: { basis: 'auto' } },
        { index: 1, patch: { basis: 'auto' } },
        { index: 2, patch: { basis: 'auto' } },
      ],
    },
    after: {
      items: [
        { index: 0, patch: { basis: '0' } },
        { index: 1, patch: { basis: '0' } },
        { index: 2, patch: { basis: '0' } },
      ],
    },
    beats: [
      {
        title: '现象',
        body: '三个盒子的 flex-grow 都是 1，理应雨露均沾。实际却是 312 / 192 / 192——A 平白多出 120px。',
      },
      {
        title: '归因',
        body: 'flex-grow 分的是「剩余空间」，不是「全部空间」。basis 为 auto 时每个盒子先按各自的内容尺寸占位（200 / 80 / 80），剩下的 336px 才拿去均分，每人 112px。起点不同，终点自然不同。',
      },
      {
        title: '修复',
        body: '把 basis 改成 0，等于宣布「谁都不许先占位」，整个 696px 都是剩余空间，三个盒子这才精确均分到 232px。想要等宽，要动的是 basis 而不是 grow。',
      },
    ],
  },
  {
    id: 'flex-shorthand',
    title: 'flex 简写背后是三个属性',
    hook: 'flex: none 和 flex: 1 只差一个词，排出来天差地别。',
    base: {
      container: { width: 480 },
      items: [
        { index: 0, patch: { size: 200, minWidthAuto: false } },
        { index: 1, patch: { size: 200, minWidthAuto: false } },
        { index: 2, patch: { size: 200, minWidthAuto: false } },
      ],
    },
    before: {
      items: [
        { index: 0, patch: { grow: 0, shrink: 0, basis: 'auto' } },
        { index: 1, patch: { grow: 0, shrink: 0, basis: 'auto' } },
        { index: 2, patch: { grow: 0, shrink: 0, basis: 'auto' } },
      ],
    },
    after: {
      items: [
        { index: 0, patch: { grow: 1, shrink: 1, basis: '0' } },
        { index: 1, patch: { grow: 1, shrink: 1, basis: '0' } },
        { index: 2, patch: { grow: 1, shrink: 1, basis: '0' } },
      ],
    },
    beats: [
      {
        title: '现象',
        body: 'flex: none 的三个盒子各占 200px，加起来 624px，硬生生把 480px 的容器撑破，一点都不肯让。',
      },
      {
        title: '归因',
        body: 'flex 是三个属性的简写，换一个关键字等于同时换掉 grow / shrink / basis 三个值。none 的意思是「既不长也不缩」，所以哪怕容器装不下，它也纹丝不动。',
        code: 'flex: 1        →  1 1 0     可长可缩，忽略内容尺寸\nflex: auto     →  1 1 auto  可长可缩，但从内容尺寸起算\nflex: initial  →  0 1 auto  不长只缩（这是默认值）\nflex: none     →  0 0 auto  既不长也不缩',
      },
      {
        title: '修复',
        body: 'flex: 1 展开是 1 1 0——允许伸长、允许收缩、且不拿内容尺寸当起点。三个盒子这才各自落到 152px，正好填满容器。',
      },
    ],
  },
  {
    id: 'align-content-single-line',
    title: 'align-content 在单行容器上完全无效',
    hook: '改了 align-content 却毫无反应？先看看 flex-wrap。',
    base: {
      container: { width: 360, alignContent: 'center' },
      itemCount: 4,
      items: [
        { index: 0, patch: { size: 100, shrink: 0 } },
        { index: 1, patch: { size: 100, shrink: 0 } },
        { index: 2, patch: { size: 100, shrink: 0 } },
        { index: 3, patch: { size: 100, shrink: 0 } },
      ],
    },
    before: { container: { wrap: 'nowrap' } },
    after: { container: { wrap: 'wrap' } },
    beats: [
      {
        title: '现象',
        body: 'align-content 从头到尾都写着 center，可无论怎么改都看不出任何变化——四个盒子挤在一行里溢出容器，纹丝不动。这就是最常见的那句「我改了，但它没反应」。',
      },
      {
        title: '归因',
        body: 'align-content 管的是「多行之间在交叉轴上怎么排」。nowrap 的容器永远只有一行，没有「行与行之间」可言，规范因此规定这个属性在单行容器上完全不生效——不是写错了，是压根没有作用对象。',
      },
      {
        title: '修复',
        body: '把 flex-wrap 改成 wrap，四个盒子排成两行，align-content: center 当场生效，两行整体在交叉轴上居中。属性本身一直是对的，缺的是让它有意义的前提。',
      },
    ],
  },
  {
    id: 'margin-auto',
    title: 'margin: auto 一旦生效，justify-content 就靠边站',
    hook: 'justify-content 写着 space-between，盒子却挤作一团。',
    base: { container: { justifyContent: 'space-between' } },
    before: { items: [{ index: 0, patch: { marginAuto: true } }] },
    after: { items: [{ index: 0, patch: { marginAuto: false } }] },
    beats: [
      {
        title: '现象',
        body: 'space-between 本该把三个盒子推到两端、间隔均分。实际却是 B 和 C 紧贴着 A，右边空出一大片——属性明明写了，却像没写一样。',
      },
      {
        title: '归因',
        body: '规范规定的顺序是：auto margin 先分,justify-content 后分。A 的 margin: auto 把 456px 的剩余空间一口气吃光，轮到 justify-content 时已经无空间可分——它不是被覆盖，是被饿死了。',
      },
      {
        title: '修复',
        body: '关掉那个 margin: auto，剩余空间重新回到 justify-content 手里，space-between 立刻恢复。顺带一提：auto margin 在交叉轴上同样有效，这也是为什么它能盖过 align-items 把盒子居中。',
      },
    ],
  },
]
