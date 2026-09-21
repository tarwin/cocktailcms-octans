<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UI, {
  Button,
  Card,
  CardSection,
  Checkbox,
  ChoiceList,
  DataTable,
  FormLayout,
  FormLayoutGroup,
  Layout,
  LayoutSection,
  Page,
  Select,
  Sheet,
  TextField,
} from '@octans/ui'
import { optionsComponent } from '@/components/options'
import type { Blueprint, Field } from '@/core/types'
import { RESERVED_KEYS, TYPE_OPTIONS, enterSubmits, getKeyFromLabel, getTypeLabel, orderBy, typesThatCanBeDisplayedInLink, typesThatCanBeFuzzy } from '@/core/utils'
import { refreshBlueprints, useApi } from '@/store'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const schema = ref<Blueprint>({ id: 0, key: '', label: '', fields: [] })
const editingField = ref<Field | null>(null)
const errors = ref<Record<string, string>>({})
const settingsErrors = ref<Record<string, string>>({})
const labelField = ref<any>(null)
const typeComponent = ref<any>(null)
const keyTouched = ref(false)
const saving = ref(false)

onMounted(load)
watch(() => route.params.id, load)

async function load() {
  loading.value = true
  const s = await useApi().getSchema(parseInt(String(route.params.id), 10))
  if (!s) {
    router.replace('/schemas')
    return
  }
  s.defaultSorting = s.defaultSorting || null
  s.defaultSortingOrder = s.defaultSortingOrder || 'asc'
  schema.value = s
  loading.value = false
}

const sortedFields = computed(() => orderBy(schema.value.fields, 'order'))
const typeOptions = TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }))
const fieldsAsOptions = computed(() => schema.value.fields.map((f) => ({ value: f.id, label: f.label })))
const fieldsForLinkDisplay = computed(() => {
  const usable = typesThatCanBeDisplayedInLink()
  return schema.value.fields.filter((f) => usable.includes(f.type)).map((f) => ({ value: f.id, label: f.label }))
})
const fieldsForUnique = computed(() =>
  schema.value.fields
    .filter((f) => f.type === 'text' || f.type === 'number' || (f.type === 'link' && !f.params?.allowMultiple))
    .map((f) => ({ value: f.id, label: f.label })),
)
const uniqueCanBeFuzzy = computed(() => {
  const f = schema.value.fields.find((x) => x.id === schema.value.uniqueField)
  return !!f && typesThatCanBeFuzzy().includes(f.type)
})

const columns = [
  { key: 'order', label: '#', width: 60 },
  { key: 'label', label: 'Label' },
  { key: 'key', label: 'Key' },
  { key: 'type', label: 'Type' },
  { key: 'hideInList', label: 'In list', width: 90 },
]

function focusLabel() {
  nextTick(() => setTimeout(() => labelField.value?.focus?.(), 50))
}

function addField() {
  const highest = schema.value.fields.reduce((m, f) => Math.max(m, f.order), 0)
  errors.value = {}
  keyTouched.value = false
  editingField.value = { id: 0, key: '', label: '', type: 'text', order: highest + 1, required: false, hideInList: false, help: '', params: {} }
  focusLabel()
}

function editField(field: Field) {
  errors.value = {}
  keyTouched.value = true
  editingField.value = JSON.parse(JSON.stringify(field))
  focusLabel()
}

watch(
  () => editingField.value?.label,
  (label) => {
    if (editingField.value && !editingField.value.id && !keyTouched.value) editingField.value.key = getKeyFromLabel(label || '')
  },
)
watch(
  () => editingField.value?.type,
  (t, old) => {
    if (editingField.value && old && t !== old) editingField.value.params = {}
  },
)

function validateField() {
  errors.value = {}
  const f = editingField.value!
  if (!f.label.trim()) errors.value.label = 'Required'
  if (!f.key.trim()) errors.value.key = 'Required'
  else if (RESERVED_KEYS.includes(f.key.trim().toLowerCase())) errors.value.key = `Cannot be ${RESERVED_KEYS.map((k) => `"${k}"`).join(', ')}`
  else if (f.key !== getKeyFromLabel(f.key)) errors.value.key = 'Keys must be lowercase a-z and numbers and start with a letter.'
  else if (schema.value.fields.some((x) => x.id !== f.id && x.key === f.key)) errors.value.key = 'Key must be unique'
  else if (f.key === schema.value.key) errors.value.key = 'Cannot be the same as the blueprint key.'
  if (!f.order && f.order !== 0) errors.value.order = 'Required'
  if (!f.type) errors.value.type = 'Required'
  if (typeComponent.value?.validateFields && !typeComponent.value.validateFields()) return false
  return !Object.keys(errors.value).length
}

async function saveField() {
  if (!editingField.value || !validateField()) return
  const f = { ...editingField.value, order: parseFloat(String(editingField.value.order)) }
  if (!f.id) {
    f.id = schema.value.fields.reduce((m, x) => Math.max(m, x.id), 0) + 1
    schema.value.fields.push(f)
  } else {
    const i = schema.value.fields.findIndex((x) => x.id === f.id)
    schema.value.fields.splice(i, 1, f)
  }
  saving.value = true
  try {
    await useApi().setSchema(schema.value)
    await load()
    editingField.value = null
  } finally {
    saving.value = false
  }
}

async function removeField(field: Field) {
  const ok = await UI.confirm({
    title: `Remove field "${field.label}"?`,
    content: 'This cannot be undone and the data in this field will be removed from every record.',
    primaryActionLabel: 'Remove',
    primaryActionType: 'destructive',
  })
  if (!ok) return
  await useApi().removeField(schema.value.id, field.id)
  await load()
}

async function validateSettings() {
  settingsErrors.value = {}
  const s = schema.value
  if (!s.label.trim()) settingsErrors.value.label = 'Required'
  if (!s.key.trim()) settingsErrors.value.key = 'Required'
  else if (RESERVED_KEYS.includes(s.key.trim().toLowerCase())) settingsErrors.value.key = `Cannot be ${RESERVED_KEYS.map((k) => `"${k}"`).join(', ')}`
  else if (s.key !== getKeyFromLabel(s.key)) settingsErrors.value.key = 'Keys must be lowercase a-z and numbers and start with a letter.'
  const all = await useApi().getSchemaList()
  if (all.some((x) => x.id !== s.id && x.label === s.label.trim())) settingsErrors.value.label = 'Label must be unique'
  if (all.some((x) => x.id !== s.id && x.key === s.key)) settingsErrors.value.key = 'Key must be unique'
  return !Object.keys(settingsErrors.value).length
}

async function saveSettings() {
  if (!(await validateSettings())) return
  await useApi().setSchema(schema.value)
  await refreshBlueprints()
  UI.toast({ title: 'Settings saved', tone: 'success' })
}
</script>

<template>
  <Page
    :title="`Edit Blueprint: ${schema.label}`"
    :loading="loading"
    :breadcrumbs="[{ label: 'Blueprints', url: '#/schemas' }]"
    :primary-action="{ label: 'Add Field', icon: 'mdi:plus', onAction: addField }"
    :secondary-actions="[{ label: 'View Data', icon: 'mdi:table', onAction: () => router.push(`/data/list/${schema.id}`) }]"
  >
    <Sheet
      :title="editingField?.id ? `Editing field '${editingField.label}'` : 'Add Field'"
      :visible="!!editingField"
      :size="700"
      :loading="saving"
      padded
      :primary-action="{ label: editingField?.id ? 'Update' : 'Add', onAction: saveField }"
      @close="editingField = null"
    >
      <template v-if="editingField">
        <Card>
          <CardSection>
            <div @keydown.enter="enterSubmits(saveField)($event)">
              <FormLayout>
                <TextField ref="labelField" v-model="editingField.label" label="Label" :error="errors.label" />
                <TextField v-model="editingField.key" label="Key" :error="errors.key" monospace help-text="Used in exports and SQL." @update:model-value="keyTouched = true" />
                <FormLayoutGroup>
                  <TextField v-model="editingField.order" label="Order" type="number" :step="0.5" :error="errors.order" help-text="Use a decimal (1.5) to slot between two fields." />
                  <Checkbox v-model="editingField.hideInList" label="Hide in list" help-text="Still editable, just not a table column." />
                </FormLayoutGroup>
                <TextField v-model="editingField.help" label="Help Text" help-text="Explain what this field is for" />
              </FormLayout>
            </div>
          </CardSection>
          <CardSection title="Type">
            <FormLayout>
              <Select v-model="editingField.type" label="Type" :options="typeOptions" :error="errors.type" />
              <component :is="optionsComponent(editingField.type)" v-if="optionsComponent(editingField.type)" ref="typeComponent" v-model="editingField.params" :schema="schema" />
            </FormLayout>
          </CardSection>
        </Card>
      </template>
    </Sheet>

    <Layout>
      <LayoutSection>
        <Card title="Fields">
          <DataTable
            :columns="columns"
            :rows="sortedFields"
            :loading="loading"
            empty-text="No fields yet. Click Add Field."
            :row-actions="[
              { label: 'Edit', icon: 'mdi:pencil-outline', onAction: (f) => editField(f as Field) },
              { label: 'Remove', icon: 'mdi:delete-outline', onAction: (f) => removeField(f as Field) },
            ]"
            @click-row="(f: Field) => editField(f)"
          >
            <template #col:type="{ row }">{{ getTypeLabel(row.type) }}</template>
            <template #col:hideInList="{ row }">{{ row.hideInList ? 'Hidden' : 'Shown' }}</template>
          </DataTable>
        </Card>

        <Card title="Settings">
          <CardSection>
            <FormLayout>
              <TextField v-model="schema.label" label="Label" :error="settingsErrors.label" />
              <TextField v-model="schema.key" label="Key" :error="settingsErrors.key" monospace />
              <Checkbox v-model="schema.hidden" label="Hide?" help-text="Hide from the sidebar. Best for sub-blueprints that are only edited from their parent." />
              <Checkbox v-model="schema.secondary" label="Show in secondary list?" help-text="Show under 'Linked data' in the sidebar." />
              <Checkbox v-model="schema.filteringAllowed" label="Allow filtering?" help-text="Show filters above the list." />
            </FormLayout>
          </CardSection>
          <CardSection>
            <TextField v-model="schema.description" label="Description" placeholder="ie 'This is a list of things'" help-text="Shown above the list. Supports Markdown." :multiline="3" />
          </CardSection>
          <CardSection title="Sorting">
            <FormLayout>
              <FormLayoutGroup>
                <Select v-model="schema.defaultSorting" label="Default Sorting" :options="fieldsAsOptions" placeholder="Choose a field to sort by" clearable />
                <ChoiceList
                  v-model="schema.defaultSortingOrder"
                  label="Sort Direction"
                  :disabled="!schema.defaultSorting"
                  appearance="segmented"
                  :options="[
                    { label: 'Ascending', value: 'asc' },
                    { label: 'Descending', value: 'desc' },
                  ]"
                />
              </FormLayoutGroup>
            </FormLayout>
          </CardSection>
          <CardSection title="Uniqueness">
            <FormLayout>
              <FormLayoutGroup>
                <Select v-model="schema.uniqueField" label="Unique Field" :options="fieldsForUnique" placeholder="Choose a field to be unique" help-text="Normally the field shown in links." clearable />
                <Checkbox v-model="schema.uniqueFieldFuzzy" label="Fuzzy unique field?" help-text="Compare only letters and numbers, ignoring case." :disabled="!uniqueCanBeFuzzy" />
              </FormLayoutGroup>
            </FormLayout>
          </CardSection>
          <CardSection title="Default Link Fields">
            <FormLayout>
              <FormLayoutGroup>
                <Select v-model="schema.linkFieldDisplayDefault" label="Link Default Display Field" :options="fieldsForLinkDisplay" placeholder="Choose a field" help-text="Used by default when another blueprint links here." clearable />
                <Select v-model="schema.linkFieldDisplayDefaultSecondary" label="Secondary" :options="fieldsForLinkDisplay" placeholder="Choose a secondary field" clearable />
              </FormLayoutGroup>
            </FormLayout>
          </CardSection>
          <CardSection>
            <Button type="primary" @click="saveSettings">Update Settings</Button>
          </CardSection>
        </Card>
      </LayoutSection>
    </Layout>
  </Page>
</template>
