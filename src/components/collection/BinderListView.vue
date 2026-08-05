<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CollectionItem } from './types'
import CardFaceViewer from '@/components/cards/CardFaceViewer.vue'
import { groupCollectionItemsByCategory } from './grouping'

interface Props {
  items: CollectionItem[]
}

const props = defineProps<Props>()
const hoveredCardId = ref<number | null>(null)

const hoveredItem = computed(() => props.items.find((item) => item.id === hoveredCardId.value) ?? null)
const categoryGroups = computed(() => groupCollectionItemsByCategory(props.items))
</script>

<template>
  <section class="binder-list-shell">
    <header class="section-header">
      <div>
        <h2>Binder Inventory</h2>
        <p>{{ items.length }} unique print entries</p>
      </div>
    </header>

    <div v-if="items.length === 0" class="empty-section">
      No cards in this binder.
    </div>

    <div v-else class="binder-layout">
      <div class="category-stack">
        <section v-for="group in categoryGroups" :key="group.name" class="table-wrap">
          <header class="category-header">
            <h3>{{ group.name }}</h3>
            <p>{{ group.totalCards }} cards</p>
          </header>

          <div class="table-head">
            <span>Qty</span>
            <span>Card</span>
            <span>Set</span>
            <span>No.</span>
            <span>Lang</span>
          </div>

          <div class="table-body">
            <div
              v-for="item in group.items"
              :key="`${group.name}-${item.id}`"
              class="table-row"
            >
              <span class="qty">{{ item.amount }}x</span>
              <button
                class="name-button"
                type="button"
                @mouseenter="hoveredCardId = item.id"
                @mouseleave="hoveredCardId = hoveredCardId === item.id ? null : hoveredCardId"
                @focus="hoveredCardId = item.id"
                @blur="hoveredCardId = hoveredCardId === item.id ? null : hoveredCardId"
              >
                {{ item.name || 'Unknown Card' }}
              </button>
              <span>{{ item.set_code }}</span>
              <span>{{ item.collector_number }}</span>
              <span>{{ item.lang || '—' }}</span>
            </div>
          </div>
        </section>
      </div>

      <aside class="preview-pane">
        <div v-if="hoveredItem?.image_uri" class="preview-card">
          <CardFaceViewer
            :preview-image-url="hoveredItem.image_uri"
            :fallback-name="hoveredItem.name"
            image-size="normal"
          />
          <div class="preview-copy">
            <strong>{{ hoveredItem.name }}</strong>
            <p>{{ hoveredItem.set_code }} · {{ hoveredItem.collector_number }}</p>
          </div>
        </div>

        <div v-else class="preview-empty">
          Hover a card name to preview its print image.
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.binder-list-shell {
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid var(--surface-border-light);
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.04), rgba(15, 23, 42, 0.98)),
    var(--surface-card);
}

.section-header h2 {
  margin: 0;
  color: var(--text-light);
  font-size: 1.25rem;
}

.section-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.empty-section,
.preview-empty {
  padding: 18px;
  border-radius: 16px;
  border: 1px dashed var(--surface-border-light);
  color: var(--text-muted);
}

.binder-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 280px;
  gap: 18px;
}

.category-stack {
  display: grid;
  gap: 18px;
}

.table-wrap {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--surface-border-light);
}

.category-header {
  padding: 14px 16px 0;
}

.category-header h3 {
  margin: 0;
  color: var(--text-light);
  font-size: 1rem;
}

.category-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 0.84rem;
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: 90px minmax(0, 1.8fr) 100px 90px 90px;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
}

.table-head {
  background: rgba(15, 23, 42, 0.92);
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.table-body {
  display: grid;
}

.table-row {
  border-top: 1px solid rgba(148, 163, 184, 0.08);
  background: rgba(17, 24, 39, 0.84);
  color: var(--text-main);
}

.table-row:hover {
  background: var(--surface-hover);
}

.qty {
  color: var(--accent-electric);
  font-weight: 800;
}

.name-button {
  width: fit-content;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-light);
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.name-button:hover,
.name-button:focus-visible {
  color: var(--accent-electric);
  outline: none;
}

.preview-pane {
  position: sticky;
  top: 96px;
  height: fit-content;
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

@media (max-width: 980px) {
  .binder-layout {
    grid-template-columns: 1fr;
  }

  .preview-pane {
    position: static;
  }
}

@media (max-width: 760px) {
  .table-head,
  .table-row {
    grid-template-columns: 72px minmax(0, 1fr) 72px;
  }

  .table-head span:nth-child(4),
  .table-head span:nth-child(5),
  .table-row span:nth-child(4),
  .table-row span:nth-child(5) {
    display: none;
  }
}
</style>
