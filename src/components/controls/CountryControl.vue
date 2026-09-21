<script setup lang="ts">
import { computed, ref } from 'vue'
import { Select } from '@octans/ui'
import Countries from '@/core/data/countries'
import type { Field } from '@/core/types'

const props = defineProps<{ modelValue?: any; field: Field; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [any] }>()
const error = ref('')
const control = ref<any>(null)
const p = computed(() => props.field.params || {})
const multiple = computed(() => !!p.value.allowMultiple)
const value = computed(() => {
  const v = props.modelValue
  if (multiple.value) return Array.isArray(v) ? v : v ? [v] : []
  return Array.isArray(v) ? v[0] || null : v || null
})
const options = Countries.getData()

function validate(): boolean {
  error.value = ''
  const empty = multiple.value ? !(value.value as any[]).length : !value.value
  if (p.value.required && empty) error.value = `${props.field.label} is required.`
  return !error.value
}
defineExpose({ field: props.field, validate, focus: () => control.value?.focus?.(), addError: (m: string) => (error.value = m) })
</script>

<template>
  <Select
    ref="control"
    :label="field.label"
    :model-value="value"
    :options="options"
    :multiple="multiple"
    :tags="multiple"
    :readonly="readonly"
    :required="!!p.required"
    :error="error"
    :help-text="field.help"
    placeholder="Choose a country"
    @update:model-value="(v) => { error = ''; emit('update:modelValue', v) }"
  />
</template>
