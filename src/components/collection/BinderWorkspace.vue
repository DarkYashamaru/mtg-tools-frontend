<script setup lang="ts">
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
</script>

<template>
  <DeckSection
    title="Binder Inventory"
    :items="collection.items"
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
</template>
