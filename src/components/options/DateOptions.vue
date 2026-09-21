<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Checkbox, DatePicker, FormLayout, Select, TextField } from '@octans/ui'
import { useApi } from '@/store'
import { useParams } from './useParams'

const props = defineProps<{ modelValue?: Record<string, any>; schema?: any }>()
const emit = defineEmits<{ 'update:modelValue': [Record<string, any>] }>()
const p = useParams(props, emit, {
  required: false,
  withTime: false,
  format: '',
  fieldRelative: false,
  fieldFormat: '',
  disableForDaysOfWeek: [] as number[],
  minDate: null as string | null,
  maxDate: null as string | null,
  defaultValue: null as string | null,
})
const errors = ref<Record<string, string>>({})

onMounted(async () => {
  const s = await useApi().getSettings()
  if (!p.format) p.format = s.defaultDateDataFormat || (p.withTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD')
  if (!p.fieldFormat) p.fieldFormat = s.defaultDateDisplayFormat || 'MMM Do, YYYY'
})

watch(
  () => p.withTime,
  (withTime) => {
    if (withTime && p.format === 'YYYY-MM-DD') p.format = 'YYYY-MM-DD HH:mm:ss'
    else if (!withTime && p.format === 'YYYY-MM-DD HH:mm:ss') p.format = 'YYYY-MM-DD'
  },
)

const daysOfWeek = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

function validateFields() {
  errors.value = {}
  if (!String(p.format || '').trim()) errors.value.format = 'Required'
  if (!p.fieldRelative && !String(p.fieldFormat || '').trim()) errors.value.fieldFormat = 'Required'
  return !Object.keys(errors.value).length
}
defineExpose({ validateFields })
</script>

<template>
  <FormLayout>
    <Checkbox v-model="p.required" label="Required?" />
    <Checkbox v-model="p.withTime" label="Include time?" help-text="Also allow the user to enter a time?" />
    <Select v-model="p.disableForDaysOfWeek" label="Disable for days of the week" :options="daysOfWeek" multiple tags />
    <DatePicker :model-value="p.minDate || undefined" label="Minimum Date" :auto-open="false" clearable @update:model-value="(v) => (p.minDate = v)" />
    <DatePicker :model-value="p.maxDate || undefined" label="Maximum Date" :auto-open="false" clearable @update:model-value="(v) => (p.maxDate = v)" />
    <TextField
      v-model="p.format"
      label="Input Format"
      placeholder="defaults to 'YYYY-MM-DD'"
      help-text="Day.js format (https://day.js.org/docs/en/display/format)"
      :error="errors.format"
    />
    <Checkbox v-model="p.fieldRelative" label="Display field as relative?" help-text="ie '1 day ago' or 'In a few seconds'" />
    <TextField
      v-show="!p.fieldRelative"
      v-model="p.fieldFormat"
      label="Display Field Format"
      placeholder="defaults to 'MMM Do, YYYY'"
      help-text="Same as above, but for display in lists"
      :error="errors.fieldFormat"
    />
    <DatePicker :model-value="p.defaultValue || undefined" label="Default" :auto-open="false" :type="p.withTime ? 'datetime' : 'date'" clearable @update:model-value="(v) => (p.defaultValue = v)" />
  </FormLayout>
</template>
