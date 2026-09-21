<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UI, { Button, Card, CardSection, ColorSelector, FormLayout, FormLayoutGroup, SkeletonCard, Stack, TextField } from '@octans/ui'
import type { ProjectSettings } from '@/core/types'
import { refreshSettings, useApi } from '@/store'

const loading = ref(true)
const settings = ref<ProjectSettings | null>(null)
const currentColor = ref('#48892F')
const currentIndex = ref(-1)

onMounted(async () => {
  settings.value = await useApi().getSettings()
  loading.value = false
})

async function save() {
  if (!settings.value) return
  await useApi().setSettings(settings.value)
  await refreshSettings()
  UI.toast({ title: 'Settings updated', tone: 'success' })
}
function addColor() {
  if (!settings.value || settings.value.pallete.includes(currentColor.value)) return
  settings.value.pallete.push(currentColor.value)
  currentIndex.value = -1
}
function updateColor() {
  if (settings.value && currentIndex.value > -1) settings.value.pallete.splice(currentIndex.value, 1, currentColor.value)
}
function removeColor() {
  if (settings.value && currentIndex.value > -1) {
    settings.value.pallete.splice(currentIndex.value, 1)
    currentIndex.value = -1
  }
}
</script>

<template>
  <SkeletonCard v-if="loading || !settings" />
  <template v-else>
    <Card title="Appearance">
      <CardSection>
        <FormLayout>
          <FormLayoutGroup>
            <ColorSelector v-model="settings.highlightColor" label="Highlight Color" format="hex" full-width help-text="Used for the top bar and as the theme's primary colour." />
            <ColorSelector v-model="settings.highlightTextColor" label="Highlight Text Color" format="hex" full-width />
          </FormLayoutGroup>
          <TextField v-model="settings.icon" label="Logo Emoji" placeholder="ie '🍸'" help-text="Simply add an emoji!" />
          <TextField v-model="settings.name" label="Project Name" placeholder="ie 'Mixology'" />
          <TextField v-model="settings.homeText" label="Home Text" placeholder="ie 'Welcome to my project …'" help-text="Shown at the top of the home page. Supports Markdown." :multiline="5" />
          <FormLayoutGroup>
            <TextField v-model="settings.defaultDateDataFormat" label="Default Date Data Format" placeholder="ie 'YYYY-MM-DD'" help-text="Day.js format" />
            <TextField v-model="settings.defaultDateDisplayFormat" label="Default Date Display Format" placeholder="ie 'MMM Do, YYYY'" help-text="Day.js format" />
          </FormLayoutGroup>
        </FormLayout>
      </CardSection>
      <CardSection title="Color palette">
        <FormLayout>
          <ColorSelector v-model="currentColor" label="Colour" alpha format="hex" full-width />
          <Stack spacing="tight">
            <Button :disabled="settings.pallete.includes(currentColor)" @click="addColor">Add</Button>
            <Button :disabled="currentIndex === -1 || settings.pallete.includes(currentColor)" @click="updateColor">Update</Button>
            <Button :disabled="currentIndex === -1" type="destructive" @click="removeColor">Remove</Button>
          </Stack>
          <div class="palette checker">
            <span v-if="!settings.pallete.length" class="muted">Add colours to your palette. Colour fields can be limited to it.</span>
            <button
              v-for="(color, i) in settings.pallete"
              :key="color"
              type="button"
              class="swatch"
              :class="{ active: currentIndex === i }"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="currentIndex = i; currentColor = color"
            ></button>
          </div>
        </FormLayout>
      </CardSection>
      <CardSection>
        <Button type="primary" @click="save">Update Settings</Button>
      </CardSection>
    </Card>
  </template>
</template>

<style scoped>
.palette {
  border: 1px solid var(--octans-border);
  border-radius: var(--octans-radius, 6px);
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 48px;
  align-items: center;
}
.swatch {
  width: 56px;
  height: 32px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
}
.swatch:hover {
  border-color: var(--octans-border);
}
.swatch.active {
  border-color: var(--octans-text);
}
</style>
