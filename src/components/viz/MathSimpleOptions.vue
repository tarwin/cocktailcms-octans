<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Banner, DataTable, FormLayout, TextField } from '@octans/ui'
import { evalArithmetic } from '@/api/exportSql'

interface Item {
  label: string
  value: string
}
const props = defineProps<{ fields: Item[]; custom?: { formula: string; formulaSql: string } | null }>()
const emit = defineEmits<{ update: [{ formula: string; formulaSql: string }] }>()

const formula = ref(props.custom?.formula || '')
const error = ref('')
const example = ref('')

const fieldsWithShort = computed(() => props.fields.map((f, i) => ({ ...f, short: String.fromCharCode(65 + i), id: i })))

function validate(): boolean {
  let f = formula.value.toUpperCase()
  fieldsWithShort.value.forEach((x, i) => (f = f.split(x.short).join(String(i + 1))))
  try {
    example.value = `${f} = ${evalArithmetic(f)}`
    return true
  } catch {
    example.value = ''
    return false
  }
}

watch(
  formula,
  () => {
    if (!formula.value.trim()) {
      error.value = ''
      return
    }
    if (!validate()) {
      error.value = 'Invalid formula'
      return
    }
    error.value = ''
    let sql = formula.value.toUpperCase()
    fieldsWithShort.value.forEach((x) => (sql = sql.split(x.short).join(`\`${x.value}\``)))
    emit('update', { formula: formula.value, formulaSql: sql })
  },
  { immediate: true },
)
</script>

<template>
  <FormLayout>
    <Banner title="Use the letters in your formula" status="info">Numbers, + - * / % and brackets are allowed.</Banner>
    <DataTable
      :rows="fieldsWithShort"
      compact
      :columns="[
        { key: 'short', label: 'Letter', width: 80 },
        { key: 'label', label: 'Field' },
      ]"
    />
    <TextField v-model="formula" label="Formula" :error="error" multiline monospace help-text="ie (A + 10) / B" />
    <div v-if="example" class="muted">Example with letters replaced by 1, 2, 3 …: {{ example }}</div>
  </FormLayout>
</template>
