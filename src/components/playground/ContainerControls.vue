<script setup lang="ts">
import type { FlexContainerState } from '~/core/types'
import { ref } from 'vue'
import { useFlexState } from '~/composables/useFlexState'
import { containerProperties } from '~/data/flexProperties'
import PropertyField from './PropertyField.vue'

const { state } = useFlexState()
const showAdvanced = ref(false)

function valueOf(key: string): string | number | boolean {
  return state.container[key as keyof FlexContainerState]
}

function update(key: string, value: string | number | boolean): void {
  // 属性表的 key 与状态字段一一对应；Object.assign 免去不合法的索引签名断言
  Object.assign(state.container, { [key]: value })
}
</script>

<template>
  <section>
    <header class="mb-2 flex items-center justify-between">
      <h2 class="text-sm font-bold">
        容器属性
      </h2>
      <button
        data-testid="toggle-advanced"
        class="text-xs op-60 hover:op-100"
        @click="showAdvanced = !showAdvanced"
      >
        {{ showAdvanced ? '收起更多值' : '更多值' }}
      </button>
    </header>

    <PropertyField
      v-for="prop in containerProperties"
      :key="prop.key"
      :prop="prop"
      :show-advanced="showAdvanced"
      :model-value="valueOf(prop.key)"
      @update:model-value="update(prop.key, $event)"
    />
  </section>
</template>
