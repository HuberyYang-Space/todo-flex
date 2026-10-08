import type { DerivedItem, DerivedLayout, DerivedLine, ExplainStep, FlexItemState, FlexState } from './types'
import { mainAxisGap, mainAxisSize } from './axis'
import { basisKind, FONT_RELATIVE_UNITS, PX_PER_UNIT, staticLength } from './basisSyntax'

/**
 * 把一个盒子的理论尺寸拆成逐步的推导。
 * 只编排不重算：每一步的结果都取自 deriveLayout 的输出，最后一步因此必然等于明细表的理论值。
 */
export function explainItem(state: FlexState, layout: DerivedLayout, itemId: string): ExplainStep[] {
  const item = state.items.find(candidate => candidate.id === itemId)
  const derived = layout.items.find(candidate => candidate.id === itemId)
  if (!item || !derived)
    return []

  const basis = basisStep(item, derived, state, layout.fontSize)
  if (derived.finalMainSize === null) {
    const blockers = state.items
      .filter(candidate => basisKind(candidate.basis) === 'runtime')
      .map(candidate => candidate.id)
    return [basis, { kind: 'unresolvable', blockers }]
  }

  const line = layout.lines[derived.lineIndex]
  const sizeOf = new Map(layout.items.map(record => [record.id, record.hypotheticalMainSize]))
  const terms = line.itemIds.map(id => sizeOf.get(id) ?? 0)
  const gap = mainAxisGap(state.container)
  const steps: ExplainStep[] = [basis]

  if (layout.lines.length > 1)
    steps.push(lineStep(state, layout, line, sizeOf, terms, gap))

  steps.push({ kind: 'free', container: mainAxisSize(state.container), terms, gap, result: line.freeSpace })

  if (line.freeSpace > 0)
    steps.push({ kind: 'grow', grow: Math.max(0, item.grow), totalGrow: line.totalGrow, free: line.freeSpace, result: derived.deltaFromGrow })
  else if (line.freeSpace < 0)
    steps.push(...shrinkSteps(state, line, item, derived, sizeOf))
  else
    steps.push({ kind: 'balanced' })

  steps.push({
    kind: 'final',
    basis: derived.hypotheticalMainSize,
    delta: derived.deltaFromGrow + derived.deltaFromShrink,
    result: derived.finalMainSize,
  })
  return steps
}

function basisStep(item: FlexItemState, derived: DerivedItem, state: FlexState, fontSize: number): ExplainStep {
  if (basisKind(item.basis) === 'runtime')
    return { kind: 'basis-runtime', raw: item.basis }

  const base = { kind: 'basis', raw: item.basis, result: derived.basisResolved } as const
  const length = staticLength(item.basis)
  if (!length)
    return { ...base, form: 'content', value: item.size, unit: '', factor: 1 }

  const { value, unit } = length
  if (unit === '%')
    return { ...base, form: 'percent', value, unit, factor: mainAxisSize(state.container) }
  if (FONT_RELATIVE_UNITS.has(unit))
    return { ...base, form: 'font', value, unit, factor: fontSize }
  if (unit === '' || unit === 'px')
    return { ...base, form: 'length', value, unit, factor: 1 }
  return { ...base, form: 'unit', value, unit, factor: PX_PER_UNIT.get(unit) ?? 1 }
}

function lineStep(
  state: FlexState,
  layout: DerivedLayout,
  line: DerivedLine,
  sizeOf: Map<string, number>,
  terms: number[],
  gap: number,
): ExplainStep {
  // lines 按视觉行序排，wrap-reverse 下与断行先后相反；「下一个放不下的」要按断行先后找
  const sequence = state.container.wrap === 'wrap-reverse' ? [...layout.lines].reverse() : layout.lines
  const position = sequence.indexOf(line)
  const previousLine = sequence[position - 1]
  const nextLine = sequence[position + 1]

  return {
    kind: 'line',
    lineNumber: line.index + 1,
    lineCount: layout.lines.length,
    previous: previousLine ? previousLine.itemIds.map(id => sizeOf.get(id) ?? 0) : null,
    terms,
    gap,
    next: nextLine ? sizeOf.get(nextLine.itemIds[0]) ?? 0 : null,
    limit: mainAxisSize(state.container),
  }
}

function shrinkSteps(
  state: FlexState,
  line: DerivedLine,
  item: FlexItemState,
  derived: DerivedItem,
  sizeOf: Map<string, number>,
): ExplainStep[] {
  const shrinkOf = new Map(state.items.map(candidate => [candidate.id, Math.max(0, candidate.shrink)]))
  const weightOf = (id: string): number => (shrinkOf.get(id) ?? 0) * (sizeOf.get(id) ?? 0)
  const steps: ExplainStep[] = [
    { kind: 'shrink-weight', shrink: shrinkOf.get(item.id) ?? 0, basis: derived.hypotheticalMainSize, result: weightOf(item.id) },
  ]
  const frozen = new Set<string>()

  for (const [index, round] of line.shrinkRounds.entries()) {
    const active = line.itemIds.filter(id => !frozen.has(id))
    steps.push({ kind: 'shrink-total', terms: active.map(weightOf), result: round.weightSum })

    if (round.frozen.length === 0) {
      steps.push({
        kind: 'shrink-share',
        weight: weightOf(item.id),
        weightSum: round.weightSum,
        overflow: round.overflow,
        factorSum: round.factorSum,
        initialOverflow: line.freeSpace,
        result: derived.deltaFromShrink,
      })
      return steps
    }

    // 没有下一轮，说明剩下的盒子权重为 0、循环就此停下，剩下的溢出只能自己加回来
    const remaining = line.shrinkRounds[index + 1]?.overflow
      ?? round.frozen.reduce((sum, record) => sum + (sizeOf.get(record.id) ?? 0), round.overflow)
    steps.push({
      kind: 'freeze',
      round: index + 1,
      overflow: round.overflow,
      factorSum: round.factorSum,
      initialOverflow: line.freeSpace,
      weightSum: round.weightSum,
      frozen: round.frozen.map(record => ({ id: record.id, weight: weightOf(record.id), share: record.share, basis: sizeOf.get(record.id) ?? 0 })),
      remaining,
    })
    for (const record of round.frozen)
      frozen.add(record.id)
    if (frozen.has(item.id))
      return steps
  }

  // 一轮都没分摊成：整行权重为 0，或冻结之后剩下的盒子权重为 0
  steps.push({ kind: 'no-shrink' })
  return steps
}
