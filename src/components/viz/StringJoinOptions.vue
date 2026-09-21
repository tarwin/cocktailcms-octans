<script setup lang="ts">
import { ref, watch } from 'vue'
import { FormLayout, TextField } from '@octans/ui'
import DragAndDropItems from './DragAndDropItems.vue'

interface Item {
  label: string
  value: string
}
const props = defineProps<{ fields: Item[]; custom?: { fields: Item[]; separator: string } | null }>()
const emit = defineEmits<{ update: [{ fields: Item[]; separator: string }] }>()
const selected = ref<Item[]>(props.custom?.fields || [])
const separator = ref(props.custom?.separator ?? ' ')
watch([selected, separator], () => emit('update', { fields: selected.value, separator: separator.value }), { deep: true, immediate: true })
</script>

<template>
  <FormLayout>
    <DragAndDropItems v-model="selected" label="Fields" help-text="Add fields in the order they should be joined." :fields="fields" />
    <TextField v-model="separator" label="Separator" :help-text="separator.match(/^\s+$/) ? `Separator is ${separator.length} space(s).` : ''" />
  </FormLayout>
</template>
