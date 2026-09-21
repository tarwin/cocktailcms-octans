<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import type { Field } from '@/core/types'

dayjs.extend(relativeTime)
dayjs.extend(advancedFormat)

const props = defineProps<{ value?: any; field: Field }>()
const display = computed(() => {
  if (!props.value) return ''
  const p = props.field.params || {}
  const d = dayjs(props.value)
  if (!d.isValid()) return String(props.value)
  if (p.fieldRelative) {
    const s = d.fromNow()
    return s[0].toUpperCase() + s.slice(1)
  }
  return d.format(p.fieldFormat || 'MMM Do, YYYY')
})
</script>

<template>
  <span v-if="!display">&mdash;</span>
  <span v-else>{{ display }}</span>
</template>
