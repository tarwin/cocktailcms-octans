<script setup lang="ts">
import { Checkbox, FormLayout } from '@octans/ui'
import { useParams } from './useParams'

const props = defineProps<{ modelValue?: Record<string, any>; schema?: any }>()
const emit = defineEmits<{ 'update:modelValue': [Record<string, any>] }>()
const p = useParams(props, emit, { required: false })
</script>

<template>
  <FormLayout>
    <Checkbox v-model="p.required" label="Required?" />
  </FormLayout>
</template>
