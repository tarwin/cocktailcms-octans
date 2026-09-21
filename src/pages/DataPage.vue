<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DataList from '@/components/data/DataList.vue'

const route = useRoute()
const schemaId = computed(() => parseInt(String(route.params.id), 10))
</script>

<template>
  <DataList v-if="schemaId" :key="schemaId" :schema-id="schemaId" />
</template>
