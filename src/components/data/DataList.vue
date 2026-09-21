<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Banner, Button, Card, CardSection, DataTable, Filters, Page, Stack, type DataTableSortType } from '@octans/ui'

interface FilterType {
  key: string
  label: string
  type: string
  placeholder: string
  required: boolean
  multiple?: boolean
  options?: Array<{ value: any; label: string }>
}
import { fieldComponent } from '@/components/fields'
import Markdown from '@/components/Markdown.vue'
import type { Blueprint, DataRecord as RecordType, LinkedData } from '@/core/types'
import { deepCopy, fieldCanBeSorted, getDefaultRecord, getDefaultTableLimit, loadLinkedData, setDefaultTableLimit } from '@/core/utils'
import { useApi } from '@/store'
import DataRecordSheet from './DataRecord.vue'
import RemoveModal from './RemoveModal.vue'

const props = defineProps<{
  schemaId: number
  forceFilter?: Record<string, any> | null
  forceValues?: Record<string, any> | null
  hideFields?: string[] | null
  /** Rendered inside a sheet: no page chrome. */
  embedded?: boolean
}>()
const emit = defineEmits<{ updateData: [schemaId: number]; close: [] }>()

const router = useRouter()
const loading = ref(true)
const data = ref<RecordType[]>([])
const schema = ref<Blueprint | null>(null)
const editingRecord = ref<Record<string, any> | null>(null)
const linkedData = ref<LinkedData>({})
const childDataUpdated = ref<number[]>([])
const appliedFilters = ref<Record<string, any>>({})
const query = ref('')
const sortBy = ref<DataTableSortType | undefined>(undefined)
const offset = ref(0)
const limit = ref(getDefaultTableLimit())
const removeModal = ref<InstanceType<typeof RemoveModal> | null>(null)

watch(limit, (l) => setDefaultTableLimit(l))
watch(() => props.schemaId, load, { immediate: true })

async function load() {
  offset.value = 0
  sortBy.value = undefined
  loading.value = true
  data.value = []
  editingRecord.value = null
  linkedData.value = {}
  const api = useApi()
  const s = await api.getSchema(props.schemaId)
  schema.value = s
  if (!s) {
    loading.value = false
    return
  }
  if (s.defaultSorting) {
    const f = s.fields.find((x) => x.id === s.defaultSorting)
    if (f) sortBy.value = { column: f.key, direction: s.defaultSortingOrder || 'asc' }
  }
  const [rows, linked] = await Promise.all([api.getData(s.id, null, props.forceFilter), loadLinkedData(s, api)])
  linkedData.value = linked
  data.value = rows
  loading.value = false
}

function goToBlueprint() {
  if (schema.value) router.push(`/schemas/edit/${schema.value.id}`)
}

function editRecord(row: RecordType) {
  childDataUpdated.value = []
  editingRecord.value = deepCopy(row)
}

function add() {
  if (!schema.value) return
  childDataUpdated.value = []
  editingRecord.value = Object.assign(getDefaultRecord(schema.value), props.forceValues || {})
}

function updateChildData(schemaId: number) {
  childDataUpdated.value.push(schemaId)
}

async function checkChildDataUpdated() {
  if (childDataUpdated.value.length) {
    await load()
    childDataUpdated.value = []
  }
}

async function onSaved(record: RecordType, isUpdate: boolean, closing: boolean) {
  await checkChildDataUpdated()
  if (isUpdate) {
    const i = data.value.findIndex((d) => d.id === record.id)
    if (i > -1) data.value.splice(i, 1, deepCopy(record))
    else data.value.push(deepCopy(record))
  } else {
    data.value.push(record)
  }
  if (closing) editingRecord.value = null
  else editingRecord.value = record
  if (schema.value) emit('updateData', schema.value.id)
}

function onClosed() {
  editingRecord.value = null
  checkChildDataUpdated()
  emit('close')
}

function removeRow(record: RecordType) {
  if (!schema.value) return
  removeModal.value?.show(
    async (recordId, replaceWithId) => {
      await useApi().deleteData(props.schemaId, recordId, replaceWithId)
      data.value = data.value.filter((d) => d.id !== recordId)
      emit('updateData', schema.value!.id)
    },
    schema.value,
    record,
  )
}

const columns = computed(() => {
  if (!schema.value) return []
  return [
    { key: 'id', label: 'ID', sortable: true, width: 70 },
    ...schema.value.fields
      .filter((f) => !f.hideInList && !(props.hideFields && props.hideFields.includes(f.key)))
      .map((f) => ({ ...f, sortable: fieldCanBeSorted(f) })),
  ]
})

const filters = computed<FilterType[]>(() => {
  const out: FilterType[] = []
  for (const f of schema.value?.fields || []) {
    if (f.type === 'text' || f.type === 'number') out.push({ key: f.key, label: f.label, type: 'text', placeholder: '', required: false })
    else if (f.type === 'boolean') out.push({ key: f.key, label: f.label, type: 'boolean', placeholder: '', required: false })
    else if (f.type === 'date') out.push({ key: f.key, label: f.label, type: 'date', placeholder: '', required: false })
    else if (f.type === 'link' && linkedData.value[Number(f.params?.linkId)]) {
      const linked = linkedData.value[Number(f.params.linkId)]
      out.push({
        key: f.key,
        label: f.label,
        type: 'select',
        placeholder: 'Any',
        required: false,
        multiple: false,
        options: linked.data.map((d) => ({ value: d.id, label: String(d[f.params.linkFieldDisplay] ?? d.id) })),
      })
    }
  }
  return out
})

const filteredData = computed(() => {
  let r = data.value
  const types = Object.fromEntries((schema.value?.fields || []).map((f) => [f.key, f]))
  const q = query.value.trim().toLowerCase()
  if (q) {
    const textKeys = (schema.value?.fields || []).filter((f) => f.type === 'text' || f.type === 'number').map((f) => f.key)
    r = r.filter((row) => textKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(q)) || String(row.id) === q)
  }
  for (const [key, by] of Object.entries(appliedFilters.value)) {
    if (by === null || by === undefined || by === '') continue
    const f = types[key]
    if (!f) continue
    if (f.type === 'text') r = r.filter((row) => String(row[key] ?? '').toLowerCase().includes(String(by).toLowerCase()))
    else if (f.type === 'number') r = r.filter((row) => parseFloat(row[key]) === parseFloat(by))
    else if (f.type === 'boolean') r = r.filter((row) => !!row[key] === !!by)
    else if (f.type === 'date') r = r.filter((row) => String(row[key] || '').slice(0, 10) === String(by).slice(0, 10))
    else if (f.type === 'link') r = r.filter((row) => (Array.isArray(row[key]) ? row[key].includes(by) : row[key] === by))
  }
  return r
})

const sortedData = computed(() => {
  const r = [...filteredData.value]
  const s = sortBy.value
  if (!s) return r
  const dir = s.direction === 'asc' ? 1 : -1
  const col = s.column
  let get = (row: RecordType) => row[col]
  if (col !== 'id') {
    const field = schema.value?.fields.find((f) => f.key === col)
    if (field?.type === 'link') {
      const linked = linkedData.value[Number(field.params.linkId)]
      const lookup: Record<number, any> = {}
      for (const d of linked?.data || []) lookup[d.id] = d[field.params.linkFieldDisplay]
      get = (row) => lookup[row[col]] ?? ''
    } else if (field?.type === 'number') {
      get = (row) => parseFloat(row[col])
    }
  }
  r.sort((a, b) => {
    const av = get(a)
    const bv = get(b)
    if (av === bv) return 0
    if (av === null || av === undefined || av === '') return 1
    if (bv === null || bv === undefined || bv === '') return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir
  })
  return r
})

const rowActions = [
  { label: 'Edit', icon: 'mdi:pencil-outline', onAction: (row: RecordType) => editRecord(row) },
  { label: 'Remove', icon: 'mdi:delete-outline', onAction: (row: RecordType) => removeRow(row) },
]
</script>

<template>
  <component
    :is="embedded ? 'div' : Page"
    v-bind="embedded ? { class: 'embedded' } : {
      title: schema?.label || '',
      size: 'fullWidth',
      loading: loading && !schema,
      primaryAction: { label: 'Add', icon: 'mdi:plus', onAction: add },
      secondaryActions: [{ label: 'Edit Blueprint', icon: 'mdi:compass-outline', onAction: goToBlueprint }],
    }"
  >
    <DataRecordSheet
      :row="editingRecord"
      :schema="schema"
      :disable-fields="hideFields"
      @update="onSaved"
      @add="onSaved"
      @update-data="updateChildData"
      @close="onClosed"
    />
    <RemoveModal ref="removeModal" />

    <Stack v-if="embedded" distribution="equalSpacing" alignment="center" class="embedded-head">
      <strong>{{ schema?.label }}</strong>
      <Button type="primary" icon="mdi:plus" size="small" @click="add">Add</Button>
    </Stack>

    <Banner v-if="!loading && !schema" status="warning" title="Blueprint not found">There is no blueprint with this ID in the current project.</Banner>

    <Card v-if="schema?.description && !embedded">
      <CardSection><Markdown :source="schema.description" /></CardSection>
    </Card>

    <Card v-if="schema || loading">
      <CardSection v-if="schema?.filteringAllowed" class="filters">
        <Filters
          :filters="filters"
          :applied-filters="appliedFilters"
          :query="query"
          @update:applied-filters="(v: Record<string, any>) => (appliedFilters = v)"
          @update:query="(v: string | null) => (query = v || '')"
        />
      </CardSection>
      <DataTable
        :columns="columns"
        :rows="sortedData"
        :row-actions="rowActions"
        :loading="loading"
        :sort="sortBy"
        :pagination="{
          offset,
          limit,
          total: sortedData.length,
          updateOffset: (v: number) => (offset = v),
          updateLimit: (v: number) => (limit = v),
        }"
        empty-text="No records yet. Click Add to create one."
        @update:sort="(s: DataTableSortType) => (sortBy = s)"
        @click-row="editRecord"
      >
        <template v-for="col of columns" :key="col.key" #[`col:${col.key}`]="{ row }">
          <component
            :is="fieldComponent((col as any).type)"
            v-if="col.key !== 'id' && fieldComponent((col as any).type)"
            :value="row[col.key]"
            :field="col"
            :data="linkedData"
            :record-id="row.id"
          />
          <span v-else>{{ row[col.key] }}</span>
        </template>
      </DataTable>
    </Card>
  </component>
</template>

<style scoped>
.filters {
  padding-bottom: 0;
}
.embedded {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.embedded-head {
  padding: 0 4px;
}
</style>
