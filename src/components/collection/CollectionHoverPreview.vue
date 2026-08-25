<script setup lang="ts">
import CardFaceViewer from '@/components/cards/CardFaceViewer.vue'
import type { CollectionItem } from './types'

interface Props {
  item: CollectionItem | null
}

defineProps<Props>()
</script>

<template>
  <aside class="preview-panel">
    <div v-if="item?.gameplay_card || item?.image_uri" class="preview-card">
      <CardFaceViewer
        :card="item.gameplay_card"
        :preview-image-url="item.gameplay_card ? null : item.image_uri"
        :fallback-name="item.name"
        image-size="normal"
        :show-flip-control="true"
        :interactive="true"
      />

      <div class="preview-copy">
        <strong>{{ item.name }}</strong>
        <p>{{ item.set_code || '—' }} · {{ item.collector_number || '—' }}</p>
        <p>{{ item.lang || '—' }} · {{ item.amount }}x</p>
      </div>
    </div>

    <div v-else class="preview-empty">
      Hover any card row to preview its print image.
    </div>
  </aside>
</template>

<style scoped>
.preview-panel {
  position: sticky;
  top: 20px;
  align-self: start;
}

.preview-card {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.86);
  box-shadow: var(--shadow-md);
}

.preview-card :deep(img),
.preview-card :deep(.face-fallback) {
  display: block;
  width: 100%;
  aspect-ratio: 0.71 / 1;
}

.preview-copy {
  padding: 14px;
}

.preview-copy strong {
  color: var(--text-light);
}

.preview-copy p {
  margin: 6px 0 0;
  color: var(--text-muted);
}

.preview-empty {
  padding: 18px;
  border-radius: 16px;
  border: 1px dashed var(--surface-border-light);
  color: var(--text-muted);
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.04), rgba(15, 23, 42, 0.98)),
    var(--surface-card);
}

@media (max-width: 980px) {
  .preview-panel {
    position: static;
  }
}
</style>
