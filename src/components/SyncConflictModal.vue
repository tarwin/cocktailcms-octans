<script setup lang="ts">
import { ref } from 'vue'
import dayjs from 'dayjs'
import { Modal, ModalSection, TextContainer, Stack, Button } from '@octans/ui'
import type { SyncDirection } from '@/sync/SyncManager'

const visible = ref(false)
const localTime = ref(0)
const remoteTime = ref(0)
let cb: ((d: SyncDirection) => void) | null = null

function show(local: number, remote: number, callback: (d: SyncDirection) => void) {
  localTime.value = local
  remoteTime.value = remote
  cb = callback
  visible.value = true
}

function choose(direction: SyncDirection) {
  visible.value = false
  cb?.(direction)
  cb = null
}

function niceDate(t: number) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : 'Never'
}

defineExpose({ show })
</script>

<template>
  <Modal title="Sync Options" :visible="visible">
    <ModalSection>
      <TextContainer>
        <p>Your data is out of sync. You can copy your local data to the cloud, or replace it with the cloud copy. Please choose carefully.</p>
        <p><b>Local:</b> last updated {{ niceDate(localTime) }}</p>
        <p><b>Remote:</b> last updated {{ niceDate(remoteTime) }}</p>
      </TextContainer>
    </ModalSection>
    <ModalSection>
      <Stack>
        <Button :type="localTime >= remoteTime ? 'primary' : 'destructive'" @click="choose('localToRemote')">Local &rArr; Remote</Button>
        <Button :type="remoteTime >= localTime ? 'primary' : 'destructive'" @click="choose('remoteToLocal')">Remote &rArr; Local</Button>
      </Stack>
    </ModalSection>
  </Modal>
</template>
