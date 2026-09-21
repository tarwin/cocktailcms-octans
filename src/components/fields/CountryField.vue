<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@octans/ui'
import Countries from '@/core/data/countries'
import type { Field } from '@/core/types'

const props = defineProps<{ value?: any; field: Field }>()
const MAX = 3
const all = computed(() => {
  const v = props.value
  const list: string[] = Array.isArray(v) ? v : v ? [v] : []
  return list.map((iso) => Countries.getLabel(iso) || iso)
})
const shown = computed(() => all.value.slice(0, MAX))
const more = computed(() => all.value.slice(MAX))
</script>

<template>
  <span v-if="!all.length">&mdash;</span>
  <span v-else class="badges">
    <Badge v-for="d of shown" :key="d">{{ d }}</Badge>
    <abbr v-if="more.length" :title="more.join(', ')">+{{ more.length }}</abbr>
  </span>
</template>

<style scoped>
.badges {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
</style>
