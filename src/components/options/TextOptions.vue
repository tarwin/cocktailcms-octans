<script setup lang="ts">
import { Checkbox, FormLayout, FormLayoutGroup, Select, TextField } from '@octans/ui'
import { useParams } from './useParams'

const props = defineProps<{ modelValue?: Record<string, any>; schema?: any }>()
const emit = defineEmits<{ 'update:modelValue': [Record<string, any>] }>()
const p = useParams(props, emit, {
  required: false,
  type: 'single',
  min: null as number | null,
  max: null as number | null,
  regex: '',
  defaultValue: '',
})
</script>

<template>
  <FormLayout>
    <Checkbox v-model="p.required" label="Required?" />
    <Select
      v-model="p.type"
      label="Input Type"
      :options="[
        { value: 'single', label: 'Single line' },
        { value: 'multi', label: 'Multi line' },
        { value: 'markdown', label: 'Markdown' },
      ]"
    />
    <FormLayoutGroup>
      <TextField v-model="p.min" label="Min Length" type="number" placeholder="0" />
      <TextField v-model="p.max" label="Max Length" type="number" placeholder="None" />
    </FormLayoutGroup>
    <TextField v-model="p.regex" label="Regular Expression Validation" placeholder="ie ^test+$" monospace />
    <TextField v-model="p.defaultValue" label="Default Value" :multiline="p.type !== 'single'" />
  </FormLayout>
</template>
