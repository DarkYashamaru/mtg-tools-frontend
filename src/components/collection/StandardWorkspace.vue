<script setup lang="ts">
import { computed } from 'vue'
import DeckSection from './DeckSection.vue'
import type { CollectionRecord, WorkspaceViewMode } from './types'

interface Props {
  collection: CollectionRecord
  viewMode: WorkspaceViewMode
}

const props = defineProps<Props>()

const mainboardItems = computed(() => props.collection.items.filter((item) => item.zone !== 'sideboard'))
const sideboardItems = computed(() => props.collection.items.filter((item) => item.zone === 'sideboard'))
</script>

<template>
  <div class="workspace-stack">
    <DeckSection title="Main Deck" :items="mainboardItems" :view-mode="viewMode" :group-by-category="true" />
    <DeckSection title="Sideboard" :items="sideboardItems" :view-mode="viewMode" :group-by-category="true" />
  </div>
</template>

<style scoped>
.workspace-stack {
  display: grid;
  gap: 18px;
}
</style>
