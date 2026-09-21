<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@octans/ui'
import type { Field } from '@/core/types'

const props = defineProps<{ value?: any; field: Field }>()
const displayAs = computed(() => props.field?.params?.displayAs || 'rect')
</script>

<template>
  <span v-if="!value">&mdash;</span>
  <Badge v-else-if="displayAs === 'value'">{{ value }}</Badge>
  <span v-else class="swatch checker" :class="displayAs">
    <span class="color" :style="{ backgroundColor: value }"></span>
  </span>
</template>

<style scoped>
.swatch {
  display: inline-block;
  vertical-align: middle;
  border: 1px solid var(--octans-border);
  padding: 2px;
  overflow: hidden;
}
.swatch.rect {
  width: 44px;
  height: 24px;
  border-radius: 4px;
}
.swatch.circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
.color {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
}
</style>
