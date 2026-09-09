<script setup lang="ts">
import type { PropertyDef } from '~/data/flexProperties'
import { useFlip } from '~/composables/useFlip'
import { visibleOptions } from '~/data/flexProperties'

const props = defineProps<{
  prop: PropertyDef
  modelValue: string | number | boolean
  showAdvanced: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
}>()

const { setScrubbing } = useFlip()

function onNumberInput(event: Event): void {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value))
}

function onTextInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="mb-3">
    <div class="mb-1 flex items-center justify-between text-xs op-70">
      <a :href="props.prop.mdn" target="_blank" rel="noopener" class="font-mono hover:underline">
        {{ props.prop.cssName }}
      </a>
      <span v-if="props.prop.kind === 'number'" class="font-mono">{{ props.modelValue }}</span>
    </div>

    <div v-if="props.prop.kind === 'enum'" class="flex flex-wrap gap-1">
      <button
        v-for="option in visibleOptions(props.prop, props.showAdvanced)"
        :key="option.value"
        data-testid="option"
        :data-value="option.value"
        class="option"
        :class="{ 'is-active': props.modelValue === option.value }"
        @click="emit('update:modelValue', option.value)"
      >
        {{ option.value }}
      </button>
    </div>

    <input
      v-else-if="props.prop.kind === 'number'"
      type="range"
      class="slider"
      :min="props.prop.min"
      :max="props.prop.max"
      :step="props.prop.step"
      :value="props.modelValue"
      @input="onNumberInput"
      @pointerdown="setScrubbing(true)"
    >

    <div v-else-if="props.prop.kind === 'text'" class="flex flex-wrap gap-1">
      <button
        v-for="preset in props.prop.presets"
        :key="preset"
        data-testid="option"
        :data-value="preset"
        class="option"
        :class="{ 'is-active': props.modelValue === preset }"
        @click="emit('update:modelValue', preset)"
      >
        {{ preset }}
      </button>
      <input
        class="w-20 border border-bd rounded-1 bg-transparent px-2 py-1 text-xs font-mono"
        :value="props.modelValue"
        @input="onTextInput"
      >
    </div>

    <label v-else class="flex cursor-pointer items-center gap-2 text-xs">
      <input
        type="checkbox"
        :checked="Boolean(props.modelValue)"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      >
      <span>{{ props.modelValue ? '开启' : '关闭' }}</span>
    </label>
  </div>
</template>

<style scoped>
/*
 * 圆润的自定义滑块。原生 range 在各浏览器里长得都不一样且棱角分明，
 * 轨道与滑块分开定义才能做出一致的质感。
 */
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

/* 抓住时滑块微微鼓起来，像被指尖压住 */
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
  padding: 3px 10px;
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
