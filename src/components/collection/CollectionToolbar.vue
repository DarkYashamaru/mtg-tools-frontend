<script setup lang="ts">
import { computed } from 'vue'
import CollectionToolbarAddCard from './CollectionToolbarAddCard.vue'
import CollectionToolbarFilters from './CollectionToolbarFilters.vue'
import CollectionToolbarViewOptions from './CollectionToolbarViewOptions.vue'
import type {
  CollectionCardSearchResult,
  CollectionSortDirection,
  CollectionSortKey,
  CommanderWorkspaceMode,
  CollectionRecord,
  WorkspaceOrganizationMode,
  WorkspaceViewMode,
} from './types'

interface Props {
  collection: CollectionRecord
  modelValue: WorkspaceViewMode
  commanderWorkspaceMode?: CommanderWorkspaceMode
  organizationMode: WorkspaceOrganizationMode
  sortKey: CollectionSortKey
  sortDirection: CollectionSortDirection
  showScoreSort?: boolean
  filterText: string
  colorFilters?: string[]
  cardColors?: string[]
  cardColorMode?: 'exact' | 'including' | 'at-most'
  supertypeFilters?: string[]
  cardTypeFilters?: string[]
  subtypeFilters?: string[]
  supertypeOptions?: string[]
  cardTypeOptions?: string[]
  subtypeOptions?: string[]
  addCardQuery: string
  addCardSuggestions: CollectionCardSearchResult[]
  addCardLoading: boolean
  addCardDisabled?: boolean
  showBasicLandAdjust?: boolean
  basicLandAdjustDisabled?: boolean
  showStorePriceRefresh?: boolean
  storePriceRefreshDisabled?: boolean
  storePriceRefreshLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  addCardDisabled: false,
  showScoreSort: false,
  showBasicLandAdjust: false,
  basicLandAdjustDisabled: false,
  showStorePriceRefresh: false,
  storePriceRefreshDisabled: false,
  storePriceRefreshLabel: 'Refresh store prices',
  commanderWorkspaceMode: 'normal',
})

const emit = defineEmits<{
  'update:modelValue': [value: WorkspaceViewMode]
  'update:commanderWorkspaceMode': [value: CommanderWorkspaceMode]
  'update:organizationMode': [value: WorkspaceOrganizationMode]
  'update:sortKey': [value: CollectionSortKey]
  'update:sortDirection': [value: CollectionSortDirection]
  'update:filterText': [value: string]
  'update:colorFilters': [value: string[]]
  'update:cardColors': [value: string[]]
  'update:cardColorMode': [value: 'exact' | 'including' | 'at-most']
  'update:supertypeFilters': [value: string[]]
  'update:cardTypeFilters': [value: string[]]
  'update:subtypeFilters': [value: string[]]
  'update:addCardQuery': [value: string]
  selectAddCardSuggestion: [value: CollectionCardSearchResult]
  dismissAddCardSuggestions: []
  adjustBasicLands: []
  refreshStorePrices: []
}>()

const deckType = computed(() =>
  props.collection.deck_type.toLowerCase(),
)

const isReadOnly = computed(() =>
  props.collection.is_read_only === true,
)
</script>

<template>
  <section class="toolbar">
    <div class="toolbar-primary">
      <CollectionToolbarAddCard
        :model-value="addCardQuery"
        :suggestions="addCardSuggestions"
        :loading="addCardLoading"
        :disabled="addCardDisabled"
        :read-only="isReadOnly"
        @update:model-value="
          emit('update:addCardQuery', $event)
        "
        @select="
          emit('selectAddCardSuggestion', $event)
        "
        @dismiss="
          emit('dismissAddCardSuggestions')
        "
      />

      <CollectionToolbarFilters
        :model-value="filterText"
        :color-filters="colorFilters"
        :card-colors="cardColors"
        :card-color-mode="cardColorMode"
        :supertype-filters="supertypeFilters"
        :card-type-filters="cardTypeFilters"
        :subtype-filters="subtypeFilters"
        :supertype-options="supertypeOptions"
        :card-type-options="cardTypeOptions"
        :subtype-options="subtypeOptions"
        @update:model-value="
          emit('update:filterText', $event)
        "
        @update:card-colors="emit('update:cardColors', $event)"
        @update:card-color-mode="emit('update:cardColorMode', $event)"
        @update:color-filters="
          emit('update:colorFilters', $event)
        "
        @update:supertype-filters="
          emit('update:supertypeFilters', $event)
        "
        @update:card-type-filters="
          emit('update:cardTypeFilters', $event)
        "
        @update:subtype-filters="
          emit('update:subtypeFilters', $event)
        "
      />
    </div>

    <div class="toolbar-secondary">
      <CollectionToolbarViewOptions
        :model-value="modelValue"
        :commander-workspace-mode="commanderWorkspaceMode"
        :organization-mode="organizationMode"
        :sort-key="sortKey"
        :sort-direction="sortDirection"
        :show-score-sort="showScoreSort"
        :deck-type="deckType"
        :read-only="isReadOnly"
        :show-basic-land-adjust="showBasicLandAdjust"
        :basic-land-adjust-disabled="basicLandAdjustDisabled"
        :show-store-price-refresh="showStorePriceRefresh"
        :store-price-refresh-disabled="storePriceRefreshDisabled"
        :store-price-refresh-label="storePriceRefreshLabel"
        @update:model-value="
          emit('update:modelValue', $event)
        "
        @update:commander-workspace-mode="
          emit('update:commanderWorkspaceMode', $event)
        "
        @update:organization-mode="
          emit('update:organizationMode', $event)
        "
        @update:sort-key="
          emit('update:sortKey', $event)
        "
        @update:sort-direction="
          emit('update:sortDirection', $event)
        "
        @adjust-basic-lands="
          emit('adjustBasicLands')
        "
        @refresh-store-prices="
          emit('refreshStorePrices')
        "
      />
    </div>
  </section>
</template>

<style scoped>
.toolbar {
  display: grid;
  overflow: visible;
  border: 1px solid var(--surface-border-light);
  border-radius: 18px;
  background: rgba(17, 24, 39, 0.94);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(14px);
}

.toolbar-primary {
  display: grid;
  grid-template-columns:
    minmax(280px, 0.9fr)
    minmax(420px, 1.5fr);
  gap: 18px;
  align-items: start;
  padding: 16px;
}

.toolbar-secondary {
  padding: 12px 16px 14px;
  border-top: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.22);
  border-radius: 0 0 18px 18px;
}

@media (max-width: 980px) {
  .toolbar-primary {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .toolbar {
    border-radius: 14px;
  }

  .toolbar-primary {
    padding: 12px;
  }

  .toolbar-secondary {
    padding: 12px;
    border-radius: 0 0 14px 14px;
  }
}
</style>