<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Checkbox, FormLayout, Select } from '@octans/ui'
import type { Blueprint, BlueprintSummary } from '@/core/types'
import { typesThatCanBeDisplayedInLink } from '@/core/utils'
import { useApi } from '@/store'
import { useParams } from './useParams'

const props = defineProps<{ modelValue?: Record<string, any>; schema?: any }>()
const emit = defineEmits<{ 'update:modelValue': [Record<string, any>] }>()
const p = useParams(props, emit, {
  linkId: null as number | null,
  linkFieldDisplay: null as string | null,
  linkFieldDisplayDesc: null as string | null,
  linkFieldDisplayType: null as string | null,
  linkFieldDisplayDescType: null as string | null,
  required: false,
  displayAs: 'select',
  allowEditChild: true,
  allowMultiple: false,
  showTags: false,
})

const schemas = ref<BlueprintSummary[]>([])
const linkSchema = ref<Blueprint | null>(null)
const errors = ref<Record<string, string>>({})

onMounted(async () => {
  schemas.value = await useApi().getSchemaList()
})

watch(
  () => p.linkId,
  async (id, old) => {
    if (!id) {
      linkSchema.value = null
      return
    }
    linkSchema.value = await useApi().getSchema(Number(id))
    if (old && old !== id) {
      p.linkFieldDisplay = null
      p.linkFieldDisplayDesc = null
    }
    const s = linkSchema.value
    if (s) {
      const d1 = s.fields.find((f) => f.id === s.linkFieldDisplayDefault)
      const d2 = s.fields.find((f) => f.id === s.linkFieldDisplayDefaultSecondary)
      if (!p.linkFieldDisplay && d1) p.linkFieldDisplay = d1.key
      if (!p.linkFieldDisplayDesc && d2) p.linkFieldDisplayDesc = d2.key
    }
  },
  { immediate: true },
)

watch(
  () => [p.linkFieldDisplay, p.linkFieldDisplayDesc, linkSchema.value],
  () => {
    const s = linkSchema.value
    p.linkFieldDisplayType = s?.fields.find((f) => f.key === p.linkFieldDisplay)?.type || null
    p.linkFieldDisplayDescType = s?.fields.find((f) => f.key === p.linkFieldDisplayDesc)?.type || null
  },
)

watch(
  () => p.allowMultiple,
  (multi) => {
    if (multi && p.displayAs === 'radio') p.displayAs = 'check'
    if (!multi && p.displayAs === 'check') p.displayAs = 'radio'
  },
)

const schemaOptions = computed(() => schemas.value.map((s) => ({ value: s.id, label: s.label })))
const linkDisplayFields = computed(() => {
  const usable = typesThatCanBeDisplayedInLink()
  return (linkSchema.value?.fields || []).filter((f) => usable.includes(f.type)).map((f) => ({ value: f.key, label: f.label }))
})

function validateFields() {
  errors.value = {}
  if (!p.linkId) errors.value.linkId = 'Required'
  if (!p.linkFieldDisplay) errors.value.linkFieldDisplay = 'Required'
  return !Object.keys(errors.value).length
}
defineExpose({ validateFields })
</script>

<template>
  <FormLayout>
    <Checkbox v-model="p.required" label="Required?" />
    <Checkbox v-model="p.allowEditChild" label="Allow Edit" help-text="Show List / Edit / Add buttons for the linked blueprint." />
    <Checkbox v-model="p.allowMultiple" label="Multiple?" />
    <Select v-model="p.linkId" label="Linked to Blueprint" :options="schemaOptions" :error="errors.linkId" placeholder="Choose a blueprint" />
    <Select v-if="linkSchema" v-model="p.linkFieldDisplay" label="Field to display" :options="linkDisplayFields" :error="errors.linkFieldDisplay" />
    <Select v-if="linkSchema" v-model="p.linkFieldDisplayDesc" label="Field to display (Description)" :options="linkDisplayFields" help-text="Extra information shown under each option." />
    <Select
      v-model="p.displayAs"
      label="Display as"
      :options="p.allowMultiple ? [
        { value: 'select', label: 'Select' },
        { value: 'check', label: 'Checkboxes' },
      ] : [
        { value: 'select', label: 'Select' },
        { value: 'radio', label: 'Radio Buttons' },
      ]"
    />
    <Checkbox v-show="p.allowMultiple && p.displayAs === 'select'" v-model="p.showTags" label="Show Tags?" help-text="Show tags below select?" />
  </FormLayout>
</template>
