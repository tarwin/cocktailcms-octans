<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UI, {
  ActionList,
  AppFrame,
  Banner,
  Button,
  GlobalNav,
  Icon,
  Navigation,
  Popover,
  Spinner,
  applyCustomTheme,
  clearCustomTheme,
  createTheme,
  persistTheme,
  toggleTheme,
  type NavigationSectionType,
} from '@octans/ui'
import LibrarySheet from '@/components/library/LibrarySheet.vue'
import SyncConflictModal from '@/components/SyncConflictModal.vue'
import { bus } from '@/core/bus'
import type { ProjectExport } from '@/core/types'
import { primaryBlueprints, refreshAll, secondaryBlueprints, setSyncing, store, switchProject, useApi, useSync } from '@/store'

const VERSION = '1.0.0'

const route = useRoute()
const router = useRouter()
const conflictModal = ref<InstanceType<typeof SyncConflictModal> | null>(null)
const syncName = ref('')
const syncConnected = ref(false)
const syncError = ref('')

const title = computed(() => {
  const s = store.settings
  const project = store.currentProject
  return s?.name || project?.label || 'Cocktail CMS'
})

const location = computed(() => {
  const m = route.path.match(/^\/data\/list\/(\d+)/)
  if (m) return `bp-${m[1]}`
  if (route.path.startsWith('/schemas')) return 'schemas'
  if (route.path.startsWith('/settings')) return 'settings'
  if (route.path.startsWith('/visualizations')) return 'export'
  return 'home'
})

const navSections = computed<NavigationSectionType[]>(() => {
  const toItem = (b: { id: number; label: string }) => ({ id: `bp-${b.id}`, label: b.label, url: `#/data/list/${b.id}` })
  if (!store.blueprints.length) {
    return [{ id: 'empty', items: [{ id: 'schemas', label: 'Add a Blueprint', url: '#/schemas' }] }]
  }
  const sections: NavigationSectionType[] = [{ id: 'primary', items: primaryBlueprints.value.map(toItem) }]
  if (secondaryBlueprints.value.length) sections.push({ id: 'secondary', items: secondaryBlueprints.value.map(toItem) })
  return sections
})

const tools = [
  { id: 'export', label: 'Data Export', icon: 'mdi:database-export-outline', url: '#/visualizations' },
  { id: 'schemas', label: 'Blueprints', icon: 'mdi:compass-outline', url: '#/schemas' },
  { id: 'settings', label: 'Settings', icon: 'mdi:cog-outline', url: '#/settings' },
]

const projectItems = computed(() =>
  store.projects.map((p) => ({
    label: `${p.id === store.currentProject?.id ? '✅ ' : ''}${p.label}`,
    onAction: () => void doSwitchProject(p.id),
  })),
)

async function doSwitchProject(id: number) {
  UI.loader.show('Switching project …')
  try {
    await switchProject(id)
    router.push('/home')
  } finally {
    UI.loader.hide()
  }
}

// --- theme -----------------------------------------------------------------
function applyHighlight() {
  const s = store.settings
  if (!s) return
  const primary = (s.highlightColor || '').slice(0, 7)
  if (/^#[0-9a-f]{6}$/i.test(primary) && primary.toLowerCase() !== '#737a90') {
    try {
      applyCustomTheme(createTheme({ name: 'Project', primary }))
    } catch (e) {
      console.warn('theme', e)
    }
  } else {
    clearCustomTheme()
  }
  document.documentElement.style.setProperty('--octans-surface-nav', s.highlightColor?.slice(0, 7) || '')
  document.documentElement.style.setProperty('--octans-text-on-nav', s.highlightTextColor?.slice(0, 7) || '')
}
watch(() => store.settings, applyHighlight, { deep: true })

function toggleDark() {
  toggleTheme()
  persistTheme()
}

// --- sample data -----------------------------------------------------------
async function loadSampleProject(type: 'people' | 'mix') {
  const ok = await UI.confirm({
    title: 'Load sample data and blueprints?',
    content: 'This will overwrite anything in the current project and cannot be undone. Export first if you want to keep your data.',
    primaryActionLabel: 'Load sample',
    primaryActionType: 'destructive',
  })
  if (!ok) return
  UI.loader.show('Loading sample …')
  try {
    const res = await fetch(`./sample/cocktail.${type}.all.json`)
    const json = (await res.json()) as ProjectExport
    await useApi().importProjectExport(json)
    await refreshAll()
    UI.toast({ title: 'Sample loaded', tone: 'success' })
    router.push('/home')
  } catch (e: any) {
    UI.alert({ title: 'Error', content: e?.message })
  } finally {
    UI.loader.hide()
  }
}
bus.on('loadSampleProject', loadSampleProject)

// --- sync wiring -----------------------------------------------------------
function wireSync() {
  const sync = useSync()
  const refresh = () => {
    syncConnected.value = sync.hasProvider()
    syncName.value = sync.providerName()
  }
  refresh()
  sync.bus.on('connector-change', refresh)
  sync.bus.on('start-working', () => setSyncing(true))
  sync.bus.on('stop-working', () => setSyncing(false))
  sync.bus.on('error', (msg: string) => {
    syncError.value = msg
    UI.toast({ title: 'Sync problem', content: msg, tone: 'error', duration: 6000 })
  })
  sync.bus.on('pulled', async () => {
    await refreshAll()
    UI.toast({ title: 'Data updated from the cloud', tone: 'success' })
    router.push('/home')
  })
  sync.bus.on('conflict', (local: number, remote: number, resolve: (d: any) => void) => {
    conflictModal.value?.show(local, remote, resolve)
  })
}

watch(
  () => store.ready,
  (ready) => {
    if (ready) {
      applyHighlight()
      wireSync()
    }
  },
)

onMounted(() => {
  persistTheme()
})
</script>

<template>
  <div v-if="store.error" class="boot-error">
    <Banner title="The database could not be opened" status="error">
      <p>{{ store.error }}</p>
      <p>This app needs a browser with WebAssembly support. If you are in a private window, storage may be blocked.</p>
    </Banner>
  </div>
  <div v-else-if="!store.ready" class="boot">
    <Spinner size="large" />
    <div class="muted">Opening database …</div>
  </div>
  <AppFrame v-else layout="topbar">
    <template #topbar>
      <GlobalNav :title="title" logo @click-title="router.push('/home')">
        <template #logo>
          <span class="app-logo" @click="router.push('/home')">
            <span v-if="store.settings?.icon" class="emoji">{{ store.settings.icon }}</span>
            <Icon v-else icon="mdi:glass-cocktail" size="22px" />
            <span>Cocktail CMS</span>
            <span class="version">v{{ VERSION }}</span>
          </span>
        </template>
        <template #actions>
          <div class="nav-actions">
          <Button type="plain" icon="mdi:home-outline" tooltip="Home" @click="router.push('/home')" />
          <Popover auto-hide placement="bottom-end">
            <template #trigger="{ toggle }">
              <Button
                type="plain"
                invert
                :icon="store.syncing ? 'mdi:cloud-sync-outline' : syncConnected ? 'mdi:cloud-check-outline' : 'mdi:cloud-outline'"
                :tooltip="syncConnected ? `Sync: ${syncName}` : 'Sync'"
                :loading="store.syncing"
                @click="toggle"
              />
            </template>
            <template #default="{ hide }">
              <div class="sync-pop">
                <div v-if="syncConnected"><Icon icon="mdi:cloud-check-outline" /> Syncing to <b>{{ syncName }}</b></div>
                <div v-else class="muted">Not syncing. Your data lives only in this browser.</div>
                <div v-if="!store.persistent" class="warn"><Icon icon="mdi:alert-outline" /> Storage is memory only here; set up sync or export regularly.</div>
                <Button size="small" @click="hide(); router.push('/settings/sync')">Sync settings</Button>
              </div>
            </template>
          </Popover>
          <ActionList v-if="store.projects.length > 1" :items="projectItems" placement="bottom-end">
            <Button type="plain" icon="mdi:swap-horizontal" tooltip="Switch project" />
          </ActionList>
          <Button type="plain" icon="mdi:theme-light-dark" tooltip="Light / dark" @click="toggleDark" />
          <Button type="plain" icon="mdi:help-circle-outline" tooltip="Help (external)" url="https://docs.cocktailcms.com/" external />
          </div>
        </template>
      </GlobalNav>
    </template>
    <template #sidebar>
      <Navigation :sections="navSections" :location="location" highlight>
        <template #footer>
          <nav class="tools">
            <a v-for="t in tools" :key="t.id" :href="t.url" class="tool" :class="{ active: location === t.id }">
              <Icon :icon="t.icon" size="20px" />
              <span>{{ t.label }}</span>
            </a>
          </nav>
        </template>
      </Navigation>
    </template>
    <router-view />
    <template #footer>
      <div class="footer muted">&copy; 2020 &ndash; {{ new Date().getFullYear() }} <a href="https://tarwin.art/" target="_blank">tarwin.art</a> · {{ store.platform }}</div>
    </template>
  </AppFrame>
  <LibrarySheet />
  <SyncConflictModal ref="conflictModal" />
</template>

<style scoped>
.nav-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.nav-actions :deep(button),
.nav-actions :deep(a) {
  color: var(--octans-text-on-nav);
  opacity: 0.85;
  padding: 6px;
}
.nav-actions :deep(svg) {
  width: 24px;
  height: 24px;
  font-size: 24px;
}
.tools {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 12px;
}
.tool {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: var(--octans-radius-field, 6px);
  color: var(--octans-text-subdued);
  text-decoration: none;
  font-size: 14px;
}
.tool:hover {
  background: var(--octans-surface-hover);
  color: var(--octans-text);
}
.tool.active {
  color: var(--octans-text-primary);
  background: var(--octans-primary-surface);
}
.nav-actions :deep(button:hover),
.nav-actions :deep(a:hover) {
  opacity: 1;
}
.boot,
.boot-error {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
}
.sync-pop {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 280px;
}
.warn {
  color: var(--octans-text-warning);
}
.footer {
  padding: 12px 24px;
  font-size: 12px;
}
.footer a {
  color: inherit;
}
</style>
