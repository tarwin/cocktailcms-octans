<script setup lang="ts">
import { computed, ref } from 'vue'
import { TextField } from '@octans/ui'
import type { Field } from '@/core/types'

const props = defineProps<{ modelValue?: any; field: Field; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [any] }>()
const error = ref('')
const control = ref<InstanceType<typeof TextField> | null>(null)
const p = computed(() => props.field.params || {})
const type = computed(() => p.value.type || 'single')

const helpText = computed(() => {
  if (props.field.help) return props.field.help
  let help = ''
  if (p.value.min && p.value.max) help = `Between ${p.value.min} and ${p.value.max} characters. `
  else if (p.value.min) help = `Minimum ${p.value.min} characters. `
  else if (p.value.max) help = `Maximum ${p.value.max} characters. `
  if (type.value === 'markdown') help += 'Markdown possible. '
  if (p.value.regex) help += `Must match "${p.value.regex}".`
  return help
})

function validate(): boolean {
  error.value = ''
  const v = String(props.modelValue ?? '')
  if (p.value.required && !v.trim()) error.value = `${props.field.label} is required.`
  else if (p.value.min && v.length < Number(p.value.min)) error.value = `Must be at least ${p.value.min} characters.`
  else if (p.value.max && v.length > Number(p.value.max)) error.value = `Must be at most ${p.value.max} characters.`
  else if (p.value.regex && v) {
    try {
      if (!new RegExp(p.value.regex).test(v)) error.value = `Must match "${p.value.regex}".`
    } catch {
      /* invalid regex: ignore */
    }
  }
  return !error.value
}

defineExpose({
  field: props.field,
  validate,
  focus: () => control.value?.focus(),
  addError: (msg: string) => (error.value = msg),
})
</script>

<template>
  <div :class="{ sMonospace: type === 'markdown' }">
    <TextField
      ref="control"
      :label="field.label"
      :model-value="modelValue ?? ''"
      :multiline="type !== 'single' ? 4 : false"
      :readonly="readonly"
      :required="!!p.required"
      :error="error"
      :help-text="helpText"
      :monospace="type === 'markdown'"
      @update:model-value="(v) => { error = ''; emit('update:modelValue', v) }"
    />
  </div>
</template>
