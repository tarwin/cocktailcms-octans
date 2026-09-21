<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Icon, Labelled, Stack } from '@octans/ui'
import { bus } from '@/core/bus'
import type { Field, FileMeta } from '@/core/types'
import { downloadBlob, getFileTypeIcon } from '@/core/utils'
import { useApi } from '@/store'

const props = defineProps<{ modelValue?: any; field: Field; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [any] }>()
const error = ref('')
const p = computed(() => props.field.params || {})
const file = computed<FileMeta | null>(() => (props.modelValue && props.modelValue.id ? props.modelValue : null))

function select() {
  bus.emit(
    'showLibrary',
    (f: FileMeta | null) => {
      if (f) {
        error.value = ''
        emit('update:modelValue', { id: f.id, name: f.name, mimeType: f.mimeType, size: f.size })
      }
    },
    { type: 'all', selectedId: file.value?.id },
  )
}
async function download() {
  if (!file.value) return
  const blob = await useApi().getFileBlob(file.value.id)
  if (blob) downloadBlob(blob, file.value.name)
}
function validate(): boolean {
  error.value = ''
  if (p.value.required && !file.value) error.value = `${props.field.label} is required.`
  return !error.value
}
defineExpose({ field: props.field, validate, focus: () => {}, addError: (m: string) => (error.value = m) })
</script>

<template>
  <Labelled :label="field.label" :error="error" :help-text="field.help" :required="!!p.required">
    <div v-if="file" class="details">
      <Icon :icon="getFileTypeIcon(file.mimeType)" size="20px" />
      <span>{{ file.name }}</span>
      <Button type="link" icon="mdi:download" size="small" @click="download" />
    </div>
    <Stack spacing="tight">
      <Button :disabled="readonly" @click="select">{{ file ? 'Change File' : 'Select File' }}</Button>
      <Button v-if="file && !p.required && !readonly" type="plain" @click="emit('update:modelValue', null)">Remove</Button>
    </Stack>
  </Labelled>
</template>

<style scoped>
.details {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
</style>
