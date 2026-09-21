<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UI, { Card, CardSection, DataTable, FormLayout, Layout, LayoutSection, Page, Sheet, TextField, type DataTableSortType } from '@octans/ui'
import type { Blueprint } from '@/core/types'
import { RESERVED_KEYS, enterSubmits, getKeyFromLabel, orderBy } from '@/core/utils'
import { refreshBlueprints, useApi } from '@/store'

const router = useRouter()
const schemas = ref<Blueprint[]>([])
const adding = ref<{ key: string; label: string } | null>(null)
const errors = ref<Record<string, string>>({})
const sortBy = ref<DataTableSortType | undefined>(undefined)
const erdSvg = ref('')
const erdFailed = ref(false)
const keyTouched = ref(false)

onMounted(async () => {
  schemas.value = await useApi().getSchemas()
  renderErd()
})

const sorted = computed(() => {
  if (!sortBy.value) return schemas.value
  const col = sortBy.value.column
  return orderBy(schemas.value, (s: any) => (col === 'fields' ? s.fields.length : s[col]), sortBy.value.direction)
})

const columns = [
  { key: 'id', label: 'ID', sortable: true, width: 70 },
  { key: 'label', label: 'Label', sortable: true },
  { key: 'key', label: 'Key', sortable: true },
  { key: 'fields', label: '# Fields', sortable: true, width: 100 },
  { key: 'hidden', label: 'Visibility', sortable: true, width: 110 },
]

function showAdd() {
  errors.value = {}
  keyTouched.value = false
  adding.value = { key: '', label: '' }
}

watch(
  () => adding.value?.label,
  (label) => {
    if (adding.value && !keyTouched.value) adding.value.key = getKeyFromLabel(label || '')
  },
)

function validate() {
  errors.value = {}
  const f = adding.value!
  if (!f.label.trim()) errors.value.label = 'Required'
  else if (schemas.value.some((s) => s.label === f.label.trim())) errors.value.label = 'Label must be unique'
  if (!f.key.trim()) errors.value.key = 'Required'
  else if (RESERVED_KEYS.includes(f.key.trim().toLowerCase())) errors.value.key = `Cannot be ${RESERVED_KEYS.map((k) => `"${k}"`).join(', ')}`
  else if (f.key !== getKeyFromLabel(f.key)) errors.value.key = 'Keys must be lowercase a-z and numbers and start with a letter.'
  else if (schemas.value.some((s) => s.key === f.key)) errors.value.key = 'Key must be unique'
  return !Object.keys(errors.value).length
}

async function add() {
  if (!adding.value || !validate()) return
  const schema = await useApi().createSchema(adding.value.key, adding.value.label)
  adding.value = null
  await refreshBlueprints()
  router.push(`/schemas/edit/${schema.id}`)
}

async function remove(schema: Blueprint) {
  const ok = await UI.confirm({
    title: `Remove "${schema.label}"?`,
    content: 'The blueprint and all of its records will be deleted. This cannot be undone!',
    primaryActionLabel: 'Remove',
    primaryActionType: 'destructive',
  })
  if (!ok) return
  await useApi().deleteSchema(schema.id)
  schemas.value = schemas.value.filter((s) => s.id !== schema.id)
  await refreshBlueprints()
  renderErd()
}

const relationships = computed(() => {
  const byId = Object.fromEntries(schemas.value.map((s) => [s.id, s]))
  const out: Array<{ from: string; to: string; label: string; kind: string }> = []
  for (const s of schemas.value) {
    for (const f of s.fields) {
      if ((f.type === 'link' || f.type === 'sub') && byId[Number(f.params?.linkId)]) {
        out.push({ from: s.label, to: byId[Number(f.params.linkId)].label, label: f.label, kind: f.type === 'sub' ? 'has many' : f.params.allowMultiple ? 'links to many' : 'links to one' })
      }
    }
  }
  return out
})

function mermaidSource(): string {
  const byId = Object.fromEntries(schemas.value.map((s) => [s.id, s]))
  const clean = (label: string) => label.replace(/[^\p{L}\p{N} _\-.()]/gu, '').trim() || 'untitled'
  // one edge per pair of blueprints, with every field that links them on it
  const edges = new Map<string, { from: string; to: string; labels: string[]; many: boolean; required: boolean; sub: boolean }>()
  for (const s of schemas.value) {
    for (const f of s.fields) {
      const to = byId[Number(f.params?.linkId)]
      if (!to || (f.type !== 'link' && f.type !== 'sub')) continue
      const key = `${s.key}->${to.key}`
      const e = edges.get(key) || { from: s.key, to: to.key, labels: [], many: false, required: false, sub: false }
      e.labels.push(f.label)
      if (f.type === 'sub') e.sub = true
      if (f.params?.allowMultiple) e.many = true
      if (f.params?.required) e.required = true
      edges.set(key, e)
    }
  }
  const lines = schemas.value.map((s) => `  ${s.key}["${clean(s.label)}"]`)
  for (const e of edges.values()) {
    const rel = e.sub ? '||--|{' : `||--${e.required ? '|' : 'o'}${e.many ? '{' : '|'}`
    const label = e.labels.length > 2 ? `${e.labels.slice(0, 2).join(', ')} +${e.labels.length - 2} more` : e.labels.join(', ')
    lines.push(`  ${e.from} ${rel} ${e.to} : "${label.replace(/"/g, "'")}"`)
  }
  return `erDiagram
  direction LR
${lines.join('\n')}`
}

let elkRegistered = false

async function renderErd() {
  erdFailed.value = false
  erdSvg.value = ''
  if (!relationships.value.length) return
  try {
    // Loaded from a CDN only when needed; offline the text list below stands in.
    const base = 'https://cdn.jsdelivr.net/npm/'
    const mod: any = await import(/* @vite-ignore */ `${base}mermaid@11/dist/mermaid.esm.min.mjs`)
    const mermaid = mod.default || mod
    const theme = document.documentElement.dataset.octansTheme === 'dark' ? 'dark' : 'neutral'
    const config = { startOnLoad: false, theme, er: { entityPadding: 12, minEntityWidth: 120, minEntityHeight: 50, fontSize: 13 } }
    // ELK gives a far tidier layout than the default dagre engine; fall back if it will not load.
    try {
      if (!elkRegistered) {
        const elk: any = await import(/* @vite-ignore */ `${base}@mermaid-js/layout-elk@0/dist/mermaid-layout-elk.esm.min.mjs`)
        mermaid.registerLayoutLoaders(elk.default || elk)
        elkRegistered = true
      }
      mermaid.initialize({ ...config, layout: 'elk', elk: { mergeEdges: true, nodePlacementStrategy: 'NETWORK_SIMPLEX' } })
      erdSvg.value = (await mermaid.render(`erd-${Date.now()}`, mermaidSource())).svg
    } catch (e) {
      console.warn('ERD: ELK layout unavailable, using default', e)
      mermaid.initialize({ ...config, layout: 'dagre' })
      erdSvg.value = (await mermaid.render(`erd-${Date.now()}`, mermaidSource())).svg
    }
  } catch (e) {
    console.warn('ERD could not be drawn', e)
    erdFailed.value = true
  }
}
</script>

<template>
  <Page title="Blueprints" :primary-action="{ label: 'Add Blueprint', icon: 'mdi:plus', onAction: showAdd }">
    <Sheet title="New Blueprint" :visible="!!adding" :size="600" padded :primary-action="{ label: 'Add', onAction: add }" @close="adding = null">
      <Card v-if="adding">
        <CardSection>
          <div @keydown.enter="enterSubmits(add)($event)">
            <FormLayout>
              <TextField v-model="adding.label" label="Label" help-text="Shown in the CMS" :error="errors.label" />
              <TextField v-model="adding.key" label="Key" help-text="Used as the SQL view / table name when exporting." :error="errors.key" monospace @update:model-value="keyTouched = true" />
            </FormLayout>
          </div>
        </CardSection>
      </Card>
    </Sheet>

    <Layout>
      <LayoutSection>
        <Card>
          <DataTable
            :columns="columns"
            :rows="sorted"
            :sort="sortBy"
            empty-text="No blueprints yet. A blueprint describes one kind of record."
            :row-actions="[
              { label: 'Data', icon: 'mdi:table', onAction: (s) => router.push(`/data/list/${s.id}`) },
              { label: 'Edit', icon: 'mdi:pencil-outline', onAction: (s) => router.push(`/schemas/edit/${s.id}`) },
              { label: 'Remove', icon: 'mdi:delete-outline', onAction: (s) => remove(s as Blueprint) },
            ]"
            @update:sort="(s: DataTableSortType) => (sortBy = s)"
            @click-row="(s: Blueprint) => router.push(`/schemas/edit/${s.id}`)"
          >
            <template #col:fields="{ row }">{{ row.fields.length }}</template>
            <template #col:hidden="{ row }">{{ row.hidden ? 'Hidden' : row.secondary ? 'Secondary' : 'Shown' }}</template>
          </DataTable>
        </Card>
        <Card v-if="relationships.length" title="Relationships">
          <CardSection>
            <div v-if="erdSvg" class="erd" v-html="erdSvg"></div>
            <ul v-else class="rel-list">
              <li v-for="(r, i) in relationships" :key="i"><b>{{ r.from }}</b> {{ r.kind }} <b>{{ r.to }}</b> <span class="muted">({{ r.label }})</span></li>
            </ul>
          </CardSection>
        </Card>
      </LayoutSection>
    </Layout>
  </Page>
</template>

<style scoped>
.erd {
  overflow-x: auto;
}
.erd :deep(svg) {
  max-width: 100%;
  height: auto;
}
.rel-list {
  margin: 0;
  padding-left: 20px;
}
</style>
