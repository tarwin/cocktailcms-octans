<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import UI, { Card, CardSection, FormLayout, Sheet, TextContainer, TextField } from '@octans/ui'
import { controlComponent, type ControlHandle } from '@/components/controls'
import type { Blueprint, DataRecord, Field, ProjectSettings } from '@/core/types'
import { deepCopy, enterSubmits, getDefaultRecord, orderBy } from '@/core/utils'
import { useApi } from '@/store'

// The child list is the same component that hosts us, so it has to be lazy.
const DataList = defineAsyncComponent(() => import('./DataList.vue'))

const props = defineProps<{
  row?: DataRecord | Record<string, any> | null
  schema: Blueprint | null
  disableFields?: string[] | null
  parentFieldName?: string
}>()
const emit = defineEmits<{
  update: [record: DataRecord, isUpdate: boolean, closing: boolean]
  add: [record: DataRecord, isUpdate: boolean, closing: boolean]
  updateData: [schemaId: number]
  close: []
}>()

const isOpen = ref(false)
const loading = ref(false)
const record = ref<Record<string, any> | null>(null)
const settings = ref<ProjectSettings | null>(null)
const controls = ref<ControlHandle[]>([])

// child editing state
const childSchemaId = ref<number | null>(null)
const childForceFilter = ref<Record<string, any> | null>(null)
const childForceValues = ref<Record<string, any> | null>(null)
const childHideFields = ref<string[]>([])
const childSchemaUpdatedId = ref<number | null>(null)
const childRecordAddedId = ref<number | null>(null)
const childSchema = ref<Blueprint | null>(null)
const childRecord = ref<Record<string, any> | null>(null)
const parentFieldKey = ref<string | null>(null)
const parentFieldLabel = ref('')
let savedFromChildRow: DataRecord | null = null

useApi()
  .getSettings()
  .then((s) => (settings.value = s))

watch(
  () => props.row,
  (row) => {
    if (savedFromChildRow) {
      record.value = { ...savedFromChildRow }
    } else {
      record.value = row ? deepCopy(row) : null
    }
    isOpen.value = !!record.value
  },
  { immediate: true },
)

const orderedFields = computed<Field[]>(() => orderBy(props.schema?.fields || [], 'order'))

const hasChanged = computed(() => {
  const a = { ...(record.value || {}) }
  const b = { ...(props.row || {}) }
  delete a.id
  delete b.id
  return JSON.stringify(a) !== JSON.stringify(b)
})

const sheetTitle = computed(() => {
  const base = props.parentFieldName || props.schema?.label || ''
  return `${base}: ${record.value?.id ? 'Editing' : 'Adding'}`
})

function setValue(key: string, v: any) {
  if (!record.value) return
  record.value[key] = v
}

function setControlRef(el: any, index: number) {
  if (el) controls.value[index] = el as ControlHandle
}

function onAfterOpen() {
  const first = controls.value.find((c) => c && typeof c.focus === 'function')
  first?.focus?.()
}

async function validateAll(): Promise<boolean> {
  let ok = true
  let firstBad: ControlHandle | null = null
  for (const c of controls.value) {
    if (c && typeof c.validate === 'function' && !c.validate()) {
      ok = false
      if (!firstBad) firstBad = c
    }
  }
  if (firstBad) firstBad.focus?.()
  return ok
}

async function save(closeAfter = true, skipValidation = false): Promise<DataRecord | null> {
  if (!record.value || !props.schema) return null
  const api = useApi()
  const schema = props.schema

  // uniqueness is checked even when validation is skipped
  if (schema.uniqueField) {
    const field = schema.fields.find((f) => f.id === schema.uniqueField)
    if (field) {
      const existing = await api.getRecordIdByFieldValue(schema.id, field.id, record.value[field.key], !!schema.uniqueFieldFuzzy)
      if (existing > -1 && existing !== record.value.id) {
        controls.value.find((c) => c?.field?.id === field.id)?.addError?.('Must be unique.')
        return null
      }
    }
  }
  if (!skipValidation && !(await validateAll())) return null

  loading.value = true
  try {
    if (record.value.id) {
      await api.updateData(schema.id, record.value as DataRecord)
      const out = deepCopy(record.value) as DataRecord
      emit('update', out, true, closeAfter)
      if (closeAfter) await close(true)
      return out
    } else {
      const inserted = await api.addData(schema.id, record.value)
      savedFromChildRow = deepCopy(inserted)
      record.value = { ...inserted }
      emit('add', inserted, false, closeAfter)
      if (closeAfter) await close(true)
      return inserted
    }
  } catch (e: any) {
    console.error('DataRecord.save failed', e)
    UI.alert({ title: 'Could not save', content: e?.message })
    return null
  } finally {
    loading.value = false
  }
}

async function close(saved = false) {
  if (!saved && hasChanged.value) {
    const ok = await UI.confirm({
      title: 'Record not saved',
      content: 'Are you sure you want to discard your changes?',
      primaryActionLabel: 'Discard changes',
      primaryActionType: 'destructive',
    })
    if (!ok) return
  }
  savedFromChildRow = null
  await nextTick()
  isOpen.value = false
  record.value = null
  emit('close')
}

// ------------------------------------------------------------ child editing
function editChildSchema(inp: any) {
  childSchemaId.value = Number(inp.field.params.linkId) || null
  childForceFilter.value = inp.forceFilter || null
  childForceValues.value = inp.forceValues || null
  childHideFields.value = inp.hideFields || []
  childSchemaUpdatedId.value = null
  parentFieldKey.value = inp.field.key
}

async function editChildRecord(inp: any) {
  childHideFields.value = inp.hideFields || []
  childSchema.value = await useApi().getSchema(Number(inp.field.params.linkId))
  if (!childSchema.value) return
  parentFieldLabel.value = inp.field.label
  parentFieldKey.value = inp.field.key
  if (inp.editId === -1) {
    childRecord.value = Object.assign(getDefaultRecord(childSchema.value), inp.forceValues || {})
  } else {
    childRecord.value = await useApi().getRecord(Number(inp.field.params.linkId), inp.editId)
  }
}

function updateChildRecord() {
  childSchemaUpdatedId.value = childSchema.value?.id || null
  closeChildSchema()
}

function addChildRecord(newRecord: DataRecord, _isUpdate: boolean, closing = true) {
  childSchemaUpdatedId.value = childSchema.value?.id || null
  childRecordAddedId.value = newRecord.id
  closeChildSchema(newRecord, closing)
}

async function saveFromChild(handle: ControlHandle, rowId: number) {
  const saved = await save(false, true)
  if (saved) handle.afterSavedFromChild?.(rowId, saved.id)
}

function updateChildSchema(schemaId: number) {
  childSchemaUpdatedId.value = schemaId
}

function closedChildRecordFromEdit() {
  childRecord.value = null
}

function closeChildSchema(newRecord?: DataRecord, closing = true) {
  if (childSchemaUpdatedId.value) {
    for (const c of controls.value) c?.linkedDataUpdated?.(childSchemaUpdatedId.value)
    const parentField = props.schema?.fields.find((f) => f.key === parentFieldKey.value)
    if (childRecordAddedId.value && parentField?.type === 'link' && record.value) {
      const cur = record.value[parentField.key]
      if (parentField.params?.allowMultiple) {
        const arr = Array.isArray(cur) ? [...cur] : cur ? [cur] : []
        if (!arr.includes(childRecordAddedId.value)) arr.push(childRecordAddedId.value)
        record.value[parentField.key] = arr
      } else {
        record.value[parentField.key] = childRecordAddedId.value
      }
    }
    emit('updateData', childSchemaUpdatedId.value)
  }
  childSchemaId.value = null
  childSchemaUpdatedId.value = null
  childRecordAddedId.value = null
  if (closing) {
    childRecord.value = null
  } else if (newRecord) {
    childRecord.value = newRecord
  }
}

function onChildListClosed() {
  if (childSchemaUpdatedId.value) closeChildSchema()
  else childSchemaId.value = null
}
</script>

<template>
  <Sheet
    :title="sheetTitle"
    :visible="isOpen"
    :size="720"
    :loading="loading"
    padded
    :primary-action="{ label: record?.id ? 'Update' : 'Add', disabled: !hasChanged, onAction: () => save(true) }"
    @close="close(false)"
    @after-open="onAfterOpen"
  >
    <!-- the linked blueprint's list, opened from a Link/Sub field -->
    <Sheet :visible="!!childSchemaId" :size="960" :title="childSchema?.label || 'Linked records'" @close="onChildListClosed">
      <DataList
        v-if="childSchemaId"
        :schema-id="childSchemaId"
        :force-filter="childForceFilter"
        :force-values="childForceValues"
        :hide-fields="childHideFields"
        embedded
        @update-data="updateChildSchema"
      />
    </Sheet>

    <!-- one linked record, opened from a Link/Sub field -->
    <DataRecord
      :row="childRecord"
      :schema="childSchema"
      :disable-fields="childHideFields"
      :parent-field-name="parentFieldLabel"
      @update="updateChildRecord"
      @add="addChildRecord"
      @close="closedChildRecordFromEdit"
    />

    <Card v-if="record && schema">
      <CardSection>
        <TextContainer v-if="!orderedFields.length">
          <p>This blueprint has no fields yet. Add at least one before adding records.</p>
        </TextContainer>
        <div @keydown.enter="enterSubmits(() => save(true))($event)">
          <FormLayout>
            <template v-for="(field, i) in orderedFields" :key="field.key">
              <component
                :is="controlComponent(field.type)"
                v-if="controlComponent(field.type)"
                :ref="(el: any) => setControlRef(el, i)"
                :model-value="record[field.key]"
                :field="field"
                :record-id="record.id"
                :readonly="!!disableFields && disableFields.includes(field.key)"
                :settings="settings"
                @update:model-value="(v: any) => setValue(field.key, v)"
                @edit-child-schema="editChildSchema"
                @edit-child-record="editChildRecord"
                @save-from-child="saveFromChild"
              />
              <TextField
                v-else
                :ref="(el: any) => setControlRef(el, i)"
                :label="field.label"
                :model-value="record[field.key]"
                :readonly="!!disableFields && disableFields.includes(field.key)"
                @update:model-value="(v: any) => (record![field.key] = v)"
              />
            </template>
          </FormLayout>
        </div>
      </CardSection>
    </Card>
  </Sheet>
</template>
