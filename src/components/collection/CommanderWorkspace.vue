<script setup lang="ts">
import { computed } from 'vue'
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

const commanderItems = computed(() => props.collection.items.filter((item) => item.zone === 'commander'))
const mainboardItems = computed(() => props.collection.items.filter((item) => item.zone !== 'commander'))
</script>

<template>
  <div class="workspace-stack">
    <DeckSection
      title="Commander"
      :items="commanderItems"
      :view-mode="viewMode"
      :group-by-category="true"
      @hover-item="emit('hoverItem', $event)"
    />
    <DeckSection
      title="Deck Cards"
      :items="mainboardItems"
      :view-mode="viewMode"
      :group-by-category="true"
      @hover-item="emit('hoverItem', $event)"
    />
  </div>
</template>

<style scoped>
.workspace-stack {
  display: grid;
  gap: 18px;
}
</style>
