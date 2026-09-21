<script setup lang="ts">
import type { Field } from '@/core/types'

defineProps<{ value?: any; field: Field }>()
const fmt = (v: any) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n.toFixed(3) : '?'
}
</script>

<template>
  <span v-if="!value || (!value.lat && !value.long)">&mdash;</span>
  <span v-else>{{ fmt(value.lat) }}, {{ fmt(value.long) }}</span>
</template>
