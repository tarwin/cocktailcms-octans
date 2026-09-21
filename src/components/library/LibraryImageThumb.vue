<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Icon, Spinner } from '@octans/ui'
import type { FileMeta } from '@/core/types'
import { useApi } from '@/store'

const props = defineProps<{ image: FileMeta; selected: FileMeta | null }>()
const emit = defineEmits<{ select: [FileMeta]; choose: [FileMeta]; delete: [FileMeta] }>()

const loading = ref(true)
const url = ref('')

onMounted(async () => {
  url.value = props.image.thumbUrl || (await useApi().getImageDataUrl(props.image.id, true))
  loading.value = false
})
</script>

<template>
  <div
    class="thumb"
    :class="{ selected: selected?.id === image.id }"
    :style="{ backgroundImage: url ? `url(${url})` : undefined }"
    :title="image.name"
    @click="emit('select', image)"
    @dblclick="emit('choose', image)"
  >
    <Spinner v-if="loading" size="small" />
    <button class="delete" type="button" title="Delete" @click.stop="emit('delete', image)"><Icon icon="mdi:close" /></button>
    <div class="dims">{{ image.width }}&times;{{ image.height }}</div>
  </div>
</template>

<style scoped>
.thumb {
  width: 120px;
  height: 120px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 4px;
  border: 3px solid var(--octans-border);
  border-radius: var(--octans-radius, 6px);
  background-color: var(--octans-surface-subdued);
  background-size: cover;
  background-position: center;
  position: relative;
  cursor: pointer;
  overflow: hidden;
}
.thumb.selected {
  border-color: var(--octans-primary);
}
.thumb:hover .delete,
.thumb:hover .dims,
.thumb.selected .dims {
  display: flex;
}
.delete {
  display: none;
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: var(--octans-error);
  color: var(--octans-text-on-error);
  cursor: pointer;
  font: inherit;
}
.dims {
  display: none;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 3px;
  justify-content: center;
  font-size: 11px;
  background: var(--octans-surface);
  color: var(--octans-text);
  opacity: 0.9;
}
</style>
