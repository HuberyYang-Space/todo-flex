<script setup lang="ts">
import type { PropertyDef } from '~/data/flexProperties'
import { useFlip } from '~/composables/useFlip'

const props = defineProps<{
  prop: PropertyDef
  modelValue: string | number | boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
}>()

const { setScrubbing } = useFlip()

/** 输入框显示的是草稿：被拒的值只停在这里，不进状态 */
const draft = ref(String(props.modelValue))
const hint = ref<string | null>(null)
const draftInvalid = computed(() => props.prop.kind === 'text' && props.prop.check(draft.value) !== null)

const fieldId = useId()
const hintId = `${fieldId}-hint`
const demoOnlyId = `${fieldId}-demo-only`
const describedBy = computed(() =>
  [props.prop.demoOnly && demoOnlyId, props.prop.kind === 'text' && hintId].filter(Boolean).join(' ') || undefined,
)

watch(() => props.modelValue, (value) => {
  draft.value = String(value)
  hint.value = null
})

function onNumberInput(event: Event): void {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value))
}

function onTextInput(event: Event): void {
  if (props.prop.kind !== 'text')
    return
  draft.value = (event.target as HTMLInputElement).value
  hint.value = props.prop.check(draft.value)
  if (hint.value === null)
    emit('update:modelValue', draft.value)
}

/** 失焦或回车时还不合法就退回生效的值：输入框不能停在一个没生效的值上，看着像是改成功了 */
function onTextCommit(): void {
  if (props.prop.kind !== 'text')
    return
  const reason = props.prop.check(draft.value)
  if (reason === null) {
    const normalized = props.prop.normalize(draft.value)
    if (normalized !== draft.value)
      emit('update:modelValue', normalized)
    return
  }
  draft.value = String(props.modelValue)
  hint.value = `${reason}，已恢复为 ${props.modelValue}`
}

// capture：别的控件拦掉冒泡也照样记得住「按着」
const { pressed } = useMousePressed({ capture: true })

/**
 * 按住别处的控件导致的失焦要等松手再恢复：恢复时提示可能由一行变两行，把按住的那个控件挤走，
 * 松手时指针已不在它上面，点击落空（真实 Chrome 复现过）
 */
async function onTextBlur(): Promise<void> {
  if (pressed.value)
    await until(pressed).toBe(false)
  onTextCommit()
}

/** 值没变时 watch 不会触发，点同一个预设也得亲手清掉「已恢复为」的提示 */
function pickPreset(preset: string): void {
  draft.value = preset
  hint.value = null
  emit('update:modelValue', preset)
}

/** 输入法组合中的回车是上屏，不是提交；Safari 这时 isComposing 已经为假，只能靠 keyCode 229 认出来 */
function onTextEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229)
    return
  onTextCommit()
}
</script>

<template>
  <div class="flex flex-col gap-tight">
    <div class="flex items-center justify-between text-xs op-70">
      <span class="flex items-center gap-tight">
        <a v-if="props.prop.mdn" :href="props.prop.mdn" target="_blank" rel="noopener" class="font-mono hover:underline">
          {{ props.prop.cssName }}
        </a>
        <span v-else class="font-mono">{{ props.prop.cssName }}</span>
        <span
          v-if="props.prop.demoOnly"
          :id="demoOnlyId"
          data-testid="demo-only"
          class="border border-bd rounded-full px-1.5 text-[10px] leading-4"
        >仅演示区</span>
      </span>
      <span v-if="props.prop.kind === 'number'" class="font-mono">{{ props.modelValue }}</span>
    </div>

    <div
      v-if="props.prop.kind === 'enum'"
      class="flex flex-wrap gap-tight"
      role="group"
      :aria-label="props.prop.cssName"
      :aria-describedby="describedBy"
    >
      <button
        v-for="option in props.prop.options"
        :key="option.value"
        data-testid="option"
        :data-value="option.value"
        type="button"
        class="option"
        :class="{ 'is-active': props.modelValue === option.value }"
        :aria-pressed="props.modelValue === option.value"
        @click="emit('update:modelValue', option.value)"
      >
        {{ option.value }}
      </button>
    </div>

    <input
      v-else-if="props.prop.kind === 'number'"
      type="range"
      class="slider"
      :aria-label="props.prop.cssName"
      :aria-describedby="describedBy"
      :min="props.prop.min"
      :max="props.prop.max"
      :step="props.prop.step"
      :value="props.modelValue"
      @input="onNumberInput"
      @pointerdown="setScrubbing(true)"
    >

    <div v-else-if="props.prop.kind === 'text'">
      <div class="flex flex-wrap gap-tight" role="group" :aria-label="props.prop.cssName">
        <button
          v-for="preset in props.prop.presets"
          :key="preset"
          data-testid="option"
          :data-value="preset"
          type="button"
          class="option"
          :class="{ 'is-active': props.modelValue === preset }"
          :aria-pressed="props.modelValue === preset"
          @click="pickPreset(preset)"
        >
          {{ preset }}
        </button>
        <input
          class="w-20 border border-bd rounded-1 bg-transparent px-2 py-1 text-xs font-mono"
          :aria-label="`${props.prop.cssName} 自定义值`"
          :aria-describedby="describedBy"
          :aria-invalid="draftInvalid"
          :maxlength="props.prop.maxLength"
          :value="draft"
          @input="onTextInput"
          @blur="onTextBlur"
          @keydown.enter="onTextEnter"
        >
      </div>
      <!-- live region 要一直在场，内容变了读屏才会播报；没提示时是空段落，不占高度 -->
      <p
        :id="hintId"
        data-testid="field-hint"
        role="status"
        class="text-xs op-70"
        :class="{ 'mt-tight': hint }"
      >
        {{ hint }}
      </p>
    </div>

    <label v-else class="flex cursor-pointer items-center gap-tight text-xs">
      <input
        type="checkbox"
        :aria-label="props.prop.cssName"
        :aria-describedby="describedBy"
        :checked="Boolean(props.modelValue)"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      >
      <span>{{ props.modelValue ? '开启' : '关闭' }}</span>
    </label>
  </div>
</template>

<style scoped>
.slider {
  width: 100%;
  height: 22px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: grab;
}

.slider:active {
  cursor: grabbing;
}

.slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 55%, transparent),
    color-mix(in srgb, var(--accent-2) 45%, transparent)
  );
  box-shadow: inset 0 1px 3px color-mix(in srgb, black 30%, transparent);
}

.slider::-moz-range-track {
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 55%, transparent),
    color-mix(in srgb, var(--accent-2) 45%, transparent)
  );
  box-shadow: inset 0 1px 3px color-mix(in srgb, black 30%, transparent);
}

.slider::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  margin-top: -6px;
  border: none;
  border-radius: 50%;
  appearance: none;
  background: radial-gradient(circle at 35% 30%, #fff 0%, var(--accent) 60%, var(--accent) 100%);
  box-shadow:
    0 2px 8px -1px color-mix(in srgb, var(--accent) 70%, transparent),
    0 0 0 1px color-mix(in srgb, white 25%, transparent) inset;
  transition:
    scale 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.18s ease;
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff 0%, var(--accent) 60%, var(--accent) 100%);
  box-shadow: 0 2px 8px -1px color-mix(in srgb, var(--accent) 70%, transparent);
}

.slider:hover::-webkit-slider-thumb {
  scale: 1.12;
}

.slider:active::-webkit-slider-thumb {
  scale: 1.24;
  box-shadow:
    0 4px 14px -2px color-mix(in srgb, var(--accent) 85%, transparent),
    0 0 0 6px color-mix(in srgb, var(--accent) 16%, transparent);
}

.slider:focus-visible::-webkit-slider-thumb {
  box-shadow:
    0 2px 8px -1px color-mix(in srgb, var(--accent) 70%, transparent),
    0 0 0 4px color-mix(in srgb, var(--accent-2) 40%, transparent);
}

.option {
  padding: var(--space-tight) 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  background: transparent;
  color: inherit;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  transition:
    border-color 0.18s ease,
    color 0.18s ease,
    background-color 0.18s ease,
    scale 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.option:hover {
  border-color: var(--accent);
  scale: 1.05;
}

.option:active {
  scale: 0.96;
}

.option.is-active {
  border-color: color-mix(in srgb, var(--accent) 70%, transparent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  box-shadow: 0 2px 10px -3px color-mix(in srgb, var(--accent) 60%, transparent);
}
</style>
