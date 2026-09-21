<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Card, Layout, LayoutSection, Page, Tabs } from '@octans/ui'

const route = useRoute()
const router = useRouter()
const tabs = [
  { value: 'project-settings', label: 'Project', icon: 'mdi:palette-outline' },
  { value: 'data', label: 'Data', icon: 'mdi:database-outline' },
  { value: 'sync', label: 'Sync', icon: 'mdi:cloud-outline' },
  { value: 'projects', label: 'Projects', icon: 'mdi:folder-multiple-outline' },
]
const selected = computed(() => route.path.split('/').pop() || 'project-settings')
const heading = computed(() => tabs.find((t) => t.value === selected.value)?.label || '')
</script>

<template>
  <Page :title="`Settings / ${heading}`">
    <Layout>
      <LayoutSection>
        <Card>
          <Tabs :tabs="tabs" :selected="selected" @update:selected="(v: string) => router.push(`/settings/${v}`)" />
        </Card>
        <router-view />
      </LayoutSection>
    </Layout>
  </Page>
</template>
