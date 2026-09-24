<script setup lang="ts">
import type { FlexContainerState } from '~/core/types'
import { containerProperties } from '~/data/flexProperties'

const { state } = useFlexState()

function valueOf(key: keyof FlexContainerState): string | number | boolean {
  return state.container[key]
}

function update(key: string, value: string | number | boolean): void {
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
