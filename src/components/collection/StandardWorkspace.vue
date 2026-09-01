<script setup lang="ts">
import { computed } from 'vue'
import DeckSection from './DeckSection.vue'
import type {
  CollectionCardContextMenuPayload,
  CollectionItem,
  CollectionProfileSection,
  CollectionRecord,
  WorkspaceOrganizationMode,
  WorkspaceViewMode,
} from './types'

interface Props {
  collection: CollectionRecord
  viewMode: WorkspaceViewMode
  organizationMode: WorkspaceOrganizationMode
  profileSections?: CollectionProfileSection[]
  mutatingItemIds: Array<string | number>
  showQuantityActions?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  hoverItem: [item: CollectionItem | null]
  contextMenu: [payload: CollectionCardContextMenuPayload]
  incrementItem: [item: CollectionItem]
  decrementItem: [item: CollectionItem]
}>()

const mainboardItems = computed(() => props.collection.items.filter((item) => item.zone !== 'sideboard'))
const sideboardItems = computed(() => props.collection.items.filter((item) => item.zone === 'sideboard'))
const hasSideboard = computed(() => sideboardItems.value.length > 0)
</script>

<template>
  <div class="workspace-stack">
    <DeckSection
      title="Main Deck"
      :items="mainboardItems"
      :view-mode="viewMode"
      :organization-mode="organizationMode"
      :profile-sections="profileSections"
      :mutating-item-ids="mutatingItemIds"
      :show-quantity-actions="showQuantityActions"
      @hover-item="emit('hoverItem', $event)"
      @context-menu="emit('contextMenu', $event)"
      @increment-item="emit('incrementItem', $event)"
      @decrement-item="emit('decrementItem', $event)"
    />
    <DeckSection
      v-if="hasSideboard"
      title="Sideboard"
      :items="sideboardItems"
      :view-mode="viewMode"
      :organization-mode="organizationMode"
      :profile-sections="profileSections"
      :mutating-item-ids="mutatingItemIds"
      :show-quantity-actions="showQuantityActions"
      @hover-item="emit('hoverItem', $event)"
      @context-menu="emit('contextMenu', $event)"
      @increment-item="emit('incrementItem', $event)"
      @decrement-item="emit('decrementItem', $event)"
    />
  </div>
</template>

<style scoped>
.workspace-stack {
  display: grid;
  gap: 18px;
}
</style>
