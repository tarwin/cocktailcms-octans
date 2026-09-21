<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, FormLayoutGroup, Labelled, TextField } from '@octans/ui'
import type { Field } from '@/core/types'

const props = defineProps<{ modelValue?: any; field: Field; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [any] }>()
const error = ref('')
const searching = ref(false)
const address = ref('')
const control = ref<any>(null)
const p = computed(() => props.field.params || {})
const lat = computed(() => props.modelValue?.lat ?? '')
const long = computed(() => props.modelValue?.long ?? '')
const latN = computed(() => parseFloat(lat.value))
const longN = computed(() => parseFloat(long.value))
const hasPoint = computed(() => Number.isFinite(latN.value) && Number.isFinite(longN.value))

const mapUrl = computed(() => {
  if (!hasPoint.value) return ''
  const d = 0.01
  const bbox = [longN.value - d, latN.value - d, longN.value + d, latN.value + d].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latN.value},${longN.value}`
})

function set(part: 'lat' | 'long', v: any) {
  error.value = ''
  emit('update:modelValue', { lat: lat.value, long: long.value, [part]: v })
}

async function search() {
  if (!address.value.trim()) return
  searching.value = true
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address.value)}`, {
      headers: { Accept: 'application/json' },
    })
    const json = await res.json()
    if (json?.[0]) emit('update:modelValue', { lat: json[0].lat, long: json[0].lon })
    else error.value = 'Address not found.'
  } catch {
    error.value = 'Address lookup failed.'
  } finally {
    searching.value = false
  }
}

function validate(): boolean {
  error.value = ''
  if (p.value.required && !hasPoint.value) error.value = `${props.field.label} is required.`
  else if ((lat.value || long.value) && !hasPoint.value) error.value = 'Both latitude and longitude are needed.'
  else if (hasPoint.value && (Math.abs(latN.value) > 90 || Math.abs(longN.value) > 180)) error.value = 'Out of range.'
  return !error.value
}
defineExpose({ field: props.field, validate, focus: () => control.value?.focus?.(), addError: (m: string) => (error.value = m) })
</script>

<template>
  <Labelled :label="field.label" :error="error" :help-text="field.help" :required="!!p.required">
    <iframe v-if="mapUrl" class="map" :src="mapUrl" title="Map" loading="lazy"></iframe>
    <div v-else class="map placeholder muted">Enter coordinates to preview the map</div>
    <FormLayoutGroup>
      <TextField ref="control" label="Latitude" :model-value="lat" type="number" :step="0.000001" :readonly="readonly" @update:model-value="(v) => set('lat', v)" />
      <TextField label="Longitude" :model-value="long" type="number" :step="0.000001" :readonly="readonly" @update:model-value="(v) => set('long', v)" />
    </FormLayoutGroup>
    <TextField
      v-if="p.displayAddressSearch && !readonly"
      v-model="address"
      label="Find by address"
      help-text="Looks up coordinates with OpenStreetMap"
      @keydown.enter.prevent="search"
    >
      <template #right><Button size="small" :loading="searching" @click="search">Find</Button></template>
    </TextField>
  </Labelled>
</template>

<style scoped>
.map {
  width: 100%;
  height: 220px;
  border: 1px solid var(--octans-border);
  border-radius: var(--octans-radius, 6px);
  margin-bottom: 12px;
  background: var(--octans-surface-subdued);
}
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
