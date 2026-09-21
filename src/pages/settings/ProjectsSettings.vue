<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import UI, { Badge, Card, CardSection, DataTable, FormLayout, Sheet, SkeletonCard, TextField } from '@octans/ui'
import type { Project } from '@/core/types'
import { RESERVED_KEYS, enterSubmits, getKeyFromLabel } from '@/core/utils'
import { refreshProjects, store, switchProject, useApi } from '@/store'

const loading = ref(true)
const projects = ref<Project[]>([])
const editing = ref<Partial<Project> | null>(null)
const errors = ref<Record<string, string>>({})
const keyTouched = ref(false)

onMounted(async () => {
  projects.value = await useApi().getProjectsList()
  loading.value = false
})

watch(
  () => editing.value?.label,
  (label) => {
    if (editing.value && !editing.value.id && !keyTouched.value) editing.value.key = getKeyFromLabel(label || '')
  },
)

function add() {
  errors.value = {}
  keyTouched.value = false
  editing.value = { key: '', label: '', order: projects.value.reduce((m, p) => Math.max(m, p.order), 0) + 1 }
}
function edit(p: Project) {
  errors.value = {}
  keyTouched.value = true
  editing.value = { ...p }
}
function validate() {
  errors.value = {}
  const f = editing.value!
  if (!f.label?.trim()) errors.value.label = 'Required'
  if (!f.key?.trim()) errors.value.key = 'Required'
  else if (RESERVED_KEYS.includes(f.key.trim().toLowerCase())) errors.value.key = 'Reserved word'
  else if (f.key !== getKeyFromLabel(f.key)) errors.value.key = 'Keys must be lowercase a-z and numbers and start with a letter.'
  if (projects.value.some((p) => p.id !== f.id && p.label === f.label?.trim())) errors.value.label = 'Label must be unique'
  if (projects.value.some((p) => p.id !== f.id && p.key === f.key)) errors.value.key = 'Key must be unique'
  return !Object.keys(errors.value).length
}
async function save() {
  if (!editing.value || !validate()) return
  const e = editing.value
  const order = parseInt(String(e.order), 10) || 0
  if (!e.id) {
    const p = await useApi().addProject({ key: e.key!, label: e.label!, order })
    projects.value.push(p)
  } else {
    const p = await useApi().updateProject({ id: e.id, key: e.key!, label: e.label!, order })
    const i = projects.value.findIndex((x) => x.id === p.id)
    projects.value.splice(i, 1, p)
  }
  editing.value = null
  await refreshProjects()
}
async function remove(p: Project) {
  const ok = await UI.confirm({ title: `Remove project "${p.label}"?`, content: 'All of its blueprints, data and files will be deleted. This cannot be undone!', primaryActionLabel: 'Remove', primaryActionType: 'destructive' })
  if (!ok) return
  try {
    await useApi().removeProject(p.id)
    projects.value = projects.value.filter((x) => x.id !== p.id)
    await refreshProjects()
  } catch (e: any) {
    UI.alert({ title: 'Cannot remove', content: e?.message })
  }
}
const columns = [
  { key: 'id', label: 'Current', width: 100 },
  { key: 'label', label: 'Label' },
  { key: 'key', label: 'Key' },
  { key: 'order', label: 'Order', width: 80 },
]
</script>

<template>
  <SkeletonCard v-if="loading" />
  <template v-else>
    <Sheet :title="editing?.id ? `Editing project '${editing.label}'` : 'Add Project'" :visible="!!editing" :size="600" padded :primary-action="{ label: editing?.id ? 'Update' : 'Add', onAction: save }" @close="editing = null">
      <Card v-if="editing">
        <CardSection>
          <div @keydown.enter="enterSubmits(save)($event)">
            <FormLayout>
              <TextField v-model="editing.label" label="Label" :error="errors.label" />
              <TextField v-model="editing.key" label="Key" :error="errors.key" monospace @update:model-value="keyTouched = true" />
              <TextField v-model="editing.order" label="Order" type="number" />
            </FormLayout>
          </div>
        </CardSection>
      </Card>
    </Sheet>
    <Card title="Projects" :actions="[{ label: 'Add Project', icon: 'mdi:plus', onAction: add }]">
      <DataTable
        :rows="projects"
        :columns="columns"
        :row-actions="(row) => [
          { label: 'Switch to', icon: 'mdi:swap-horizontal', disabled: row.id === store.currentProject?.id, onAction: () => switchProject(row.id) },
          { label: 'Edit', icon: 'mdi:pencil-outline', onAction: () => edit(row as Project) },
          { label: 'Remove', icon: 'mdi:delete-outline', disabled: row.id === store.currentProject?.id, onAction: () => remove(row as Project) },
        ]"
        @click-row="(p: Project) => edit(p)"
      >
        <template #col:id="{ value }">
          <Badge v-if="value === store.currentProject?.id" status="success">Current</Badge>
        </template>
      </DataTable>
    </Card>
  </template>
</template>
