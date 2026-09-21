<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Button, ChoiceList, InlineError, Select, Spinner, Stack } from '@octans/ui'
import type { Field } from '@/core/types'
import { orderBy } from '@/core/utils'
import { useApi } from '@/store'

const props = defineProps<{ modelValue?: any; field: Field; readonly?: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [any]
  editChildSchema: [{ field: Field; linkId: any }]
  editChildRecord: [{ field: Field; linkId: any; editId: number }]
}>()

const error = ref('')
const loading = ref(false)
const control = ref<any>(null)
const options = ref<Array<{ value: number; label: string; description?: string }>>([])
const p = computed(() => props.field.params || {})
const multiple = computed(() => !!p.value.allowMultiple)
const displayAs = computed(() => p.value.displayAs || 'select')
const value = computed(() => {
  const v = props.modelValue
  if (multiple.value) return Array.isArray(v) ? v : v === '' || v === null || v === undefined ? [] : [v]
  return Array.isArray(v) ? v[0] ?? null : v === '' ? null : v ?? null
})

async function load() {
  loading.value = true
  const fields = [p.value.linkFieldDisplay]
  if (p.value.linkFieldDisplayDesc) fields.push(p.value.linkFieldDisplayDesc)
  try {
    const rows = await useApi().getData(Number(p.value.linkId), fields)
    options.value = orderBy(
      rows.map((r) => ({
        value: r.id,
        label: String(r[p.value.linkFieldDisplay] ?? `#${r.id}`),
        description: p.value.linkFieldDisplayDesc ? String(r[p.value.linkFieldDisplayDesc] ?? '') : undefined,
      })),
      'label',
    )
  } finally {
    loading.value = false
  }
}
onMounted(load)

function set(v: any) {
  error.value = ''
  emit('update:modelValue', v)
}

function validate(): boolean {
  error.value = ''
  const empty = multiple.value ? !(value.value as any[]).length : value.value === null || value.value === undefined
  if (p.value.required && empty) error.value = `${props.field.label} is required.`
  return !error.value
}

function edit(editId: number) {
  if (editId === 0) emit('editChildSchema', { field: props.field, linkId: props.modelValue })
  else emit('editChildRecord', { field: props.field, linkId: props.modelValue, editId })
}

const singleId = computed(() => (multiple.value ? null : (value.value as number | null)))

defineExpose({
  field: props.field,
  validate,
  focus: () => control.value?.focus?.(),
  addError: (m: string) => (error.value = m),
  linkedDataUpdated: async (linkId: number) => {
    if (Number(linkId) === Number(p.value.linkId)) await load()
  },
})
</script>

<template>
  <div class="link-control">
    <Spinner v-if="loading && displayAs !== 'select'" size="small" />
    <template v-else-if="displayAs === 'radio' || displayAs === 'check'">
      <ChoiceList
        :label="field.label"
        :options="options.map((o) => ({ value: o.value, label: o.label, helpText: o.description }))"
        :model-value="value"
        :multiple="displayAs === 'check'"
        :readonly="readonly"
        :help-text="field.help"
        :error="error"
        @update:model-value="set"
      />
    </template>
    <Select
      v-else
      ref="control"
      :label="field.label"
      :model-value="value"
      :options="options"
      :multiple="multiple"
      :tags="multiple && !!p.showTags"
      :readonly="readonly"
      :required="!!p.required"
      :error="error"
      :help-text="field.help"
      :placeholder="loading ? 'Loading …' : 'Choose'"
      @update:model-value="set"
    />
    <Stack v-if="p.allowEditChild && !readonly" distribution="trailing" spacing="tight">
      <Button type="plain" size="small" icon="mdi:format-list-bulleted" tabindex="-1" @click="edit(0)">List</Button>
      <Button v-if="!multiple" type="plain" size="small" icon="mdi:pencil-outline" :disabled="!singleId" tabindex="-1" @click="singleId && edit(singleId)">Edit</Button>
      <Button type="plain" size="small" icon="mdi:plus" tabindex="-1" @click="edit(-1)">Add</Button>
    </Stack>
    <InlineError v-if="error && (displayAs === 'radio' || displayAs === 'check')">{{ error }}</InlineError>
  </div>
</template>

<style scoped>
.link-control {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
