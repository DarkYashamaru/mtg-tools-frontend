<script setup lang="ts">
import { computed } from 'vue'
import CardImageTile from './CardImageTile.vue'
import type { CollectionItem, WorkspaceViewMode } from './types'
import { groupCollectionItemsByCategory } from './grouping'

interface Props {
  title: string
  items: CollectionItem[]
  viewMode: WorkspaceViewMode
  groupByCategory?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  groupByCategory: false,
})
const totalCards = computed(() => props.items.reduce((sum, item) => sum + item.amount, 0))
const categoryGroups = computed(() => (
  props.groupByCategory ? groupCollectionItemsByCategory(props.items) : []
))
</script>

<template>
  <section class="deck-section">
    <header class="section-header">
      <div>
        <h2>{{ title }}</h2>
        <p>{{ totalCards }} cards</p>
      </div>
    </header>

    <div v-if="items.length === 0" class="empty-section">
      No cards in this section.
    </div>

    <div v-else-if="groupByCategory && categoryGroups.length" class="category-stack">
      <section v-for="group in categoryGroups" :key="group.name" class="category-block">
        <header class="category-header">
          <h3>{{ group.name }}</h3>
          <p>{{ group.totalCards }} cards</p>
        </header>

        <div v-if="viewMode === 'grid'" class="grid-layout">
          <CardImageTile v-for="item in group.items" :key="`${group.name}-${item.id}`" :item="item" />
        </div>

        <div v-else class="list-layout">
          <div v-for="item in group.items" :key="`${group.name}-${item.id}`" class="list-row">
            <span class="qty">{{ item.amount }}x</span>
            <strong>{{ item.name }}</strong>
            <span>{{ item.set_code }}</span>
            <span>{{ item.collector_number }}</span>
          </div>
        </div>
      </section>
    </div>

    <div v-else-if="viewMode === 'grid'" class="grid-layout">
      <CardImageTile v-for="item in items" :key="item.id" :item="item" />
    </div>

    <div v-else class="list-layout">
      <div v-for="item in items" :key="item.id" class="list-row">
        <span class="qty">{{ item.amount }}x</span>
        <strong>{{ item.name }}</strong>
        <span>{{ item.set_code }}</span>
        <span>{{ item.collector_number }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.deck-section {
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

.grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}

.category-stack {
  display: grid;
  gap: 22px;
}

.category-block {
  display: grid;
  gap: 14px;
}

.category-header h3 {
  margin: 0;
  color: var(--text-light);
  font-size: 1.05rem;
}

.category-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 0.86rem;
}

.list-layout {
  display: grid;
  gap: 10px;
}

.list-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1.8fr) 100px 110px;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--surface-hover);
  color: var(--text-main);
}

.qty {
  color: var(--accent-electric);
  font-weight: 800;
}

@media (max-width: 760px) {
  .list-row {
    grid-template-columns: 80px 1fr;
  }
}
</style>
