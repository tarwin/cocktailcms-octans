<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UI, { Button, Card, DataTable, Icon, Sheet, SkeletonBodyText, Tabs, type DataTableSortType } from '@octans/ui'
import { bus } from '@/core/bus'
import type { FileMeta } from '@/core/types'
import { ALLOWED_IMAGE_MIME_TYPES, deepCopy, downloadBlob, getFileTypeIcon, orderBy, prettyBytes } from '@/core/utils'
import { useApi } from '@/store'
import LibraryImageThumb from './LibraryImageThumb.vue'

const MAX_FILE_SIZE = 1024 * 500

type LibType = 'all' | 'image' | 'file'

const visible = ref(false)
const loading = ref(true)
const files = ref<FileMeta[]>([])
const selectedFile = ref<FileMeta | null>(null)
const isDragging = ref(false)
const uploading = ref(false)
const type = ref<LibType>('all')
const currentType = ref<'image' | 'file'>('image')
const sortBy = ref<DataTableSortType | undefined>(undefined)
const fileInput = ref<HTMLInputElement | null>(null)
let callback: ((file: FileMeta | null) => void) | null = null

watch(currentType, () => (selectedFile.value = null))

function show(cb: (file: FileMeta | null) => void, options: { type?: LibType; selectedId?: number | null } = {}) {
  callback = cb
  loading.value = true
  files.value = []
  selectedFile.value = null
  isDragging.value = false
  uploading.value = false
  type.value = options.type || 'all'
  currentType.value = type.value === 'file' ? 'file' : 'image'
  visible.value = true
  useApi()
    .getFiles(type.value)
    .then((list) => {
      files.value = list
      if (options.selectedId) selectedFile.value = list.find((f) => f.id === options.selectedId) || null
      loading.value = false
    })
}

bus.on('showLibrary', show)
defineExpose({ show })

function choose() {
  visible.value = false
  callback?.(selectedFile.value ? deepCopy(selectedFile.value) : null)
  callback = null
}

function close() {
  visible.value = false
  callback = null
}

async function deleteFile(file: FileMeta) {
  const ok = await UI.confirm({ title: 'Are you sure?', content: `Delete "${file.name}"?`, primaryActionType: 'destructive' })
  if (!ok) return
  if (selectedFile.value?.id === file.id) selectedFile.value = null
  await useApi().removeFile(file.id)
  files.value = files.value.filter((f) => f.id !== file.id)
}

async function downloadFile(file: FileMeta) {
  const blob = await useApi().getFileBlob(file.id)
  if (blob) downloadBlob(blob, file.name)
}

function isImage(mime: string) {
  return ALLOWED_IMAGE_MIME_TYPES.includes(mime)
}

async function uploadFiles(list: FileList | File[]) {
  const valid: File[] = []
  let tooBig = 0
  let badType = 0
  let allImages = true
  for (const f of Array.from(list)) {
    const img = isImage(f.type)
    if (!img) allImages = false
    if (type.value === 'image' && !img) {
      badType++
      continue
    }
    if (f.size > MAX_FILE_SIZE) {
      tooBig++
      continue
    }
    valid.push(f)
  }
  if (tooBig) UI.alert({ title: 'File too big', content: `Max file size is ${prettyBytes(MAX_FILE_SIZE)}.` })
  if (badType) UI.alert({ title: 'Invalid file type', content: 'Only images can be added here.' })
  if (!valid.length) return
  uploading.value = true
  try {
    const added = await useApi().uploadFiles(valid)
    files.value.push(...added)
    if (currentType.value === 'image' && !allImages) currentType.value = 'file'
    if (added.length === 1) selectedFile.value = added[0]
  } catch (e: any) {
    UI.alert({ title: 'Upload failed', content: e?.message })
  } finally {
    uploading.value = false
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (!uploading.value && e.dataTransfer?.files) uploadFiles(e.dataTransfer.files)
}

const onlyImages = computed(() => files.value.filter((f) => isImage(f.mimeType)))
const sortedFiles = computed(() => {
  if (!sortBy.value) return files.value
  const col = sortBy.value.column === 'icon' ? 'mimeType' : (sortBy.value.column as keyof FileMeta)
  return orderBy(files.value, col, sortBy.value.direction)
})
const heading = computed(() => (type.value === 'image' ? 'Image Library' : type.value === 'file' ? 'File Browser' : 'Images and Files'))
const columns = [
  { key: 'selected', label: '' , width: 40 },
  { key: 'icon', label: 'Type', sortable: true, width: 60 },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'size', label: 'Size', sortable: true, width: 90 },
  { key: 'dimensions', label: 'Dimensions', width: 120 },
]
</script>

<template>
  <Sheet
    :title="heading"
    :visible="visible"
    :size="760"
    :primary-action="callback ? { label: 'Choose', disabled: !selectedFile, onAction: choose } : undefined"
    @close="close"
  >
    <SkeletonBodyText v-if="loading" />
    <div v-else class="library" @dragover.prevent="!uploading && (isDragging = true)" @dragleave.prevent="isDragging = false" @drop.prevent="onDrop">
      <div v-if="isDragging" class="dropper">Drop {{ type === 'image' ? 'images' : 'files' }} …</div>
      <button type="button" class="upload" :disabled="uploading" @click="fileInput?.click()">
        <Icon icon="mdi:cloud-upload-outline" size="36px" />
        <div>
          <div class="upload-title">{{ uploading ? 'Uploading …' : `Upload ${type === 'image' ? 'Images' : 'Files'}` }}</div>
          <div class="muted">Or drag and drop. Max {{ prettyBytes(MAX_FILE_SIZE) }} per file.</div>
        </div>
        <input
          ref="fileInput"
          type="file"
          multiple
          style="display: none"
          :accept="type === 'image' ? ALLOWED_IMAGE_MIME_TYPES.join(',') : ''"
          @change="fileInput?.files && uploadFiles(fileInput.files); fileInput && (fileInput.value = '')"
        />
      </button>

      <Tabs
        v-if="type === 'all'"
        :selected="currentType"
        :tabs="[
          { value: 'image', label: 'Images' },
          { value: 'file', label: 'Files' },
        ]"
        @update:selected="(v) => (currentType = v as 'image' | 'file')"
      />

      <Card>
        <template v-if="currentType === 'image'">
          <div v-if="!onlyImages.length" class="empty muted">No images yet</div>
          <div v-else class="images">
            <LibraryImageThumb
              v-for="img in onlyImages"
              :key="img.id"
              :image="img"
              :selected="selectedFile"
              @select="(i) => (selectedFile = i)"
              @choose="(i) => { selectedFile = i; choose() }"
              @delete="deleteFile"
            />
          </div>
        </template>
        <template v-else>
          <div v-if="!files.length" class="empty muted">No files yet</div>
          <DataTable
            v-else
            :columns="columns"
            :rows="sortedFiles"
            :sort="sortBy"
            :row-actions="[
              { label: 'Download', icon: 'mdi:download', onAction: (row) => downloadFile(row as FileMeta) },
              { label: 'Delete', icon: 'mdi:delete-outline', onAction: (row) => deleteFile(row as FileMeta) },
            ]"
            @update:sort="(s: DataTableSortType) => (sortBy = s)"
            @click-row="(row: FileMeta) => (selectedFile = row)"
          >
            <template #col:selected="{ row }">
              <Icon v-if="selectedFile && selectedFile.id === row.id" icon="mdi:check-circle" />
            </template>
            <template #col:icon="{ row }">
              <Icon :icon="getFileTypeIcon(row.mimeType)" size="20px" />
            </template>
            <template #col:size="{ row }">{{ row.size ? prettyBytes(row.size) : '' }}</template>
            <template #col:dimensions="{ row }">
              <span v-if="row.width && row.height">{{ row.width }} &times; {{ row.height }}</span>
              <span v-else>&mdash;</span>
            </template>
          </DataTable>
        </template>
      </Card>
    </div>
  </Sheet>
</template>

<style scoped>
.library {
  position: relative;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 400px;
}
.dropper {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 200%;
  background: var(--octans-primary-surface);
  color: var(--octans-text-primary);
  border: 2px dashed var(--octans-primary);
  border-radius: var(--octans-radius, 6px);
  pointer-events: none;
}
.upload {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  width: 100%;
  text-align: left;
  border: 1px dashed var(--octans-border);
  border-radius: var(--octans-radius, 6px);
  background: var(--octans-surface-subdued);
  color: var(--octans-text);
  font: inherit;
  cursor: pointer;
}
.upload:hover {
  border-color: var(--octans-primary);
}
.upload-title {
  font-weight: 600;
}
.images {
  padding: 8px;
}
.empty {
  padding: 40px;
  text-align: center;
}
</style>
