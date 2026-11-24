<script setup lang="ts">
import { Card, CardSection, SegmentedControl } from '@octans/ui'
import { SHEET_SPEEDS, setSheetSpeed, sheetSpeed, type SheetSpeed } from '@/core/sheetSpeed'

const options = (Object.keys(SHEET_SPEEDS) as SheetSpeed[]).map((value) => ({ value, label: SHEET_SPEEDS[value].label }))
</script>

<template>
  <Card title="Sheet animation">
    <CardSection>
      <SegmentedControl
        label="Speed"
        help-text="How quickly side sheets slide in and out. Saved for this browser only."
        :options="options"
        :model-value="sheetSpeed"
        @update:model-value="setSheetSpeed"
      />
    </CardSection>
  </Card>
</template>
