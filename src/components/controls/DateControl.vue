<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { DatePicker } from '@octans/ui'
import type { Field } from '@/core/types'

const props = defineProps<{ modelValue?: any; field: Field; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [any] }>()
const error = ref('')
const control = ref<any>(null)
const p = computed(() => props.field.params || {})
const withTime = computed(() => !!p.value.withTime)
const modelFormat = computed(() => (withTime.value ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'))
const value = computed(() => {
  const v = props.modelValue
  if (!v) return ''
  return withTime.value ? String(v) : String(v).slice(0, 10)
})
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function disableDate(d: Dayjs): boolean {
  const dis: number[] = p.value.disableForDaysOfWeek || []
  if (dis.length && dis.includes(d.day())) return true
  if (p.value.minDate && dayjs(p.value.minDate).isAfter(d, 'day')) return true
  if (p.value.maxDate && dayjs(p.value.maxDate).isBefore(d, 'day')) return true
  return false
}

const helpText = computed(() => {
  if (props.field.help) return props.field.help
  let help = ''
  if (p.value.minDate) help += `From ${dayjs(p.value.minDate).format('MMM D, YYYY')}. `
  if (p.value.maxDate) help += `Until ${dayjs(p.value.maxDate).format('MMM D, YYYY')}. `
  const dis: number[] = p.value.disableForDaysOfWeek || []
  if (dis.length) help += `Not on ${dis.map((i) => days[i]).join(', ')}.`
  return help
})

function validate(): boolean {
  error.value = ''
  if (!value.value) {
    if (p.value.required) error.value = `${props.field.label} is required.`
    return !error.value
  }
  const d = dayjs(value.value)
  if (!d.isValid()) error.value = 'Invalid date.'
  else if (disableDate(d)) error.value = 'That date is not allowed.'
  return !error.value
}

defineExpose({
  field: props.field,
  validate,
  focus: () => control.value?.$el?.querySelector?.('input')?.focus(),
  addError: (m: string) => (error.value = m),
})
</script>

<template>
  <DatePicker
    ref="control"
    :label="field.label"
    :model-value="value"
    :model-format="modelFormat"
    :type="withTime ? 'datetime' : 'date'"
    placeholder="Choose a date"
    :readonly="readonly"
    :required="!!p.required"
    :error="error"
    :help-text="helpText"
    :disable-date="disableDate"
    :min-date="p.minDate || undefined"
    :max-date="p.maxDate || undefined"
    :auto-open="false"
    :clearable="!p.required"
    @update:model-value="(v) => { error = ''; emit('update:modelValue', v || '') }"
  />
</template>
