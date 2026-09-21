<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@octans/ui'
import type { Field } from '@/core/types'
import { toIconName } from '@/core/utils'

const props = defineProps<{ value?: any; field: Field }>()
const p = computed(() => props.field.params || {})
const on = computed(() => !!props.value)
</script>

<template>
  <span v-if="p.displayAs === 'icon'" :style="{ color: on ? p.iconTrueColor : p.iconFalseColor }">
    <Icon :icon="toIconName(on ? p.iconTrue || 'mdi:toggle-switch' : p.iconFalse || 'mdi:toggle-switch-off-outline')" size="20px" />
  </span>
  <span v-else>{{ on ? p.trueDisplay || 'True' : p.falseDisplay || 'False' }}</span>
</template>
