<script setup lang="ts">
import { Checkbox, FormLayout, Select } from '@octans/ui'
import { useParams } from './useParams'

const props = defineProps<{ modelValue?: Record<string, any>; schema?: any }>()
const emit = defineEmits<{ 'update:modelValue': [Record<string, any>] }>()
const p = useParams(props, emit, {
  required: false,
  onlyGray: false,
  allowAlpha: true,
  format: 'hex',
  displayAs: 'circle',
  picker: 'picker',
})
</script>

<template>
  <FormLayout>
    <Checkbox v-model="p.required" label="Required?" />
    <Select
      v-model="p.picker"
      label="Picker Type"
      :options="[
        { value: 'picker', label: 'Full picker' },
        { value: 'pallete', label: 'Project palette only' },
      ]"
      :help-text="p.picker === 'pallete' ? 'The palette is defined in project settings' : ''"
    />
    <Checkbox v-if="p.picker === 'picker'" v-model="p.allowAlpha" label="Allow Alpha?" />
    <Select
      v-model="p.displayAs"
      label="Display As"
      :options="[
        { value: 'circle', label: 'Circle' },
        { value: 'rect', label: 'Rectangle' },
        { value: 'value', label: 'Value' },
      ]"
    />
  </FormLayout>
</template>
