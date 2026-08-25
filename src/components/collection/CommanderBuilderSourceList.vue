<script setup lang="ts">
import { computed } from 'vue'
import type { CollectionCardContextMenuPayload, CollectionItem } from './types'

interface Props {
  title: string
  eyebrow?: string
  description?: string
  items: CollectionItem[]
  primaryActionDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  eyebrow: '',
  description: '',
  primaryActionDisabled: false,
})
const emit = defineEmits<{
  hoverItem: [item: CollectionItem | null]
  contextMenu: [payload: CollectionCardContextMenuPayload]
  cardClick: [item: CollectionItem]
  primaryAction: [item: CollectionItem]
}>()
const totalCards = computed(() => props.items.reduce((sum, item) => sum + item.amount, 0))

function formatScore(item: CollectionItem) {
  return item.commander_support_score ?? '—'
}

function openContextMenu(event: MouseEvent, item: CollectionItem) {
  emit('contextMenu', { item, x: event.clientX, y: event.clientY })
}
</script>

<template>
  <section class="source-list-shell">
    <header class="source-list-header">
      <p v-if="eyebrow" class="source-list-eyebrow">{{ eyebrow }}</p>
      <h2>{{ title }}</h2>
      <p>{{ totalCards }} cards<span v-if="description"> · {{ description }}</span></p>
    </header>

    <div v-if="items.length === 0" class="empty-list">No cards in this section.</div>

    <div v-else class="table-wrap" @mouseleave="emit('hoverItem', null)">
      <div class="table-head">
        <span>Score</span>
        <span>Card</span>
        <span>Add</span>
      </div>
      <div class="table-body">
        <div
          v-for="item in items"
          :key="item.id"
          class="table-row"
          tabindex="0"
          @mouseenter="emit('hoverItem', item)"
          @focus="emit('hoverItem', item)"
          @blur="emit('hoverItem', null)"
          @click="emit('cardClick', item)"
          @contextmenu.prevent="openContextMenu($event, item)"
        >
          <strong class="score-value">{{ formatScore(item) }}</strong>
          <strong class="card-name">{{ item.name || 'Unknown Card' }}</strong>
          <button
            class="add-button"
            type="button"
            :disabled="primaryActionDisabled"
            @click.stop="emit('primaryAction', item)"
          >
            Add to Deck
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.source-list-shell {
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid var(--surface-border-light);
  background: linear-gradient(180deg, rgba(148, 163, 184, 0.04), rgba(15, 23, 42, 0.98)), var(--surface-card);
}

.source-list-header h2 {
  margin: 0;
  color: var(--text-light);
  font-size: 1.25rem;
}

.source-list-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.source-list-eyebrow {
  margin: 0 0 6px !important;
  color: var(--accent-electric) !important;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.empty-list {
  padding: 18px;
  border: 1px dashed var(--surface-border-light);
  border-radius: 16px;
  color: var(--text-muted);
}

.table-wrap {
  overflow: hidden;
  border: 1px solid var(--surface-border-light);
  border-radius: 18px;
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) 120px;
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

.table-row {
  border-top: 1px solid rgba(148, 163, 184, 0.08);
  background: rgba(17, 24, 39, 0.84);
  cursor: pointer;
}

.table-row:hover,
.table-row:focus-visible {
  background: var(--surface-hover);
  outline: none;
}

.score-value { color: var(--accent-electric); }
.card-name { overflow: hidden; color: var(--text-light); text-overflow: ellipsis; white-space: nowrap; }

.add-button {
  padding: 8px 10px;
  border: 1px solid var(--accent-electric-border);
  border-radius: 8px;
  background: var(--accent-electric-dim);
  color: var(--accent-electric);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.add-button:hover:not(:disabled) { background: rgba(56, 189, 248, 0.18); }
.add-button:disabled { cursor: not-allowed; opacity: 0.55; }

@media (max-width: 640px) {
  .table-head,
  .table-row { grid-template-columns: 64px minmax(0, 1fr) 106px; }
}
</style>
