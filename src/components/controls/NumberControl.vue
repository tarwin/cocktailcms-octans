<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon, Labelled, RangeSlider, TextField } from '@octans/ui'
import type { Field } from '@/core/types'
import { toIconName } from '@/core/utils'

const props = defineProps<{ modelValue?: any; field: Field; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [any] }>()
const error = ref('')
const focused = ref(false)
const control = ref<any>(null)
const p = computed(() => props.field.params || {})
const displayAs = computed(() => p.value.displayAs || 'text')
const min = computed(() => (p.value.min === '' || p.value.min === null || p.value.min === undefined ? null : parseFloat(p.value.min)))
const max = computed(() => (p.value.max === '' || p.value.max === null || p.value.max === undefined ? null : parseFloat(p.value.max)))
const step = computed(() => parseFloat(p.value.step) || null)
const num = computed(() => {
  const n = parseFloat(props.modelValue)
  return Number.isFinite(n) ? n : null
})

const iconValues = computed(() => {
  const values: number[] = []
  if (max.value === null) return values
  const s = step.value || 1
  let c = min.value ?? 0
  let i = 0
  while (c <= max.value && i < 10) {
    values.push(c)
    c += s
    i++
  }
  return values
})

function set(v: any) {
  error.value = ''
  emit('update:modelValue', v === '' || v === null || v === undefined ? '' : String(v))
}

function validate(): boolean {
  error.value = ''
  const raw = props.modelValue
  if (raw === '' || raw === null || raw === undefined) {
    if (p.value.required) error.value = `${props.field.label} is required.`
    return !error.value
  }
  const n = parseFloat(raw)
  if (!Number.isFinite(n)) error.value = 'Must be a number.'
  else if (p.value.type === 'int' && !Number.isInteger(n)) error.value = 'Must be a whole number.'
  else if (min.value !== null && n < min.value) error.value = `Must be at least ${min.value}.`
  else if (max.value !== null && n > max.value) error.value = `Must be at most ${max.value}.`
  else if (step.value) {
    const base = min.value ?? 0
    const mod = Math.abs(Math.round(((n - base) / step.value) * 1e6) / 1e6) % 1
    if (mod !== 0) error.value = `Must be in steps of ${step.value}.`
  }
  return !error.value
}

function onKeydown(e: KeyboardEvent) {
  if (props.readonly) return
  const cur = num.value ?? min.value ?? 0
  const s = step.value || 1
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault()
    set(Math.max(min.value ?? -Infinity, cur - s))
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault()
    set(Math.min(max.value ?? Infinity, cur + s))
  }
}

defineExpose({
  field: props.field,
  validate,
  focus: () => control.value?.focus?.(),
  addError: (msg: string) => (error.value = msg),
})
</script>

<template>
  <RangeSlider
    v-if="displayAs === 'slider'"
    :label="field.label"
    :model-value="num ?? min ?? 0"
    :min="min ?? 0"
    :max="max ?? 100"
    :step="step ?? 1"
    :readonly="readonly"
    :required="!!p.required"
    :error="error"
    :help-text="field.help"
    show-input
    @update:model-value="set"
  />
  <Labelled v-else-if="displayAs === 'icon'" :label="field.label" :error="error" :help-text="field.help" :required="!!p.required">
    <div
      ref="control"
      class="rating"
      :class="{ focused }"
      tabindex="0"
      role="slider"
      :aria-valuenow="num ?? undefined"
      @focus="focused = true"
      @blur="focused = false"
      @keydown="onKeydown"
    >
      <button
        v-for="v of iconValues"
        :key="v"
        type="button"
        tabindex="-1"
        class="rating-icon"
        :style="{ color: (num ?? -Infinity) >= v ? p.iconOnColor : p.iconOffColor }"
        :title="String(v)"
        @click="!readonly && set(v)"
      >
        <Icon :icon="toIconName((num ?? -Infinity) >= v ? p.iconOn : p.iconOff)" size="22px" />
      </button>
      <button v-if="!p.required && num !== null && !readonly" type="button" tabindex="-1" class="rating-clear muted" @click="set('')">clear</button>
    </div>
  </Labelled>
  <TextField
    v-else
    ref="control"
    :label="field.label"
    :model-value="modelValue ?? ''"
    type="number"
    :min="min ?? undefined"
    :max="max ?? undefined"
    :step="step ?? undefined"
    :readonly="readonly"
    :required="!!p.required"
    :error="error"
    :help-text="field.help"
    @update:model-value="set"
  />
</template>

<style scoped>
.rating {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: var(--octans-radius, 6px);
  outline: 2px solid transparent;
}
.rating.focused {
  outline-color: var(--octans-primary);
}
.rating-icon,
.rating-clear {
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
  display: inline-flex;
}
.rating-clear {
  margin-left: 8px;
  font-size: 12px;
}
</style>
