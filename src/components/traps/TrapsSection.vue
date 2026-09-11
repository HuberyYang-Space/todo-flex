<script setup lang="ts">
import { traps } from '~/data/traps'
import TrapSection from './TrapSection.vue'
</script>

<template>
  <div class="w-full">
    <header class="mx-auto max-w-360 w-full flex flex-col gap-1 p-4 pt-12">
      <h2 class="text-2xl font-bold">
        五个常见陷阱
      </h2>
      <p class="text-sm op-70">
        每个都是「现象 → 归因 → 修复」三拍，随滚动推进。看完可以一键载回上面的 Playground 自己调。
      </p>
    </header>

    <TrapSection v-for="trap in traps" :key="trap.id" :trap="trap" />
  </div>
</template>
