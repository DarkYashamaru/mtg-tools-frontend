<script setup lang="ts">
import { computed } from 'vue'
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
  showScore?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  hoverItem: [item: CollectionItem | null]
  contextMenu: [payload: CollectionCardContextMenuPayload]
  incrementItem: [item: CollectionItem]
  decrementItem: [item: CollectionItem]
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
      :organization-mode="organizationMode"
      :hide-singleton-amount="true"
      :mutating-item-ids="mutatingItemIds"
      :show-quantity-actions="showQuantityActions"
      :show-score="showScore"
      @hover-item="emit('hoverItem', $event)"
      @context-menu="emit('contextMenu', $event)"
      @increment-item="emit('incrementItem', $event)"
      @decrement-item="emit('decrementItem', $event)"
    />
    <DeckSection
      title="Mainboard"
      :items="mainboardItems"
      :view-mode="viewMode"
      :organization-mode="organizationMode"
      :mutating-item-ids="mutatingItemIds"
      :show-quantity-actions="showQuantityActions"
      :show-score="showScore"
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
