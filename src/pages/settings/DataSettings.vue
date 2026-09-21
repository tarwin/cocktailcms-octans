<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import UI, { Button, Card, CardSection, Checkbox, ChoiceList, FormLayout, FormLayoutGroup, Select, SkeletonCard, Stack, StatGroup, Stat, TextContainer } from '@octans/ui'
import { bus } from '@/core/bus'
import type { FilesExport, Project, ProjectExport } from '@/core/types'
import { arrayToCsv, downloadBlob, downloadText, orderBy, pickFile, readFileAsBytes, readFileAsText } from '@/core/utils'
import { refreshAll, store, useApi } from '@/store'

const loading = ref(true)
const project = ref<Project | null>(null)
const busy = ref('')

const presets = [
  { label: 'Custom', value: 'custom' },
  { label: 'Tableau', value: 'tableau', preset: { columnHeadings: 'labels', addIdsToLinkedHeadings: true, addBlueprintNameToIds: true } },
  { label: 'Database', value: 'database', preset: { columnHeadings: 'keys', addIdsToLinkedHeadings: true, addBlueprintNameToIds: false } },
]
const csvPreset = ref('tableau')
const csv = ref({ columnHeadings: 'labels', addIdsToLinkedHeadings: true, addBlueprintNameToIds: true })
let applyingPreset = false

watch(csvPreset, (v) => {
  const p = presets.find((x) => x.value === v)?.preset
  if (p) {
    applyingPreset = true
    csv.value = { ...p }
    setTimeout(() => (applyingPreset = false), 0)
  }
})
watch(csv, () => !applyingPreset && (csvPreset.value = 'custom'), { deep: true })

onMounted(async () => {
  project.value = await useApi().getCurrentProject()
  loading.value = false
})

async function run(label: string, fn: () => Promise<void>) {
  busy.value = label
  try {
    await fn()
  } catch (e: any) {
    UI.alert({ title: 'Error', content: e?.message || String(e) })
  } finally {
    busy.value = ''
  }
}

// --- whole database -------------------------------------------------------
function exportDatabase() {
  return run('db', async () => {
    const bytes = await useApi().exportDatabase()
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/vnd.sqlite3' }), `cocktailcms.sqlite3`)
  })
}
async function importDatabase() {
  const file = await pickFile('.sqlite3,.sqlite,.db')
  if (!file) return
  const ok = await UI.confirm({
    title: 'Replace the whole database?',
    content: 'Every project in this browser will be replaced by the contents of the file. Export first if unsure.',
    primaryActionLabel: 'Replace',
    primaryActionType: 'destructive',
  })
  if (!ok) return
  await run('db', async () => {
    await useApi().importDatabase(await readFileAsBytes(file))
    await refreshAll()
    UI.toast({ title: 'Database imported', tone: 'success' })
  })
}

// --- project JSON ---------------------------------------------------------
function exportAll() {
  return run('json', async () => {
    const json = await useApi().exportProject()
    downloadText(JSON.stringify(json, null, 2), `cocktail.${project.value?.key}.all.json`, 'application/json')
  })
}
function exportFiles() {
  return run('files', async () => {
    downloadText(await useApi().getAllFilesAsJson(), `cocktail.${project.value?.key}.files.json`, 'application/json')
  })
}
async function importAll() {
  const file = await pickFile('.json')
  if (!file) return
  await run('json', async () => {
    const data = JSON.parse(await readFileAsText(file)) as ProjectExport
    await useApi().importProjectExport(data)
    await refreshAll()
    UI.toast({ title: 'Project imported', tone: 'success' })
  })
}
async function importFiles() {
  const file = await pickFile('.json')
  if (!file) return
  await run('files', async () => {
    const data = JSON.parse(await readFileAsText(file)) as FilesExport
    if (!data.files || !data.thumbs) throw new Error('Not a files export')
    for (const id of Object.keys(data.files)) await useApi().setFileFromImport(Number(id), data.files[id])
    for (const id of Object.keys(data.thumbs)) await useApi().setFileFromImport(Number(id), data.thumbs[id], true)
    UI.toast({ title: 'Files imported', tone: 'success' })
  })
}

// --- CSV ------------------------------------------------------------------
function exportCsv() {
  return run('csv', async () => {
    const api = useApi()
    const [schemas, tables] = await Promise.all([api.getSchemas(), api.getAllData()])
    const useLabels = csv.value.columnHeadings === 'labels'
    for (const table of tables) {
      const schema = schemas.find((s) => s.id === table.schemaId)
      if (!schema) continue
      const fields = orderBy(schema.fields, 'order')
      const manyToMany: Record<string, { fieldFrom: string; fieldTo: string; name: string; data: any[][] }> = {}
      let idHeading = useLabels ? 'ID' : 'id'
      if (csv.value.addBlueprintNameToIds) idHeading = useLabels ? `${schema.label} ${idHeading}` : `${schema.key}_${idHeading}`
      const cols = fields.filter((f) => {
        if (f.type === 'link' && f.params.allowMultiple) {
          const linked = schemas.find((s) => s.id === Number(f.params.linkId))
          if (linked) {
            manyToMany[f.key] = {
              fieldFrom: useLabels ? `${schema.label} ID` : `${schema.key}_id`,
              fieldTo: useLabels ? `${linked.label} ID` : `${linked.key}_id`,
              name: `cocktail.${schema.key}__${f.key}___to___${linked.key}.csv`,
              data: [],
            }
          }
          return false
        }
        return f.type !== 'sub'
      })
      const rows: any[][] = [
        [
          idHeading,
          ...cols.map((f) => {
            const suffix = f.type === 'link' && csv.value.addIdsToLinkedHeadings ? (useLabels ? ' ID' : '_id') : ''
            return (useLabels ? f.label : f.key) + suffix
          }),
        ],
      ]
      for (const rec of table.data) {
        rows.push([rec.id, ...cols.map((f) => rec[f.key])])
        for (const [key, m] of Object.entries(manyToMany)) {
          if (Array.isArray(rec[key])) for (const to of rec[key]) m.data.push([rec.id, to])
        }
      }
      downloadText(arrayToCsv(rows), `cocktail.${schema.key}.csv`, 'text/csv')
      for (const m of Object.values(manyToMany)) downloadText(arrayToCsv([[m.fieldFrom, m.fieldTo], ...m.data]), m.name, 'text/csv')
    }
  })
}

// --- clear ----------------------------------------------------------------
async function clear(what: 'data' | 'schemas' | 'settings') {
  const titles = { data: 'Clear all data?', schemas: 'Clear all blueprints (and their data)?', settings: 'Clear project settings?' }
  const ok = await UI.confirm({ title: titles[what], content: 'This cannot be undone. Export first so you do not lose any work.', primaryActionLabel: 'Clear', primaryActionType: 'destructive' })
  if (!ok) return
  const api = useApi()
  if (what === 'data') await api.clearAllData()
  if (what === 'schemas') await api.clearAllSchemas()
  if (what === 'settings') await api.clearSettings()
  await refreshAll()
  UI.toast({ title: 'Cleared', tone: 'success' })
}
</script>

<template>
  <SkeletonCard v-if="loading" />
  <template v-else>
    <Card title="Storage">
      <CardSection>
        <StatGroup>
          <Stat label="Platform" :value="store.platform" />
          <Stat label="Database" :value="useApi().db.name" />
          <Stat label="Persistent" :value="store.persistent ? 'Yes' : 'No (memory only)'" />
        </StatGroup>
      </CardSection>
      <CardSection title="Whole database (all projects)">
        <FormLayout>
          <TextContainer><p>A standard SQLite file. Open it in any SQLite tool, or restore it here.</p></TextContainer>
          <Stack spacing="tight">
            <Button type="primary" icon="mdi:download" :loading="busy === 'db'" @click="exportDatabase">Export database</Button>
            <Button icon="mdi:upload" :loading="busy === 'db'" @click="importDatabase">Import database</Button>
          </Stack>
        </FormLayout>
      </CardSection>
    </Card>

    <Card title="Import / Export Project (JSON)">
      <CardSection>
        <FormLayout>
          <TextContainer><p>The same format as the original Cocktail CMS, so old exports still load.</p></TextContainer>
          <Stack spacing="tight">
            <Button type="primary" :loading="busy === 'json'" @click="exportAll">Export project data</Button>
            <Button type="primary" :loading="busy === 'files'" @click="exportFiles">Export project files</Button>
            <Button :loading="busy === 'json'" @click="importAll">Import project data</Button>
            <Button :loading="busy === 'files'" @click="importFiles">Import project files</Button>
          </Stack>
        </FormLayout>
      </CardSection>
    </Card>

    <Card title="Export Data: CSV">
      <CardSection>
        <FormLayout>
          <Select v-model="csvPreset" label="Export presets" :options="presets.map((p) => ({ value: p.value, label: p.label }))" />
          <ChoiceList
            v-model="csv.columnHeadings"
            label="Column headings"
            appearance="segmented"
            :options="[
              { label: 'Labels', value: 'labels' },
              { label: 'Keys', value: 'keys' },
            ]"
          />
          <FormLayoutGroup>
            <Checkbox v-model="csv.addIdsToLinkedHeadings" label="Add IDs to linked data headings?" :help-text="csv.columnHeadings === 'labels' ? `ie 'Cocktail' becomes 'Cocktail ID'` : `ie 'cocktail' becomes 'cocktail_id'`" />
            <Checkbox v-model="csv.addBlueprintNameToIds" label="Add blueprint names to IDs?" :help-text="csv.columnHeadings === 'labels' ? `ie 'ID' becomes 'Cocktail ID'` : `ie 'id' becomes 'cocktail_id'`" />
          </FormLayoutGroup>
          <TextContainer><p class="muted">One CSV per blueprint, plus one per many-to-many link. You may need to allow multiple downloads.</p></TextContainer>
          <div><Button type="primary" :loading="busy === 'csv'" @click="exportCsv">Export data as CSVs</Button></div>
        </FormLayout>
      </CardSection>
    </Card>

    <Card title="Sample Data">
      <CardSection>
        <FormLayout>
          <TextContainer><p>Load sample blueprints and data. This replaces everything in the current project.</p></TextContainer>
          <Stack spacing="tight">
            <Button @click="bus.emit('loadSampleProject', 'people')">Load Game of Thrones sample (linked data, all field types)</Button>
            <Button @click="bus.emit('loadSampleProject', 'mix')">Load Mixology sample</Button>
          </Stack>
        </FormLayout>
      </CardSection>
    </Card>

    <Card title="Clear">
      <CardSection>
        <FormLayout>
          <TextContainer><p>Make sure you export first so you don't lose anything!</p></TextContainer>
          <Stack spacing="tight">
            <Button type="destructive" @click="clear('data')">Clear data</Button>
            <Button type="destructive" @click="clear('schemas')">Clear blueprints</Button>
            <Button type="destructive" @click="clear('settings')">Clear project settings</Button>
          </Stack>
        </FormLayout>
      </CardSection>
    </Card>
  </template>
</template>
