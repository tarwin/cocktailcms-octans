<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Card, CardSection, FormLayout, Select, Sheet, TextField } from '@octans/ui'
import { DATE_TYPES, type CustomField } from '@/api/exportSql'
import { TYPE_DATA_TYPE, getKeyFromLabel } from '@/core/utils'
import MathSimpleOptions from './MathSimpleOptions.vue'
import StringJoinOptions from './StringJoinOptions.vue'

const props = defineProps<{ field: CustomField | null; autoFields: CustomField[] }>()
const emit = defineEmits<{ update: [CustomField]; delete: [CustomField]; close: [] }>()
const local = ref<CustomField | null>(null)
watch(
  () => props.field,
  (f) => (local.value = f ? { ...f } : null),
  { immediate: true },
)

const typeOptions = [
  {
    title: 'Date',
    options: [
      { label: 'Day of Month', value: 'DATE_DAY' },
      { label: 'Day of Week', value: 'DATE_DAY_OF_WEEK' },
      { label: 'Day of Week (Number)', value: 'DATE_DAY_OF_WEEK_NUM', description: '0 = Sunday through 6 = Saturday' },
      { label: 'Month Only', value: 'DATE_MONTH' },
      { label: 'Year Only', value: 'DATE_YEAR' },
      { label: 'Year and Month', value: 'DATE_YEAR_MONTH' },
    ],
  },
  { title: 'String', options: [{ label: 'Join', value: 'STRING_JOIN' }] },
  { title: 'Math', options: [{ label: 'Simple Math', value: 'MATH_SIMPLE' }] },
]

const fieldsForType = computed(() => {
  const f = local.value
  if (!f) return []
  const s = f.schema
  const auto = props.autoFields.map((a) => ({ label: a.label, value: a.globalKey }))
  if (DATE_TYPES.includes(f.type)) return s.fields.filter((x) => x.type === 'date').map((x) => ({ label: x.label, value: x.key }))
  if (f.type === 'STRING_JOIN')
    return s.fields
      .filter((x) => ['String', 'Number', 'Date', 'Boolean', 'Color'].includes(TYPE_DATA_TYPE[x.type] || ''))
      .map((x) => ({ label: x.label, value: x.key }))
      .concat(auto)
  if (f.type === 'MATH_SIMPLE') return s.fields.filter((x) => TYPE_DATA_TYPE[x.type] === 'Number').map((x) => ({ label: x.label, value: x.key })).concat(auto)
  return s.fields.map((x) => ({ label: x.label, value: x.key }))
})

function updateKey() {
  if (local.value && !local.value.globalKey) local.value.globalKey = getKeyFromLabel(local.value.label)
}
function update() {
  if (!local.value) return
  updateKey()
  if (!local.value.label || !local.value.type) return
  emit('update', local.value)
}
</script>

<template>
  <Sheet
    :title="local?.id ? 'Edit Custom Field' : 'Add Custom Field'"
    :visible="!!local"
    :size="700"
    padded
    :primary-action="{ label: local?.id ? 'Update' : 'Add', onAction: update }"
    @close="emit('close')"
  >
    <Card v-if="local">
      <CardSection>
        <FormLayout>
          <TextField v-model="local.label" label="Label" @blur="updateKey" />
          <TextField v-model="local.globalKey" label="Key" :prefix="`custom___${local.schema.key}___`" monospace />
          <Select v-model="local.type" label="Operator" :option-groups="typeOptions" placeholder="Choose an operator" />
          <template v-if="local.type">
            <StringJoinOptions v-if="local.type === 'STRING_JOIN'" :fields="fieldsForType" :custom="local.custom" @update="(c) => (local!.custom = c)" />
            <MathSimpleOptions v-else-if="local.type === 'MATH_SIMPLE'" :fields="fieldsForType" :custom="local.custom" @update="(c) => (local!.custom = c)" />
            <Select v-else v-model="local.custom" label="Field" :options="fieldsForType" placeholder="Choose a field" />
          </template>
        </FormLayout>
      </CardSection>
      <CardSection v-if="local.id">
        <Button type="destructive" @click="emit('delete', local)">Delete</Button>
      </CardSection>
    </Card>
  </Sheet>
</template>
