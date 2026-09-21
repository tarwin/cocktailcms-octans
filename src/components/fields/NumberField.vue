<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@octans/ui'
import type { Field } from '@/core/types'
import { toIconName } from '@/core/utils'

const props = defineProps<{ value?: any; field: Field }>()
const p = computed(() => props.field.params || {})
const num = computed(() => parseFloat(props.value))
const iconValues = computed(() => {
  const values: number[] = []
  const max = parseFloat(p.value.max)
  const step = parseFloat(p.value.step) || 1
  if (!max) return values
  let c = parseFloat(p.value.min) || 0
  let i = 0
  while (c <= max && i < 10) {
    values.push(c)
    c += step
    i++
  }
  return values
})
</script>

<template>
  <span v-if="p.displayAs === 'icon' && iconValues.length" class="icons">
    <span v-for="v of iconValues" :key="v" :style="{ color: num >= v ? p.iconOnColor : p.iconOffColor }">
      <Icon :icon="toIconName(num >= v ? p.iconOn : p.iconOff)" />
    </span>
  </span>
  <span v-else-if="value === undefined || value === null || value === ''">&mdash;</span>
  <span v-else>{{ value }}</span>
</template>

<style scoped>
.icons {
  display: inline-flex;
  gap: 3px;
}
</style>
