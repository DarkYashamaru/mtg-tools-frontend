<script setup lang="ts">
import { computed } from 'vue'
import BinderListView from './BinderListView.vue'
import DeckSection from './DeckSection.vue'
import type { CollectionRecord, WorkspaceViewMode } from './types'

interface Props {
  collection: CollectionRecord
  viewMode: WorkspaceViewMode
}

const props = defineProps<Props>()
const sortedItems = computed(() => [...props.collection.items].sort((a, b) => {
  const nameA = a.name ?? ''
  const nameB = b.name ?? ''
  return nameA.localeCompare(nameB)
}))
</script>

<template>
  <BinderListView v-if="viewMode === 'list'" :items="sortedItems" />
  <DeckSection v-else title="Binder Grid" :items="sortedItems" :view-mode="viewMode" :group-by-category="true" />
</template>
