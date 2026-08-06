<script setup lang="ts">
import { computed } from 'vue'
import type { CollectionItem } from './types'

interface Props {
  title: string
  emptyMessage?: string
  items: CollectionItem[]
}

const props = withDefaults(defineProps<Props>(), {
  emptyMessage: 'No cards in this section.',
})
const emit = defineEmits<{
  hoverItem: [item: CollectionItem | null]
}>()
const totalCards = computed(() => props.items.reduce((sum, item) => sum + item.amount, 0))

function handleItemEnter(item: CollectionItem) {
  emit('hoverItem', item)
}

function clearHover() {
  emit('hoverItem', null)
}
</script>

<template>
  <section class="list-section-shell">
    <header class="section-header">
      <div>
        <h2>{{ title }}</h2>
        <p>{{ totalCards }} cards</p>
      </div>
    </header>

    <div v-if="items.length === 0" class="empty-section">
      {{ emptyMessage }}
    </div>

    <div v-else class="list-layout">
      <div class="table-wrap" @mouseleave="clearHover()">
        <div class="table-head">
          <span>Qty</span>
          <span>Card</span>
          <span>Set</span>
          <span>No.</span>
          <span>Lang</span>
        </div>

        <div class="table-body">
          <div
            v-for="item in items"
            :key="item.id"
            class="table-row"
            tabindex="0"
            @mouseenter="handleItemEnter(item)"
            @focus="handleItemEnter(item)"
            @blur="clearHover()"
          >
            <span class="qty">{{ item.amount }}x</span>
            <strong class="name-text">{{ item.name || 'Unknown Card' }}</strong>
            <span>{{ item.set_code || '—' }}</span>
            <span>{{ item.collector_number || '—' }}</span>
            <span>{{ item.lang || '—' }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.list-section-shell {
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

.empty-section {
  padding: 18px;
  border-radius: 16px;
  border: 1px dashed var(--surface-border-light);
  color: var(--text-muted);
}

.table-wrap {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--surface-border-light);
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
  cursor: pointer;
}

.table-row:hover,
.table-row:focus-visible {
  background: var(--surface-hover);
  outline: none;
}

.qty {
  color: var(--accent-electric);
  font-weight: 800;
}

.name-text {
  color: var(--text-light);
  font-weight: 700;
}

.table-row:hover .name-text,
.table-row:focus-visible .name-text {
  color: var(--accent-electric);
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
