<script setup lang="ts">
import { computed, ref } from 'vue'
import { Modal, Select } from '@octans/ui'
import type { Blueprint, DataRecord } from '@/core/types'
import { useApi } from '@/store'

const visible = ref(false)
const loading = ref(false)
const schema = ref<Blueprint | null>(null)
const record = ref<DataRecord | null>(null)
const linkField = ref('')
const linkFieldSecondary = ref('')
const linkData = ref<DataRecord[]>([])
const replaceWithId = ref<number | null>(null)
let cb: ((recordId: number, replaceWithId?: number | null) => void) | null = null

const options = computed(() =>
  linkData.value
    .filter((d) => d.id !== record.value?.id)
    .map((d) => ({
      value: d.id,
      label: String(d[linkField.value] ?? `#${d.id}`),
      description: linkFieldSecondary.value ? String(d[linkFieldSecondary.value] ?? '') : undefined,
    })),
)

async function show(callback: typeof cb, s: Blueprint, r: DataRecord) {
  cb = callback
  schema.value = s
  record.value = r
  replaceWithId.value = null
  visible.value = true
  loading.value = true
  const sorted = [...s.fields].sort((a, b) => a.order - b.order)
  const displayId = s.linkFieldDisplayDefault || sorted[0]?.id
  linkField.value = s.fields.find((f) => f.id === displayId)?.key || sorted[0]?.key || 'id'
  linkFieldSecondary.value = s.fields.find((f) => f.id === s.linkFieldDisplayDefaultSecondary)?.key || ''
  const keys = [linkField.value]
  if (linkFieldSecondary.value) keys.push(linkFieldSecondary.value)
  linkData.value = await useApi().getData(s.id, keys)
  loading.value = false
}

function remove() {
  visible.value = false
  if (record.value) cb?.(record.value.id, null)
}
function removeAndReplace() {
  visible.value = false
  if (record.value) cb?.(record.value.id, replaceWithId.value)
}
defineExpose({ show })
</script>

<template>
  <Modal
    title="Remove record?"
    :visible="visible"
    :loading="loading"
    overflow-visible
    :primary-action="{ label: 'Remove', type: 'destructive', disabled: !!replaceWithId, onAction: remove }"
    :secondary-actions="[
      { label: 'Cancel', onAction: () => (visible = false) },
      { label: 'Remove and replace', type: 'primary', disabled: !replaceWithId, onAction: removeAndReplace },
    ]"
    @close="visible = false"
  >
    <p>Other records that link to this one will have the link cleared, unless you choose a replacement.</p>
    <Select v-model="replaceWithId" label="Replace links with" placeholder="Keep links empty" :options="options" clearable />
  </Modal>
</template>
