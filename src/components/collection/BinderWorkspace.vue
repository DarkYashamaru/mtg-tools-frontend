<script setup lang="ts">
import { computed } from 'vue'
import CollectionListSection from './CollectionListSection.vue'
import DeckSection from './DeckSection.vue'
import type {
  CollectionCardContextMenuPayload,
  CollectionItem,
  CollectionRecord,
  WorkspaceOrganizationMode,
  WorkspaceViewMode,
} from './types'

interface Props {
  collection: CollectionRecord
  viewMode: WorkspaceViewMode
  organizationMode: WorkspaceOrganizationMode
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
const sortedItems = computed(() => [...props.collection.items].sort((a, b) => {
  const nameA = a.name ?? ''
  const nameB = b.name ?? ''
  return nameA.localeCompare(nameB)
}))
</script>

<template>
  <CollectionListSection
    v-if="viewMode === 'list'"
    :title="organizationMode === 'category' ? 'Binder Inventory' : 'Mainboard'"
    empty-message="No cards in this binder."
    :items="sortedItems"
    :mutating-item-ids="mutatingItemIds"
    :show-quantity-actions="showQuantityActions"
    @hover-item="emit('hoverItem', $event)"
    @context-menu="emit('contextMenu', $event)"
    @increment-item="emit('incrementItem', $event)"
    @decrement-item="emit('decrementItem', $event)"
  />
  <DeckSection
    v-else
    :title="organizationMode === 'category' ? 'Binder Grid' : 'Mainboard'"
    :items="sortedItems"
    :view-mode="viewMode"
    :organization-mode="organizationMode"
    :mutating-item-ids="mutatingItemIds"
    :show-quantity-actions="showQuantityActions"
    @context-menu="emit('contextMenu', $event)"
    @increment-item="emit('incrementItem', $event)"
    @decrement-item="emit('decrementItem', $event)"
  />
</template>
