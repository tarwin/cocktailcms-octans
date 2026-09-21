<script setup lang="ts">
import { ColorSelector, FormLayout, FormLayoutGroup, Icon, Select, TextField } from '@octans/ui'
import { toIconName } from '@/core/utils'
import { useParams } from './useParams'

const props = defineProps<{ modelValue?: Record<string, any>; schema?: any }>()
const emit = defineEmits<{ 'update:modelValue': [Record<string, any>] }>()
const p = useParams(props, emit, {
  displayAs: 'check',
  trueDisplay: 'True',
  falseDisplay: 'False',
  iconTrue: 'mdi:toggle-switch',
  iconFalse: 'mdi:toggle-switch-off-outline',
  iconTrueColor: '#135CBC',
  iconFalseColor: '#888888',
  defaultValue: false,
})
</script>

<template>
  <FormLayout>
    <Select
      v-model="p.displayAs"
      label="Display as"
      :options="[
        { value: 'check', label: 'Checkbox' },
        { value: 'select', label: 'Select' },
        { value: 'radio', label: 'Radio Buttons' },
        { value: 'icon', label: 'Icon toggle' },
      ]"
    />
    <template v-if="p.displayAs === 'icon'">
      <TextField v-model="p.iconFalse" label="False Icon" placeholder="mdi:toggle-switch-off-outline" help-text="An Iconify name, see https://icon-sets.iconify.design">
        <template #right><span class="preview" :style="{ color: p.iconFalseColor }"><Icon :icon="toIconName(p.iconFalse)" size="24px" /></span></template>
      </TextField>
      <ColorSelector v-model="p.iconFalseColor" label="False Color" alpha format="hex" full-width />
      <TextField v-model="p.iconTrue" label="True Icon" placeholder="mdi:toggle-switch">
        <template #right><span class="preview" :style="{ color: p.iconTrueColor }"><Icon :icon="toIconName(p.iconTrue)" size="24px" /></span></template>
      </TextField>
      <ColorSelector v-model="p.iconTrueColor" label="True Color" alpha format="hex" full-width />
    </template>
    <FormLayoutGroup v-else>
      <TextField v-model="p.trueDisplay" label="True display" />
      <TextField v-model="p.falseDisplay" label="False display" />
    </FormLayoutGroup>
    <Select
      v-model="p.defaultValue"
      label="Default Value"
      :options="[
        { value: true, label: 'True' },
        { value: false, label: 'False' },
      ]"
    />
  </FormLayout>
</template>

<style scoped>
.preview {
  padding: 0 8px;
  display: inline-flex;
}
</style>
