<script setup lang="ts">
import type { FlexContainerState } from '~/core/types'
import { useFlexState } from '~/composables/useFlexState'
import { containerProperties } from '~/data/flexProperties'
import PropertyField from './PropertyField.vue'

const { state } = useFlexState()

function valueOf(key: string): string | number | boolean {
  return state.container[key as keyof FlexContainerState]
}

function update(key: string, value: string | number | boolean): void {
  // 属性表的 key 与状态字段一一对应；Object.assign 免去不合法的索引签名断言
  Object.assign(state.container, { [key]: value })
}
</script>

<template>
  <section class="flex flex-col gap-space">
    <h2 class="panel-title">
      <div class="i-carbon-container-software" />
      容器属性
    </h2>

    <PropertyField
      v-for="prop in containerProperties"
      :key="prop.key"
      :prop="prop"
      :model-value="valueOf(prop.key)"
      @update:model-value="update(prop.key, $event)"
    />
  </section>
</template>
