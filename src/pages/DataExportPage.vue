<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import UI, { Banner, Button, Card, CardSection, DataTable, Icon, Page, Tabs, TextField } from '@octans/ui'
import { buildExportSql, type CustomField, type ExportField } from '@/api/exportSql'
import EditCustomFieldSheet from '@/components/viz/EditCustomFieldSheet.vue'
import Graph from '@/core/graph'
import type { Blueprint } from '@/core/types'
import { TYPE_DATA_DEFAULT, csvCell } from '@/core/utils'
import { useApi } from '@/store'

const loading = ref(true)
const schemas = ref<Blueprint[]>([])
const schemaByKey = ref<Record<string, Blueprint>>({})
const schemaById = ref<Record<number, Blueprint>>({})
const connectedSchemas = ref<Blueprint[][]>([])
let connectedGraphs: Graph[] = []
const currentGroup = ref(-1)
let chosenGraph: Graph | null = null
const chosenSchemas = ref<Blueprint[] | null>(null)

const selectedFields = ref<Record<string, ExportField>>({})
const selectedCustom = ref<Record<string, CustomField>>({})
const customFields = ref<Record<string, CustomField[]>>({})
let customFieldMaxId = 0
const customFieldEdit = ref<CustomField | null>(null)
const customFieldAutoFields = ref<CustomField[]>([])

const mode = ref<'simple' | 'advanced'>('simple')
const sqlOutput = ref('')
const customSql = ref('')
const showGenerated = ref(true)
const columns = ref<Array<{ key: string; label: string }>>([])
const rows = ref<Record<string, any>[]>([])
const csvOutput = ref('')
const offset = ref(0)
const limit = ref(10)
const running = ref(false)

const selectedKeys = computed(() => [...Object.keys(selectedFields.value), ...Object.keys(selectedCustom.value)])

onMounted(async () => {
  const api = useApi()
  await api.rebuildViews(true)
  schemas.value = await api.getSchemas()
  const byId: Record<number, Blueprint> = {}
  const byKey: Record<string, Blueprint> = {}
  for (const s of schemas.value) {
    byId[s.id] = s
    byKey[s.key] = s
  }
  schemaById.value = byId
  schemaByKey.value = byKey

  const all = new Graph()
  for (const s of schemas.value) {
    all.addNode(s.key)
    for (const f of s.fields) {
      const target = byId[Number(f.params?.linkId)]
      if ((f.type === 'link' || f.type === 'sub') && target) all.addEdge(s.key, target.key)
      ;(f as ExportField).globalKey = `${s.key}___${f.key}`
      ;(f as ExportField).schema = s
      ;(f as ExportField).extra = { default: TYPE_DATA_DEFAULT[f.type] }
    }
  }
  connectedGraphs = all.splitIntoConnectedGraphs()
  connectedSchemas.value = connectedGraphs.map((g) => Object.keys(g.edges).map((k) => byKey[k]).filter(Boolean))
  if (connectedSchemas.value.length === 1) chooseDataset(0)
  loading.value = false
})

watch(chosenSchemas, (list) => {
  const out: Record<string, CustomField[]> = {}
  for (const schema of list || []) {
    out[schema.key] = []
    for (const field of schema.fields) {
      if (field.type === 'link' && field.params.allowMultiple) {
        out[schema.key].push({ globalKey: `auto___${schema.key}___${field.key}_num`, label: `# ${field.label}`, auto: true, type: 'LINK_SUM', schema, params: { field: field as ExportField }, extra: { default: 0 } })
      } else if (field.type === 'sub') {
        out[schema.key].push({ globalKey: `auto___${schema.key}___${field.key}_num`, label: `# ${field.label}`, auto: true, type: 'SUB_COUNT', schema, params: { field: field as ExportField }, extra: { default: 0 } })
      }
    }
  }
  customFields.value = out
})

function nonEmpty(group: Blueprint[]) {
  return group.filter((s) => s.fields.some((f) => !['link', 'sub'].includes(f.type)))
}

function chooseDataset(i: number) {
  currentGroup.value = i
  chosenGraph = connectedGraphs[i]
  chosenSchemas.value = connectedSchemas.value[i]
}

function backToChoice() {
  selectedFields.value = {}
  selectedCustom.value = {}
  currentGroup.value = -1
  chosenGraph = null
  chosenSchemas.value = null
  clearOutput()
}

function clearOutput() {
  sqlOutput.value = ''
  csvOutput.value = ''
  rows.value = []
  columns.value = []
}

function toggleField(f: ExportField) {
  if (selectedFields.value[f.globalKey]) delete selectedFields.value[f.globalKey]
  else selectedFields.value[f.globalKey] = f
  regenerate()
}
function toggleCustom(f: CustomField) {
  if (selectedCustom.value[f.globalKey]) delete selectedCustom.value[f.globalKey]
  else selectedCustom.value[f.globalKey] = f
  regenerate()
}

function clickAddCustom(schema: Blueprint) {
  customFieldAutoFields.value = (customFields.value[schema.key] || []).filter((f) => f.auto)
  customFieldEdit.value = { label: '', globalKey: '', type: '', schema, extra: { default: null }, custom: null }
}
function clickEditCustom(f: CustomField) {
  customFieldAutoFields.value = (customFields.value[f.schema.key] || []).filter((x) => x.auto)
  customFieldEdit.value = { ...f, globalKey: f.globalKey.slice(f.globalKey.lastIndexOf('___') + 3) }
}
function addOrUpdateCustom(f: CustomField) {
  const field = { ...f, globalKey: `custom___${f.schema.key}___${f.globalKey}` }
  const list = customFields.value[f.schema.key] || (customFields.value[f.schema.key] = [])
  if (field.id) {
    const i = list.findIndex((x) => x.id === field.id)
    list.splice(i, 1, field)
    if (selectedCustom.value[field.globalKey]) selectedCustom.value[field.globalKey] = field
  } else {
    field.id = ++customFieldMaxId
    list.push(field)
  }
  customFieldEdit.value = null
  regenerate()
}
function deleteCustom(f: CustomField) {
  const key = `custom___${f.schema.key}___${f.globalKey}`
  const list = customFields.value[f.schema.key] || []
  const i = list.findIndex((x) => x.id === f.id)
  if (i > -1) list.splice(i, 1)
  delete selectedCustom.value[key]
  customFieldEdit.value = null
  regenerate()
}
function copyFieldRef(f: ExportField) {
  navigator.clipboard?.writeText(`\`${f.schema.key}\`.\`${f.key}\``)
  UI.toast({ title: 'Copied to clipboard' })
}

async function regenerate() {
  const used = [...new Set([...Object.values(selectedFields.value), ...Object.values(selectedCustom.value)].map((f) => f.schema.key))]
  if (!used.length || !chosenGraph || !chosenSchemas.value) {
    clearOutput()
    return
  }
  const trimmed = chosenGraph.copy().trimTo(used)
  sqlOutput.value = buildExportSql(
    trimmed,
    chosenSchemas.value,
    schemaByKey.value,
    schemaById.value,
    Object.values(selectedFields.value),
    Object.values(selectedCustom.value),
    customFields.value,
  )
  await runSql(sqlOutput.value)
}

function labelFor(k: string) {
  const f = ({ ...selectedFields.value, ...selectedCustom.value } as Record<string, ExportField | CustomField>)[k]
  return f ? `${f.schema.label}: ${f.label}` : k
}

async function runSql(sql: string) {
  running.value = true
  try {
    const data = await useApi().runSql(sql)
    const keys = data.length ? Object.keys(data[0]) : selectedKeys.value
    columns.value = keys.map((k) => ({ key: k, label: labelFor(k) }))
    rows.value = data.map((r, i) => ({ ...r, __id: i }))
    offset.value = 0
    csvOutput.value = [keys.map(labelFor), ...data.map((r) => keys.map((k) => r[k]))].map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
  } catch (e: any) {
    UI.alert({ title: 'SQL error', content: e?.message || String(e) })
  } finally {
    running.value = false
  }
}

function copyCsv() {
  navigator.clipboard?.writeText(csvOutput.value)
  UI.toast({ title: 'CSV copied to clipboard' })
}
function copySql() {
  navigator.clipboard?.writeText(sqlOutput.value)
  UI.toast({ title: 'SQL copied to clipboard' })
}

const pageActions = computed(() => {
  const a: any[] = [{ label: 'Help', icon: 'mdi:help-circle-outline', url: 'https://docs.cocktailcms.com/exporting-data', external: true }]
  if (connectedSchemas.value.length > 1 && currentGroup.value > -1) a.push({ label: 'Choose dataset', icon: 'mdi:arrow-left', onAction: backToChoice })
  return a
})
</script>

<template>
  <Page title="Data Export" size="fullWidth" :loading="loading" :secondary-actions="pageActions">
    <EditCustomFieldSheet :field="customFieldEdit" :auto-fields="customFieldAutoFields" @update="addOrUpdateCustom" @delete="deleteCustom" @close="customFieldEdit = null" />

    <Banner v-if="!loading && !schemas.length" status="info" title="Nothing to export yet">Add a blueprint and some data first.</Banner>

    <div v-else class="wrapper" :class="{ choosing: currentGroup < 0 }">
      <aside class="side">
        <Card>
          <CardSection v-if="currentGroup < 0 && connectedSchemas.length > 1">
            <p><Icon icon="mdi:information-outline" /> Your blueprints form more than one connected group. Choose the set of data you would like to work with.</p>
          </CardSection>
          <CardSection>
            <div v-for="(group, gi) of connectedSchemas" :key="gi" class="group" :class="{ hidden: currentGroup >= 0 && currentGroup !== gi }">
              <Button v-if="currentGroup < 0" type="primary" size="small" @click="chooseDataset(gi)">Choose this set</Button>
              <div v-for="schema of nonEmpty(group)" :key="schema.id" class="schema">
                <div class="schema-label">{{ schema.label }}</div>
                <template v-for="field of schema.fields" :key="field.id">
                  <div v-if="!['link', 'sub'].includes(field.type)" class="field" :class="{ active: selectedKeys.includes((field as ExportField).globalKey) }" @click="toggleField(field as ExportField)">
                    <button type="button" class="mini" title="Copy SQL reference" @click.stop="copyFieldRef(field as ExportField)"><Icon icon="mdi:content-copy" /></button>
                    <span class="name">{{ field.label }}</span>
                  </div>
                </template>
                <div v-for="cf of customFields[schema.key] || []" :key="cf.globalKey" class="field custom" :class="{ auto: cf.auto, active: selectedKeys.includes(cf.globalKey) }" @click="toggleCustom(cf)">
                  <button v-if="!cf.auto" type="button" class="mini" title="Edit" @click.stop="clickEditCustom(cf)"><Icon icon="mdi:pencil-outline" /></button>
                  <Icon v-else icon="mdi:function-variant" class="mini" />
                  <span class="name">{{ cf.label }}</span>
                </div>
                <div v-if="currentGroup >= 0" class="field add" @click="clickAddCustom(schema)"><Icon icon="mdi:plus-circle-outline" /><span class="name">Add custom field</span></div>
              </div>
            </div>
          </CardSection>
        </Card>
      </aside>

      <main class="main" v-if="currentGroup >= 0">
        <Card>
          <Tabs
            :selected="mode"
            :tabs="[
              { value: 'simple', label: 'Simple' },
              { value: 'advanced', label: 'Advanced (SQL)' },
            ]"
            @update:selected="(v: string) => (mode = v as 'simple' | 'advanced')"
          />
        </Card>

        <template v-if="mode === 'advanced'">
          <Card>
            <CardSection
              title="Generated SQL"
              :actions="[
                { label: 'Copy', icon: 'mdi:content-copy', onAction: copySql },
                { label: 'Edit as custom', onAction: () => { customSql = sqlOutput } },
                { label: showGenerated ? 'Hide' : 'Show', onAction: () => (showGenerated = !showGenerated) },
              ]"
            >
              <pre v-if="showGenerated && sqlOutput" class="sql">{{ sqlOutput }}</pre>
              <p v-else-if="showGenerated" class="muted">Choose fields on the left to generate SQL.</p>
            </CardSection>
          </Card>
          <Card>
            <CardSection title="Custom SQL" :actions="[{ label: 'Run query', icon: 'mdi:play', onAction: () => runSql(customSql) }]">
              <TextField v-model="customSql" label="" monospace :multiline="8" max-height="50vh" placeholder="SELECT * FROM `cocktail` LIMIT 10" help-text="Each blueprint is a SQL view named after its key. Multi-value fields are JSON arrays: use json_each()." />
            </CardSection>
          </Card>
        </template>

        <Card :actions="columns.length ? [{ label: 'Copy as CSV', icon: 'mdi:content-copy', onAction: copyCsv }] : []">
          <CardSection title="Preview">
            <DataTable
              v-if="columns.length"
              :columns="columns.map((c) => ({ ...c, minWidth: 140 }))"
              :rows="rows"
              :loading="running"
              :pagination="{ offset, limit, total: rows.length, updateOffset: (v: number) => (offset = v), updateLimit: (v: number) => (limit = v) }"
            />
            <p v-else class="muted">Choose fields to display a preview.</p>
          </CardSection>
        </Card>
      </main>
    </div>
  </Page>
</template>

<style scoped>
.sql {
  margin: 0;
  padding: 12px;
  font-family: var(--octans-font-mono, monospace);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--octans-surface-subdued);
  border-radius: var(--octans-radius, 6px);
  color: var(--octans-text);
}
.wrapper {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.side {
  flex: 0 0 280px;
  max-width: 280px;
}
.wrapper.choosing .side {
  flex: 1 1 auto;
  max-width: none;
}
.wrapper.choosing .field {
  pointer-events: none;
}
.main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.wrapper.choosing .group {
  padding: 8px;
  border: 1px solid var(--octans-border);
  border-radius: var(--octans-radius, 6px);
  margin-bottom: 12px;
}
.group.hidden {
  display: none;
}
.schema {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--octans-border);
}
.schema-label {
  font-weight: 600;
  margin: 8px 0 6px;
}
.field {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.field:hover {
  background: var(--octans-surface-subdued);
}
.field.active .name {
  background: var(--octans-primary-surface);
  color: var(--octans-text-primary);
  border-radius: 4px;
  padding: 1px 6px;
}
.field.add {
  color: var(--octans-text-success);
}
.mini {
  border: 0;
  background: none;
  padding: 0;
  display: inline-flex;
  cursor: pointer;
  color: var(--octans-text-subdued);
}
.mini:hover {
  color: var(--octans-text);
}
</style>
