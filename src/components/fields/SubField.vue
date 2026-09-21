<script setup lang="ts">
import { ref, watch } from 'vue'
import { Badge } from '@octans/ui'
import type { Field } from '@/core/types'
import { useApi } from '@/store'

const props = defineProps<{ value?: any; field: Field; recordId?: number }>()
const count = ref<number | null>(null)

async function load() {
  const p = props.field.params || {}
  if (!p.linkId || !p.linkFieldId || !props.recordId) {
    count.value = 0
    return
  }
  count.value = await useApi().getDataCount(Number(p.linkId), null, { [p.linkFieldId]: props.recordId })
}
watch(() => [props.recordId, props.value], load, { immediate: true })
</script>

<template>
  <span v-if="count === null">…</span>
  <span v-else-if="!count">&mdash;</span>
  <Badge v-else>{{ count }}</Badge>
</template>
