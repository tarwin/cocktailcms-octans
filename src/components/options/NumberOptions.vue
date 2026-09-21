<script setup lang="ts">
import { Checkbox, FormLayout, FormLayoutGroup, Select, TextField, ColorSelector, Icon } from '@octans/ui'
import { toIconName } from '@/core/utils'
import { useParams } from './useParams'

const props = defineProps<{ modelValue?: Record<string, any>; schema?: any }>()
const emit = defineEmits<{ 'update:modelValue': [Record<string, any>] }>()
const p = useParams(props, emit, {
  required: false,
  type: 'float',
  displayAs: 'text',
  min: null as any,
  max: null as any,
  step: null as any,
  iconOn: 'mdi:star',
  iconOff: 'mdi:star-outline',
  iconOnColor: '#FDD700',
  iconOnColorHover: '#FDD700',
  iconOffColor: '#D2D2D2',
  iconOffColorHover: '#D2D2D2',
  defaultValue: null as any,
})
</script>

<template>
  <FormLayout>
    <Checkbox v-model="p.required" label="Required?" />
    <Select
      v-model="p.type"
      label="Number Type"
      :options="[
        { value: 'float', label: 'Floating point' },
        { value: 'int', label: 'Integer' },
      ]"
    />
    <Select
      v-model="p.displayAs"
      label="Display As"
      :options="[
        { value: 'text', label: 'Text' },
        { value: 'slider', label: 'Slider' },
        { value: 'icon', label: 'Icons (rating)' },
      ]"
    />
    <template v-if="p.displayAs === 'icon'">
      <TextField v-model="p.iconOff" label="Off Icon" placeholder="mdi:star-outline" help-text="An Iconify name, see https://icon-sets.iconify.design">
        <template #right><span class="preview" :style="{ color: p.iconOffColor }"><Icon :icon="toIconName(p.iconOff)" size="24px" /></span></template>
      </TextField>
      <FormLayoutGroup>
        <ColorSelector v-model="p.iconOffColor" label="Off Color" alpha format="hex" full-width />
        <ColorSelector v-model="p.iconOffColorHover" label="Off Color: Hover" alpha format="hex" full-width />
      </FormLayoutGroup>
      <TextField v-model="p.iconOn" label="On Icon" placeholder="mdi:star">
        <template #right><span class="preview" :style="{ color: p.iconOnColor }"><Icon :icon="toIconName(p.iconOn)" size="24px" /></span></template>
      </TextField>
      <FormLayoutGroup>
        <ColorSelector v-model="p.iconOnColor" label="On Color" alpha format="hex" full-width />
        <ColorSelector v-model="p.iconOnColorHover" label="On Color: Hover" alpha format="hex" full-width />
      </FormLayoutGroup>
    </template>
    <TextField v-if="p.displayAs !== 'slider'" v-model="p.step" label="Step Size" type="number" help-text="Number must be divisible by this (from minimum). Also the gap between rating icons." />
    <FormLayoutGroup>
      <TextField v-model="p.min" label="Minimum" type="number" help-text="Minimum value (inclusive)" />
      <TextField v-model="p.max" label="Maximum" type="number" help-text="Maximum value (inclusive)" />
    </FormLayoutGroup>
    <TextField v-model="p.defaultValue" label="Default Value" type="number" />
  </FormLayout>
</template>

<style scoped>
.preview {
  padding: 0 8px;
  display: inline-flex;
}
</style>
