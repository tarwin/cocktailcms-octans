<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import dayjs from 'dayjs'
import UI, { Banner, Button, Card, CardSection, Checkbox, FormLayout, Stack, TextContainer } from '@octans/ui'
import { platform, setPuterOptIn } from '@/core/platform'
import { store, useSync } from '@/store'
import type { SyncProviderType } from '@/sync/types'

const working = ref(false)
const currentType = ref<SyncProviderType | null>(null)
const signedIn = ref(false)
const puterOptIn = ref(platform === 'puter')
let off: Array<() => void> = []

async function refresh() {
  const s = useSync()
  currentType.value = s.providerType()
  signedIn.value = await s.isSignedIn()
}

onMounted(async () => {
  const s = useSync()
  off.push(s.bus.on('connector-change', refresh))
  await refresh()
})
onUnmounted(() => off.forEach((f) => f()))

const providers = computed(() => useSync().availableProviders())
const lastUpdated = computed(() => {
  const t = useSync().lastUpdated()
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : 'never'
})

async function connect(type: SyncProviderType) {
  working.value = true
  try {
    const ok = await useSync().connectTo(type)
    if (!ok) UI.alert({ title: 'Not connected', content: 'Sign-in did not complete.' })
  } finally {
    working.value = false
    await refresh()
  }
}
async function reconnect() {
  working.value = true
  try {
    await useSync().reconnect()
  } finally {
    working.value = false
    await refresh()
  }
}
async function disconnect() {
  const ok = await UI.confirm({ title: 'Disconnect?', content: 'The copy in the cloud is left as it is.' })
  if (!ok) return
  working.value = true
  try {
    await useSync().disconnect()
  } finally {
    working.value = false
    await refresh()
  }
}
async function pushNow() {
  working.value = true
  try {
    await useSync().pushNow()
    UI.toast({ title: 'Synced', tone: 'success' })
  } finally {
    working.value = false
  }
}
async function pullNow() {
  const ok = await UI.confirm({ title: 'Replace local data with the cloud copy?', content: 'Anything not yet synced will be lost.', primaryActionType: 'destructive' })
  if (!ok) return
  working.value = true
  try {
    await useSync().pullNow()
  } finally {
    working.value = false
  }
}
function togglePuter(on: boolean) {
  puterOptIn.value = on
  setPuterOptIn(on)
}
</script>

<template>
  <Card title="Sync">
    <CardSection>
      <TextContainer>
        <p>Sync keeps a copy of the whole database (every project, including images and files) in a cloud drive, and updates it a couple of seconds after each change. Use it as a backup, or to move between devices.</p>
      </TextContainer>
      <Banner v-if="!store.persistent" status="warning" title="Storage is memory only in this browser">Data will be lost when the tab closes unless sync is set up or you export it.</Banner>
    </CardSection>
  </Card>

  <template v-if="!currentType">
    <Card v-for="p in providers" :key="p.type" :title="`Sync: ${p.name}`">
      <CardSection>
        <FormLayout>
          <TextContainer>
            <p v-if="p.type === 'puter'">Store the database in your Puter cloud drive. Works anywhere, and is the natural choice when the app is hosted on Puter.</p>
            <p v-else>Store the database in a "CocktailCMS Data" folder in your Google Drive.</p>
          </TextContainer>
          <Button :type="p.recommended ? 'primary' : 'default'" :loading="working" :icon="p.type === 'puter' ? 'mdi:cloud-outline' : 'mdi:google-drive'" @click="connect(p.type)">Connect to {{ p.name }}</Button>
        </FormLayout>
      </CardSection>
    </Card>
  </template>
  <Card v-else :title="`Synced to ${providers.find((p) => p.type === currentType)?.name}`">
    <CardSection>
      <TextContainer>
        <p v-if="signedIn">Connected. Last synced from this browser: {{ lastUpdated }}.</p>
        <p v-else>Your session with the provider has ended. Reconnect to keep syncing.</p>
      </TextContainer>
      <Stack spacing="tight">
        <Button v-if="!signedIn" type="primary" :loading="working" @click="reconnect">Reconnect</Button>
        <Button v-else type="primary" icon="mdi:cloud-upload-outline" :loading="working" @click="pushNow">Sync now</Button>
        <Button v-if="signedIn" icon="mdi:cloud-download-outline" :loading="working" @click="pullNow">Pull from cloud</Button>
        <Button type="destructive" :loading="working" @click="disconnect">Disconnect</Button>
      </Stack>
    </CardSection>
  </Card>

  <Card title="Platform">
    <CardSection>
      <TextContainer>
        <p>Running as <b>{{ store.platform }}</b>. Storage: {{ store.persistent ? 'persistent' : 'memory only' }}.</p>
      </TextContainer>
      <Checkbox v-if="platform !== 'tinyjs'" :model-value="puterOptIn" label="Treat this install as a Puter app" help-text="Loads the Puter SDK on startup and recommends Puter for sync. Takes effect after a reload." @update:model-value="togglePuter" />
    </CardSection>
  </Card>
</template>
