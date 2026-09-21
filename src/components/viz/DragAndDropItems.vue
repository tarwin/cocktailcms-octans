<script setup lang="ts">
import { ref, watch } from 'vue'
import { Icon, Labelled } from '@octans/ui'

interface Item {
  label: string
  value: string
}
const props = defineProps<{ label?: string; helpText?: string; fields: Item[]; modelValue?: Item[] }>()
const emit = defineEmits<{ 'update:modelValue': [Item[]] }>()

const chosen = ref<Item[]>([...(props.modelValue || [])])
watch(
  () => props.modelValue,
  (v) => (chosen.value = [...(v || [])]),
)
function commit() {
  emit('update:modelValue', [...chosen.value])
}

let dragFrom: { source: 'pool' | 'chosen'; index: number } | null = null
function onDragStart(source: 'pool' | 'chosen', index: number) {
  dragFrom = { source, index }
}
function onDropAt(index: number) {
  if (!dragFrom) return
  const item = dragFrom.source === 'pool' ? props.fields[dragFrom.index] : chosen.value[dragFrom.index]
  if (dragFrom.source === 'chosen') chosen.value.splice(dragFrom.index, 1)
  const at = Math.min(index, chosen.value.length)
  chosen.value.splice(at, 0, { ...item })
  dragFrom = null
  commit()
}
function add(item: Item) {
  chosen.value.push({ ...item })
  commit()
}
function remove(i: number) {
  chosen.value.splice(i, 1)
  commit()
}
function move(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= chosen.value.length) return
  const [it] = chosen.value.splice(i, 1)
  chosen.value.splice(j, 0, it)
  commit()
}
</script>

<template>
  <Labelled :label="label" :help-text="helpText">
    <div class="drop" @dragover.prevent @drop.prevent="onDropAt(chosen.length)">
      <span v-if="!chosen.length" class="muted">Drag or click fields to add them here</span>
      <span
        v-for="(item, i) in chosen"
        :key="i"
        class="chip chosen"
        draggable="true"
        @dragstart="onDragStart('chosen', i)"
        @dragover.prevent
        @drop.prevent.stop="onDropAt(i)"
      >
        <button type="button" class="mini" title="Move left" @click="move(i, -1)"><Icon icon="mdi:chevron-left" /></button>
        {{ item.label }}
        <button type="button" class="mini" title="Move right" @click="move(i, 1)"><Icon icon="mdi:chevron-right" /></button>
        <button type="button" class="mini" title="Remove" @click="remove(i)"><Icon icon="mdi:close-circle" /></button>
      </span>
    </div>
    <div class="pool">
      <span v-for="(item, i) in fields" :key="item.value" class="chip" draggable="true" @dragstart="onDragStart('pool', i)" @click="add(item)">{{ item.label }}</span>
    </div>
  </Labelled>
</template>

<style scoped>
.drop {
  min-height: 44px;
  padding: 6px;
  border: 1px solid var(--octans-border);
  border-radius: var(--octans-radius, 6px);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
  background: var(--octans-surface);
}
.pool {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 8px;
  border: 1px solid var(--octans-border);
  border-radius: 999px;
  background: var(--octans-surface-subdued);
  cursor: grab;
  font-size: 13px;
}
.chip.chosen {
  background: var(--octans-primary-surface);
  color: var(--octans-text-primary);
}
.mini {
  border: 0;
  background: none;
  padding: 0;
  display: inline-flex;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
}
.mini:hover {
  opacity: 1;
}
</style>
