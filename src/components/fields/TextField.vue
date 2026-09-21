<script setup lang="ts">
import { computed } from 'vue'
import type { Field } from '@/core/types'

const props = defineProps<{ value?: any; field: Field }>()
const display = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') return ''
  const s = String(props.value).replace(/\n/g, ' ')
  return s.length > 40 ? s.slice(0, 40) + '…' : s
})
</script>

<template>
  <span v-if="!display">&mdash;</span>
  <span v-else :title="String(value)">{{ display }}</span>
</template>
