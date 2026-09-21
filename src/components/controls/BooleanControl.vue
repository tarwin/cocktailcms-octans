<script setup lang="ts">
import { computed, ref } from 'vue'
import { Checkbox, ChoiceList, Icon, Labelled, Select } from '@octans/ui'
import type { Field } from '@/core/types'
import { toIconName } from '@/core/utils'

const props = defineProps<{ modelValue?: any; field: Field; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [any] }>()
const control = ref<any>(null)
const focused = ref(false)
const p = computed(() => props.field.params || {})
const displayAs = computed(() => p.value.displayAs || 'check')
const isTrue = computed(() => !!props.modelValue)
const options = computed(() => [
  { value: false, label: p.value.falseDisplay || 'False' },
  { value: true, label: p.value.trueDisplay || 'True' },
])
function set(v: any) {
  if (!props.readonly) emit('update:modelValue', !!v)
}
function onKeydown(e: KeyboardEvent) {
  if (['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault()
    set(!isTrue.value)
  }
}
defineExpose({ field: props.field, validate: () => true, focus: () => control.value?.focus?.() })
</script>

<template>
  <Checkbox v-if="displayAs === 'check'" ref="control" :label="field.label" :model-value="isTrue" :readonly="readonly" :help-text="field.help" @update:model-value="set" />
  <ChoiceList v-else-if="displayAs === 'radio'" :label="field.label" :options="options" :model-value="isTrue" :readonly="readonly" :help-text="field.help" @update:model-value="set" />
  <Select v-else-if="displayAs === 'select'" ref="control" :label="field.label" :options="options" :model-value="isTrue" :readonly="readonly" :help-text="field.help" @update:model-value="set" />
  <Labelled v-else :label="field.label" :help-text="field.help">
    <button
      ref="control"
      type="button"
      class="toggle"
      :class="{ focused }"
      :style="{ color: isTrue ? p.iconTrueColor : p.iconFalseColor }"
      :aria-pressed="isTrue"
      @click="set(!isTrue)"
      @keydown="onKeydown"
      @focus="focused = true"
      @blur="focused = false"
    >
      <Icon :icon="toIconName(isTrue ? p.iconTrue || 'mdi:toggle-switch' : p.iconFalse || 'mdi:toggle-switch-off-outline')" size="28px" />
    </button>
  </Labelled>
</template>

<style scoped>
.toggle {
  border: 0;
  background: none;
  padding: 2px;
  cursor: pointer;
  display: inline-flex;
  border-radius: 4px;
  outline: 2px solid transparent;
}
.toggle.focused {
  outline-color: var(--octans-primary);
}
</style>
