<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Labelled, Stack, Thumbnail } from '@octans/ui'
import { bus } from '@/core/bus'
import type { Field, FileMeta } from '@/core/types'
import { downloadBlob } from '@/core/utils'
import { useApi } from '@/store'

const props = defineProps<{ modelValue?: any; field: Field; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [any] }>()
const error = ref('')
const url = ref('')
const p = computed(() => props.field.params || {})
const image = computed<FileMeta | null>(() => (props.modelValue && props.modelValue.id ? props.modelValue : null))

watch(
  () => image.value?.id,
  async (id) => {
    url.value = id ? await useApi().getImageDataUrl(id, true) : ''
  },
  { immediate: true },
)

function select() {
  bus.emit(
    'showLibrary',
    (f: FileMeta | null) => {
      if (f) {
        error.value = ''
        emit('update:modelValue', { id: f.id, name: f.name, mimeType: f.mimeType, size: f.size, width: f.width, height: f.height })
      }
    },
    { type: 'image', selectedId: image.value?.id },
  )
}
async function download() {
  if (!image.value) return
  const blob = await useApi().getFileBlob(image.value.id)
  if (blob) downloadBlob(blob, image.value.name)
}
function validate(): boolean {
  error.value = ''
  if (p.value.required && !image.value) error.value = `${props.field.label} is required.`
  return !error.value
}
defineExpose({ field: props.field, validate, focus: () => {}, addError: (m: string) => (error.value = m) })
</script>

<template>
  <Labelled :label="field.label" :error="error" :help-text="field.help" :required="!!p.required">
    <div v-if="image" class="details">
      <Thumbnail :url="url" :alt="image.name" size="large" />
      <div>
        <div>{{ image.name }}</div>
        <div class="muted" v-if="image.width">{{ image.width }} &times; {{ image.height }}</div>
        <Button type="link" icon="mdi:download" size="small" @click="download">Download</Button>
      </div>
    </div>
    <Stack spacing="tight">
      <Button :disabled="readonly" @click="select">{{ image ? 'Change Image' : 'Select Image' }}</Button>
      <Button v-if="image && !p.required && !readonly" type="plain" @click="emit('update:modelValue', null)">Remove</Button>
    </Stack>
  </Labelled>
</template>

<style scoped>
.details {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
</style>
