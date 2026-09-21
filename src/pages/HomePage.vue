<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Card, CardSection, Icon, Layout, LayoutSection, Page, Stack, TextContainer } from '@octans/ui'
import Markdown from '@/components/Markdown.vue'
import { bus } from '@/core/bus'
import { store } from '@/store'

const showInfo = ref(false)
const settings = computed(() => store.settings)
const hasHomeText = computed(() => !!settings.value?.homeText)
const infoVisible = computed(() => showInfo.value || !hasHomeText.value)
</script>

<template>
  <Page :title="settings?.name || ''">
    <Layout>
      <LayoutSection>
        <Card v-if="hasHomeText" :title="`${settings?.icon ? settings.icon + ' ' : ''}${settings?.name || ''}`" :actions="!showInfo ? [{ label: 'About Cocktail CMS', onAction: () => (showInfo = true) }] : []">
          <CardSection><Markdown :source="settings?.homeText" /></CardSection>
        </Card>
        <div class="hero" v-if="!hasHomeText"><img src="/icon-192x192.png" width="160" height="160" alt="" /></div>
        <Card v-if="infoVisible">
          <CardSection title="This is Cocktail CMS">
            <TextContainer>
              <p>A CMS (content management system) built around data, not pages or articles.</p>
              <p>
                Everything is saved in a SQLite database inside your browser, so there is no sign-up. To keep it safe, sync it to a cloud drive
                (<Icon icon="mdi:cloud-outline" />) or export it from Settings.
              </p>
            </TextContainer>
          </CardSection>
          <CardSection title="Getting started">
            <TextContainer>
              <ul>
                <li>Load a sample below to see how it works.</li>
                <li>Browse the data using the links on the left.</li>
                <li>Add, change and remove records.</li>
                <li>Open Blueprints (<Icon icon="mdi:compass-outline" />) to change the structure.</li>
              </ul>
            </TextContainer>
          </CardSection>
          <CardSection title="Load an example">
            <Stack>
              <Button type="primary" @click="bus.emit('loadSampleProject', 'people')">Load Game of Thrones example</Button>
              <Button type="primary" @click="bus.emit('loadSampleProject', 'mix')">Load Mixology example</Button>
            </Stack>
          </CardSection>
        </Card>
      </LayoutSection>
    </Layout>
  </Page>
</template>

<style scoped>
.hero {
  text-align: center;
  margin-bottom: 24px;
}
</style>
