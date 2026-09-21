<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/core/markdown'

const props = defineProps<{ source?: string | null }>()
const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <div class="markdown" v-html="html"></div>
</template>
