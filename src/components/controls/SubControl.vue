<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UI, { Button, DataTable, Labelled, Stack } from '@octans/ui'
import { fieldComponent } from '@/components/fields'
import type { Blueprint, DataRecord, Field, LinkedData } from '@/core/types'
import { loadLinkedData } from '@/core/utils'
import { useApi } from '@/store'

const props = defineProps<{ modelValue?: any; field: Field; readonly?: boolean; recordId?: number }>()
const emit = defineEmits<{
  'update:modelValue': [any]
  editChildSchema: [any]
  editChildRecord: [any]
  saveFromChild: [any, number]
}>()

const error = ref('')
const loading = ref(true)
const schema = ref<Blueprint | null>(null)
const rows = ref<DataRecord[]>([])
const linkedData = ref<LinkedData>({})
const p = computed(() => props.field.params || {})
const displayKeys = computed<string[]>(() => p.value.linkFieldDisplay || [])

async function load() {
  loading.value = true
  try {
    const api = useApi()
    const s = await useApi().getSchema(Number(p.value.linkId))
    schema.value = s
    if (!s) return
    linkedData.value = await loadLinkedData(s, api, displayKeys.value)
    rows.value = props.recordId
      ? await api.getData(Number(p.value.linkId), displayKeys.value, { [p.value.linkFieldId]: props.recordId })
      : []
  } finally {
    loading.value = false
  }
}
onMounted(load)

const columns = computed(() =>
  (schema.value?.fields || []).filter((f) => displayKeys.value.includes(f.key)).map((f) => ({ ...f, sortable: false })),
)

function editChild(rowId: number, savedRecordId?: number) {
  const recordId = savedRecordId || props.recordId
  if (!recordId) {
    // the parent has no id yet - ask it to save first, then come back here
    emit('saveFromChild', handle, rowId)
    return
  }
  const filter = { [p.value.linkFieldId]: recordId }
  const payload = { field: props.field, linkId: props.modelValue, forceFilter: filter, hideFields: [p.value.linkFieldId], forceValues: filter }
  if (rowId === 0) emit('editChildSchema', payload)
  else emit('editChildRecord', { ...payload, editId: rowId })
}

async function remove(row: DataRecord) {
  const ok = await UI.confirm({ title: 'Remove?', content: 'This sub-record will be deleted.', primaryActionType: 'destructive' })
  if (!ok || !schema.value) return
  await useApi().deleteData(schema.value.id, row.id)
  rows.value = rows.value.filter((r) => r.id !== row.id)
}

function validate(): boolean {
  error.value = ''
  if (p.value.required && !rows.value.length) error.value = `At least one ${props.field.label} is required.`
  return !error.value
}

const handle = {
  field: props.field,
  validate,
  focus: () => {},
  addError: (m: string) => (error.value = m),
  linkedDataUpdated: async (linkId: number) => {
    if (Number(linkId) === Number(p.value.linkId)) await load()
  },
  afterSavedFromChild: (rowId: number, recordId: number) => editChild(rowId, recordId),
}
defineExpose(handle)
</script>

<template>
  <Labelled :label="field.label" :error="error" :help-text="field.help" :required="!!p.required">
    <DataTable
      :loading="loading"
      :columns="columns"
      :rows="rows"
      compact
      :empty-text="`No ${field.label.toLowerCase()} yet`"
      :row-actions="readonly ? [] : [
        { label: 'Edit', icon: 'mdi:pencil-outline', onAction: (row) => editChild(row.id) },
        { label: 'Remove', icon: 'mdi:delete-outline', onAction: (row) => remove(row as DataRecord) },
      ]"
      @click-row="(row: DataRecord) => !readonly && editChild(row.id)"
    >
      <template v-for="col of columns" :key="col.key" #[`col:${col.key}`]="{ row }">
        <component :is="fieldComponent(col.type)" v-if="fieldComponent(col.type)" :value="row[col.key]" :field="col" :data="linkedData" :record-id="row.id" />
        <span v-else>{{ row[col.key] }}</span>
      </template>
    </DataTable>
    <Stack v-if="!readonly" distribution="trailing" spacing="tight">
      <Button type="plain" size="small" icon="mdi:format-list-bulleted" tabindex="-1" @click="editChild(0)">List</Button>
      <Button type="plain" size="small" icon="mdi:plus" @click="editChild(-1)">Add</Button>
    </Stack>
  </Labelled>
</template>
