import type { Diagnostic, DiagnosticRule } from '~/core/types'
import { diagnose } from '~/core/diagnostics'
import { itemLabel, px } from '~/core/labels'

/** 明细表与推导页共用一份。不放进 useFlexState：状态层不该反向依赖观测层 */
export const useDiagnostics = createSharedComposable(() => {
  const { state, derived } = useFlexState()
  const { measured } = useMeasure()

  function labelsOf(ids: string[]): string {
    return ids.map(id => itemLabel(state.items.findIndex(item => item.id === id))).join('、')
  }

  // 文案住在展示层：core/ 只产出 rule 标识、数值与盒子 id
  const ruleText: Record<DiagnosticRule, (diagnostic: Diagnostic) => string> = {
    'runtime-basis': () => 'flex-basis 要到运行期才能确定（calc()、vw、ch 等），理论值无法推导',
    'line-break-widened': () => 'min-width:auto 把它参与换行的尺寸撑到了内容尺寸，换行位置因此与推导不同',
    'line-break-shifted': () => '换行位置与推导不同：有盒子被 min-width:auto 撑宽，它所在行的成员变了',
    'min-width-auto': d => d.params.freeSpace < 0
      ? 'min-width:auto 撑住了内容固有尺寸，收缩到此为止'
      : '分到的尺寸比内容固有尺寸小，min-width:auto 把它撑到了内容尺寸',
    'min-width-auto-sibling': d => `同一行的 ${labelsOf(d.causedBy ?? [])} 被 min-width:auto 兜住、多占了空间，它分到的尺寸跟着变小`,
    'margin-auto': d => `margin:auto 吃掉了 ${px(d.params.freeSpace)} 剩余空间，justify-content 已失效`,
    'unexplained': () => '与推导不一致，没能归到已知规则',
  }

  const diagnostics = computed(() => measured.value ? diagnose(state, derived.value, measured.value) : [])
  const byId = computed(() => new Map(diagnostics.value.map(diagnostic => [diagnostic.itemId, diagnostic])))

  return { diagnostics, byId, textOf: (diagnostic: Diagnostic): string => ruleText[diagnostic.rule](diagnostic) }
})
