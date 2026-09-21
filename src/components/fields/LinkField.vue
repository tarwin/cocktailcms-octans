<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@octans/ui'
import type { Field, LinkedData } from '@/core/types'
import ColorField from './ColorField.vue'

const props = defineProps<{ value?: any; field: Field; data?: LinkedData }>()
const MAX = 3
const all = computed(() => {
  const v = props.value
  const ids: number[] = Array.isArray(v) ? v : v === '' || v === null || v === undefined ? [] : [v]
  const linked = props.data?.[Number(props.field.params?.linkId)]
  if (!linked) return []
  const key = props.field.params?.linkFieldDisplay
  const out: string[] = []
  for (const id of ids) {
    const d = linked.data.find((r) => r.id === id)
    if (d) out.push(String(d[key] ?? ''))
  }
  return out.sort((a, b) => a.localeCompare(b))
})
const shown = computed(() => all.value.slice(0, MAX))
const more = computed(() => all.value.slice(MAX))
const isColor = computed(() => props.field.params?.linkFieldDisplayType === 'color')
</script>

<template>
  <span v-if="!all.length">&mdash;</span>
  <span v-else class="badges">
    <template v-if="isColor">
      <ColorField v-for="d of shown" :key="d" :value="d" :field="{ id: 0, key: '', label: '', type: 'color', order: 0, params: {} }" />
    </template>
    <template v-else>
      <Badge v-for="d of shown" :key="d">{{ d }}</Badge>
    </template>
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
