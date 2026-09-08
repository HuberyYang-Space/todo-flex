<script setup lang="ts">
import type { PropertyDef } from '~/data/flexProperties'
import { visibleOptions } from '~/data/flexProperties'

const props = defineProps<{
  prop: PropertyDef
  modelValue: string | number | boolean
  showAdvanced: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
}>()

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
      class="w-full"
      :min="props.prop.min"
      :max="props.prop.max"
      :step="props.prop.step"
      :value="props.modelValue"
      @input="onNumberInput"
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
.option {
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  color: inherit;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}

.option:hover {
  border-color: var(--accent);
}

.option.is-active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
</style>
