<script setup lang="ts">
import { Icon } from '@octans/ui'
import type { Field } from '@/core/types'
import { getFileTypeIcon } from '@/core/utils'

defineProps<{ value?: any; field: Field }>()
</script>

<template>
  <span v-if="!value">&mdash;</span>
  <span v-else class="file" :title="value.name"><Icon :icon="getFileTypeIcon(value.mimeType)" size="18px" /> {{ value.name }}</span>
</template>

<style scoped>
.file {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--octans-text-subdued);
}
</style>
