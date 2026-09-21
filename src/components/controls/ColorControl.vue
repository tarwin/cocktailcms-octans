<script setup lang="ts">
import { computed, ref } from 'vue'
import { ColorSelector, Select } from '@octans/ui'
import type { Field, ProjectSettings } from '@/core/types'

const props = defineProps<{ modelValue?: any; field: Partial<Field> & { label: string }; readonly?: boolean; settings?: ProjectSettings | null }>()
const emit = defineEmits<{ 'update:modelValue': [any] }>()
const error = ref('')
const p = computed(() => props.field.params || {})
const palette = computed(() => props.settings?.pallete || [])
const paletteOnly = computed(() => p.value.picker === 'pallete')
const paletteOptions = computed(() => palette.value.map((c) => ({ value: c, label: c })))

function validate(): boolean {
  error.value = ''
  if (p.value.required && !props.modelValue) error.value = `${props.field.label} is required.`
  return !error.value
}
defineExpose({ field: props.field, validate, focus: () => {}, addError: (m: string) => (error.value = m) })
</script>

<template>
  <Select
    v-if="paletteOnly"
    :label="field.label"
    :model-value="modelValue || null"
    :options="paletteOptions"
    :readonly="readonly"
    :error="error"
    :help-text="field.help || (palette.length ? '' : 'Add colours to the palette in project settings.')"
    placeholder="Choose a colour"
    @update:model-value="(v) => { error = ''; emit('update:modelValue', v) }"
  />
  <ColorSelector
    v-else
    :label="field.label"
    :model-value="modelValue || null"
    :alpha="p.allowAlpha !== false"
    format="hex"
    :swatches="palette"
    :swatch-shape="p.displayAs === 'circle' ? 'circle' : 'square'"
    :trigger="p.displayAs === 'value' ? 'input' : 'button'"
    :show-value="p.displayAs === 'value'"
    :readonly="readonly"
    :clearable="!p.required"
    :error="error"
    :help-text="field.help"
    full-width
    @update:model-value="(v) => { error = ''; emit('update:modelValue', typeof v === 'string' ? v : '') }"
  />
</template>
