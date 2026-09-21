<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Icon } from '@octans/ui'
import type { Field } from '@/core/types'
import { useApi } from '@/store'

const props = defineProps<{ value?: any; field: Field }>()
const url = ref('')
async function load() {
  url.value = ''
  if (props.value?.id) {
    try {
      url.value = await useApi().getImageDataUrl(props.value.id, true)
    } catch {
      /* ignore */
    }
  }
}
onMounted(load)
watch(() => props.value?.id, load)
</script>

<template>
  <span v-if="!value">&mdash;</span>
  <img v-else-if="url" :src="url" :alt="value.name" class="thumb" :title="value.name" />
  <Icon v-else icon="mdi:file-image-outline" size="20px" />
</template>

<style scoped>
.thumb {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
  vertical-align: middle;
  border: 1px solid var(--octans-border);
}
</style>
