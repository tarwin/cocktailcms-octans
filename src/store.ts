// ---------------------------------------------------------------------------
// App-wide reactive state. A plain module singleton is enough here: there is
// one database, one current project, and every page reads the same lists.
// ---------------------------------------------------------------------------
import { computed, reactive, readonly } from 'vue'
import { Api } from '@/api/Api'
import { platform, type PlatformKind } from '@/core/platform'
import type { BlueprintSummary, Project, ProjectSettings } from '@/core/types'
import { openDatabase } from '@/db'
import { SyncManager } from '@/sync/SyncManager'

interface State {
  ready: boolean
  error: string
  platform: PlatformKind
  persistent: boolean
  projects: Project[]
  currentProject: Project | null
  blueprints: BlueprintSummary[]
  settings: ProjectSettings | null
  syncing: boolean
}

const state = reactive<State>({
  ready: false,
  error: '',
  platform,
  persistent: true,
  projects: [],
  currentProject: null,
  blueprints: [],
  settings: null,
  syncing: false,
})

let api: Api | null = null
let sync: SyncManager | null = null

export function useApi(): Api {
  if (!api) throw new Error('Database not ready')
  return api
}

export function useSync(): SyncManager {
  if (!sync) throw new Error('Sync not ready')
  return sync
}

export const store = readonly(state)

export const primaryBlueprints = computed(() => state.blueprints.filter((b) => !b.hidden && !b.secondary))
export const secondaryBlueprints = computed(() => state.blueprints.filter((b) => !b.hidden && b.secondary))

export async function refreshProjects() {
  if (!api) return
  state.projects = await api.getProjectsList()
  state.currentProject = await api.getCurrentProject()
}

export async function refreshBlueprints() {
  if (!api) return
  state.blueprints = await api.getSchemaList()
}

export async function refreshSettings() {
  if (!api) return
  state.settings = await api.getSettings()
}

export async function refreshAll() {
  await Promise.all([refreshProjects(), refreshBlueprints(), refreshSettings()])
}

export async function switchProject(projectId: number) {
  if (!api) return
  await api.switchProject(projectId)
  await refreshAll()
}

export function setSyncing(on: boolean) {
  state.syncing = on
}

export async function boot() {
  try {
    const db = await openDatabase()
    state.persistent = db.persistent
    api = new Api(db)
    await api.init()
    if (import.meta.env.DEV) (window as any).__api = api
    api.bus.on('schemasUpdated', refreshBlueprints)
    api.bus.on('settingsUpdated', refreshSettings)
    api.bus.on('projectsUpdated', refreshProjects)
    api.bus.on('databaseReplaced', refreshAll)
    sync = new SyncManager(api)
    await sync.init()
    await refreshAll()
    state.ready = true
  } catch (e: any) {
    console.error(e)
    state.error = e?.message || String(e)
  }
}
