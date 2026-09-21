<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Checkbox, FormLayout, Select } from '@octans/ui'
import type { Blueprint, BlueprintSummary } from '@/core/types'
import { useApi } from '@/store'
import { useParams } from './useParams'

const props = defineProps<{ modelValue?: Record<string, any>; schema?: Blueprint }>()
const emit = defineEmits<{ 'update:modelValue': [Record<string, any>] }>()
const p = useParams(props, emit, {
  required: false,
  linkId: null as number | null,
  linkFieldId: null as string | null,
  linkFieldDisplay: [] as string[],
})
const schemas = ref<BlueprintSummary[]>([])
const linkSchema = ref<Blueprint | null>(null)
const errors = ref<Record<string, string>>({})

onMounted(async () => {
  schemas.value = await useApi().getSchemaList()
})
watch(
  () => p.linkId,
  async (id) => {
    linkSchema.value = id ? await useApi().getSchema(Number(id)) : null
  },
  { immediate: true },
)

const schemaOptions = computed(() => schemas.value.filter((s) => s.id !== props.schema?.id).map((s) => ({ value: s.id, label: s.label })))
const displayFields = computed(() => (linkSchema.value?.fields || []).map((f) => ({ value: f.key, label: f.label })))
const linkFields = computed(() =>
  (linkSchema.value?.fields || [])
    .filter((f) => f.type === 'link' && Number(f.params?.linkId) === Number(props.schema?.id))
    .map((f) => ({ value: f.key, label: f.label })),
)

function validateFields() {
  errors.value = {}
  if (!p.linkId) errors.value.linkId = 'Required'
  if (!p.linkFieldId) errors.value.linkFieldId = 'Required'
  if (!p.linkFieldDisplay?.length) errors.value.linkFieldDisplay = 'Required'
  return !Object.keys(errors.value).length
}
defineExpose({ validateFields })
</script>

<template>
  <FormLayout>
    <Checkbox v-model="p.required" label="Required?" help-text="At least one sub-record must exist." />
    <Select v-model="p.linkId" label="Sub Blueprint" :options="schemaOptions" :error="errors.linkId" placeholder="Choose a blueprint" />
    <Select
      v-if="linkSchema"
      v-model="p.linkFieldId"
      label="Link to field"
      :options="linkFields"
      :error="errors.linkFieldId"
      help-text="A Link field on the sub blueprint that points back to this blueprint."
      :no-options="'The sub blueprint has no Link field pointing at this blueprint yet.'"
    />
    <Select v-if="linkSchema" v-model="p.linkFieldDisplay" label="Fields to display" :options="displayFields" multiple tags :error="errors.linkFieldDisplay" />
  </FormLayout>
</template>
