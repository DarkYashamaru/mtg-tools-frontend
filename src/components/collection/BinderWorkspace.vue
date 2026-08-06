<script setup lang="ts">
import { computed } from 'vue'
import CollectionListSection from './CollectionListSection.vue'
import DeckSection from './DeckSection.vue'
import type { CollectionItem, CollectionRecord, WorkspaceViewMode } from './types'

interface Props {
  collection: CollectionRecord
  viewMode: WorkspaceViewMode
}

const props = defineProps<Props>()
const emit = defineEmits<{
  hoverItem: [item: CollectionItem | null]
}>()
const sortedItems = computed(() => [...props.collection.items].sort((a, b) => {
  const nameA = a.name ?? ''
  const nameB = b.name ?? ''
  return nameA.localeCompare(nameB)
}))
</script>

<template>
  <CollectionListSection
    v-if="viewMode === 'list'"
    title="Binder Inventory"
    empty-message="No cards in this binder."
    :items="sortedItems"
    @hover-item="emit('hoverItem', $event)"
  />
  <DeckSection v-else title="Binder Grid" :items="sortedItems" :view-mode="viewMode" :group-by-category="true" />
</template>
