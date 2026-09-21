<script setup lang="ts">
import type { FlexItemState } from '~/core/types'
import type { FlexShorthandPreset } from '~/data/flexProperties'
import { useFlexState } from '~/composables/useFlexState'
import { flexShorthandPresets, itemProperties } from '~/data/flexProperties'
import PropertyField from './PropertyField.vue'

const { selectedItem } = useFlexState()

function valueOf(item: FlexItemState, key: string): string | number | boolean {
  return item[key as keyof FlexItemState]
}

function update(item: FlexItemState, key: string, value: string | number | boolean): void {
  // 属性表的 key 与状态字段一一对应；Object.assign 免去不合法的索引签名断言
  Object.assign(item, { [key]: value })
}

/** flex 简写是一次写三个分量，这里直接回填，让用户看到简写到底展开成了什么 */
function applyPreset(item: FlexItemState, preset: FlexShorthandPreset): void {
  item.grow = preset.grow
  item.shrink = preset.shrink
  item.basis = preset.basis
}

function isPresetActive(item: FlexItemState, preset: FlexShorthandPreset): boolean {
  return item.grow === preset.grow && item.shrink === preset.shrink && item.basis === preset.basis
}
</script>

<template>
  <section class="flex flex-col gap-space">
    <h2 data-testid="item-title" class="panel-title">
      <div class="i-carbon-settings-adjust" />
      盒子属性<template v-if="selectedItem">
        · {{ selectedItem.id }}
      </template>
    </h2>

    <p v-if="!selectedItem" data-testid="item-empty" class="text-xs op-60">
      点击演示区里的任意盒子来编辑它的属性
    </p>

    <template v-else>
      <div class="flex flex-col gap-tight">
        <div class="text-xs op-70">
          <span class="font-mono">flex</span> 简写
        </div>
        <div class="flex flex-wrap gap-tight">
          <button
            v-for="preset in flexShorthandPresets"
            :key="preset.label"
            data-testid="flex-preset"
            :data-preset="preset.label"
            class="preset"
            :class="{ 'is-active': isPresetActive(selectedItem, preset) }"
            @click="applyPreset(selectedItem, preset)"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>

      <PropertyField
        v-for="prop in itemProperties"
        :key="prop.key"
        :prop="prop"
        :model-value="valueOf(selectedItem, prop.key)"
        @update:model-value="update(selectedItem, prop.key, $event)"
      />
    </template>
  </section>
</template>

<style scoped>
.preset {
  padding: var(--space-tight) 10px;
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

.preset:hover {
  border-color: var(--accent-2);
}

.preset.is-active {
  border-color: var(--accent-2);
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 12%, transparent);
}
</style>
