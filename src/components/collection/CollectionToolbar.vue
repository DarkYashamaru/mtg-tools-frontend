<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { COLOR_FILTER_OPTIONS } from './filtering'
import type {
  CollectionCardSearchResult,
  CollectionSortDirection,
  CollectionSortKey,
  CommanderWorkspaceMode,
  CollectionRecord,
  WorkspaceOrganizationMode,
  WorkspaceViewMode,
} from './types'
import { naturalCollectionSortDirection } from './sorting'

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
  'update:supertypeFilters': [value: string[]]
  'update:cardTypeFilters': [value: string[]]
  'update:subtypeFilters': [value: string[]]
  'update:addCardQuery': [value: string]
  selectAddCardSuggestion: [value: CollectionCardSearchResult]
  dismissAddCardSuggestions: []
  adjustBasicLands: []
  refreshStorePrices: []
}>()

const lowerDeckType = computed(() => props.collection.deck_type.toLowerCase())
const isReadOnly = computed(() => props.collection.is_read_only === true)
const canUseGrid = computed(() => true)
const canUseList = computed(() => true)
const activeSuggestionIndex = ref(-1)
const openFacet = ref<string | null>(null)
const shouldShowSuggestions = computed(() => (
  props.addCardQuery.trim().length >= 3 && (props.addCardLoading || props.addCardSuggestions.length > 0)
))
const hasFacetFilters = computed(() => (
(props.colorFilters ?? []).length > 0
  || (props.supertypeFilters ?? []).length > 0
  || (props.cardTypeFilters ?? []).length > 0
  || (props.subtypeFilters ?? []).length > 0
))
const showFacetFilters = computed(() => (
  props.colorFilters !== undefined
  && props.supertypeFilters !== undefined
  && props.cardTypeFilters !== undefined
  && props.subtypeFilters !== undefined
))
const shouldShowEmptyState = computed(() => (
  props.addCardQuery.trim().length >= 3 && !props.addCardLoading && props.addCardSuggestions.length === 0
))

function setViewMode(value: WorkspaceViewMode) {
  emit('update:modelValue', value)
}

function setCommanderWorkspaceMode(value: CommanderWorkspaceMode) {
  emit('update:commanderWorkspaceMode', value)
}

function setOrganizationMode(value: WorkspaceOrganizationMode) {
  emit('update:organizationMode', value)
}

const sortDirectionLabel = computed(() => {
  if (props.sortKey === 'name') {
    return props.sortDirection === 'asc' ? 'A → Z' : 'Z → A'
  }
  if (props.sortKey === 'mana-value') {
    return props.sortDirection === 'asc' ? 'Low → High' : 'High → Low'
  }
  return props.sortDirection === 'asc' ? 'Low → High' : 'High → Low'
})

function setSortKey(event: Event) {
  const target = event.target as HTMLSelectElement
  const key = target.value as CollectionSortKey
  emit('update:sortKey', key)
  emit('update:sortDirection', naturalCollectionSortDirection(key))
}

function toggleSortDirection() {
  emit('update:sortDirection', props.sortDirection === 'asc' ? 'desc' : 'asc')
}

function toggleFilter(values: string[] | undefined, value: string): string[] {
  const current = values ?? []
  return current.includes(value)
    ? current.filter((candidate) => candidate !== value)
    : [...current, value]
}

function toggleColorFilter(value: string) {
  const current = props.colorFilters ?? []

  if (value === 'colorless') {
    emit('update:colorFilters', current.includes(value) ? [] : [value])
    return
  }

  emit('update:colorFilters', toggleFilter(current.filter((color) => color !== 'colorless'), value))
}

function toggleFacetDropdown(facet: string) {
  openFacet.value = openFacet.value === facet ? null : facet
}

function closeFacetDropdown(event?: Event) {
  const target = event?.target
  if (target instanceof Element && target.closest('.facet-dropdown')) {
    return
  }
  openFacet.value = null
}

function handleFacetKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    openFacet.value = null
  }
}

function clearFacetFilters() {
  emit('update:colorFilters', [])
  emit('update:supertypeFilters', [])
  emit('update:cardTypeFilters', [])
  emit('update:subtypeFilters', [])
}

function selectSuggestion(suggestion: CollectionCardSearchResult) {
  emit('selectAddCardSuggestion', suggestion)
}

function handleAddCardKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('dismissAddCardSuggestions')
    activeSuggestionIndex.value = -1
    return
  }

  if (props.addCardSuggestions.length === 0) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeSuggestionIndex.value = (activeSuggestionIndex.value + 1) % props.addCardSuggestions.length
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeSuggestionIndex.value = activeSuggestionIndex.value <= 0
      ? props.addCardSuggestions.length - 1
      : activeSuggestionIndex.value - 1
    return
  }

  if (event.key === 'Enter' && activeSuggestionIndex.value >= 0) {
    event.preventDefault()
    selectSuggestion(props.addCardSuggestions[activeSuggestionIndex.value])
  }
}

watch(
  () => props.addCardSuggestions,
  (suggestions) => {
    activeSuggestionIndex.value = suggestions.length > 0 ? 0 : -1
  },
  { deep: true }
)

onMounted(() => {
  window.addEventListener('click', closeFacetDropdown)
  window.addEventListener('keydown', handleFacetKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeFacetDropdown)
  window.removeEventListener('keydown', handleFacetKeydown)
})

watch(
  () => props.addCardQuery,
  (value) => {
    if (!value.trim()) {
      activeSuggestionIndex.value = -1
    }
  }
)
</script>

<template>
  <section class="toolbar">
    <div class="toolbar-group primary">
      <div class="add-card-shell">
        <label class="add-card-field">
          <span class="control-label">Add card</span>
          <input
            :value="addCardQuery"
            type="text"
            :placeholder="isReadOnly ? 'Master collection is read-only.' : 'Type 3+ letters to add a card...'"
            :disabled="addCardDisabled || isReadOnly"
            @input="emit('update:addCardQuery', ($event.target as HTMLInputElement).value)"
            @keydown="handleAddCardKeydown"
          >
        </label>

        <p v-if="isReadOnly" class="read-only-note">
          This view aggregates cards from every saved collection and cannot be edited directly.
        </p>

        <div v-if="shouldShowSuggestions || shouldShowEmptyState" class="autocomplete-panel">
          <div v-if="addCardLoading" class="autocomplete-state">
            Searching cards...
          </div>

          <template v-else-if="addCardSuggestions.length > 0">
            <button
              v-for="(suggestion, index) in addCardSuggestions"
              :key="`${suggestion.card_id}-${suggestion.set_code}-${suggestion.collector_number}`"
              type="button"
              class="autocomplete-option"
              :class="{ active: index === activeSuggestionIndex }"
              @mousedown.prevent="selectSuggestion(suggestion)"
            >
              <img
                v-if="suggestion.image_uri"
                class="autocomplete-image"
                :src="suggestion.image_uri"
                :alt="suggestion.name || 'Card image'"
              >
              <div v-else class="autocomplete-fallback" />
              <div class="autocomplete-copy">
                <strong>{{ suggestion.name || 'Unknown Card' }}</strong>
                <span>{{ suggestion.set_code || '—' }} · {{ suggestion.collector_number || '—' }} · {{ suggestion.lang || '—' }}</span>
              </div>
            </button>
          </template>

          <div v-else class="autocomplete-state">
            No matching cards.
          </div>
        </div>
      </div>
    </div>

    <div class="toolbar-group controls">
      <div class="control-block">
        <span class="control-label">View</span>
        <div class="segmented">
          <button
            type="button"
            class="segment"
            :class="{ active: modelValue === 'grid' }"
            :disabled="!canUseGrid"
            @click="setViewMode('grid')"
          >
            Grid
          </button>
          <button
            type="button"
            class="segment"
            :class="{ active: modelValue === 'list' }"
            :disabled="!canUseList"
            @click="setViewMode('list')"
          >
            List
          </button>
        </div>
      </div>

      <div class="control-block sort-block">
        <label class="control-label" for="collection-sort-key">Sort cards</label>
        <div class="sort-controls">
          <select
            id="collection-sort-key"
            class="sort-select"
            :value="sortKey"
            @change="setSortKey"
          >
            <option value="name">Alphabetically</option>
            <option value="mana-value">Mana value</option>
            <option value="rarity">Rarity</option>
            <option v-if="showScoreSort" value="score">Score</option>
            <option value="usd-price">USD price</option>
          </select>
          <button
            type="button"
            class="sort-direction"
            :aria-label="'Reverse sort direction. Current order: ' + sortDirectionLabel"
            :title="'Reverse sort direction. Current order: ' + sortDirectionLabel"
            @click="toggleSortDirection"
          >
            {{ sortDirectionLabel }}
          </button>
        </div>
      </div>

      <div v-if="lowerDeckType === 'commander'" class="control-block">
        <span class="control-label">Workspace</span>
        <div class="segmented">
          <button type="button" class="segment" :class="{ active: commanderWorkspaceMode === 'normal' }" @click="setCommanderWorkspaceMode('normal')">Normal</button>
          <button type="button" class="segment" :class="{ active: commanderWorkspaceMode === 'template' }" @click="setCommanderWorkspaceMode('template')">Template</button>
        </div>
      </div>

      <div v-if="showBasicLandAdjust" class="control-block">
        <span class="control-label">Lands</span>
        <div class="segmented">
          <button
            type="button"
            class="segment"
            :disabled="basicLandAdjustDisabled"
            @click="emit('adjustBasicLands')"
          >
            Adjust basics
          </button>
        </div>
      </div>

      <div v-if="showStorePriceRefresh" class="control-block">
        <span class="control-label">Stores</span>
        <div class="segmented">
          <button
            type="button"
            class="segment store-price-refresh"
            :disabled="storePriceRefreshDisabled"
            @click="emit('refreshStorePrices')"
          >
            {{ storePriceRefreshLabel }}
          </button>
        </div>
      </div>

      <div class="control-block">
        <span class="control-label">Scope</span>
        <span class="control-value">
          {{ isReadOnly ? 'Read-only aggregate' : lowerDeckType === 'binder' ? 'Binder optimized' : 'Deck editor' }}
        </span>
      </div>

      <div class="control-block">
        <span class="control-label">Organize</span>
        <div class="segmented">
          <button
            type="button"
            class="segment"
            :class="{ active: organizationMode === 'zone' }"
            @click="setOrganizationMode('zone')"
          >
            Zones
          </button>
          <button
            type="button"
            class="segment"
            :class="{ active: organizationMode === 'category' }"
            @click="setOrganizationMode('category')"
          >
            Categories
          </button>
          <button
            type="button"
            class="segment"
            :class="{ active: organizationMode === 'type' }"
            @click="setOrganizationMode('type')"
          >
            Types
          </button>
        </div>
      </div>
    </div>

    <div class="toolbar-group filter">
      <label class="filter-field">
        <span class="control-label">Filter cards</span>
        <input
          :value="filterText"
          type="text"
          placeholder="Search current collection..."
          @input="emit('update:filterText', ($event.target as HTMLInputElement).value)"
        >
      </label>

      <div v-if="showFacetFilters" class="facet-filters">
        <div class="facet-dropdown">
          <button type="button" class="facet-trigger" :aria-expanded="openFacet === 'colors'" @click.stop="toggleFacetDropdown('colors')">
            Commander identity <span>{{ colorFilters?.length || '' }}</span>
          </button>
          <div v-if="openFacet === 'colors'" class="facet-menu" @click.stop>
            <label v-for="option in COLOR_FILTER_OPTIONS" :key="option.value" class="facet-option">
              <input type="checkbox" :checked="colorFilters?.includes(option.value)" @change="toggleColorFilter(option.value)">
              <span>{{ option.label }}</span>
            </label>
          </div>
        </div>
        <div class="facet-dropdown">
          <button type="button" class="facet-trigger" :aria-expanded="openFacet === 'supertypes'" @click.stop="toggleFacetDropdown('supertypes')">
            Supertypes <span>{{ supertypeFilters?.length || '' }}</span>
          </button>
          <div v-if="openFacet === 'supertypes'" class="facet-menu" @click.stop>
            <label v-for="option in supertypeOptions" :key="option" class="facet-option">
              <input type="checkbox" :checked="supertypeFilters?.includes(option)" @change="emit('update:supertypeFilters', toggleFilter(supertypeFilters, option))">
              <span>{{ option }}</span>
            </label>
          </div>
        </div>
        <div class="facet-dropdown">
          <button type="button" class="facet-trigger" :aria-expanded="openFacet === 'types'" @click.stop="toggleFacetDropdown('types')">
            Card types <span>{{ cardTypeFilters?.length || '' }}</span>
          </button>
          <div v-if="openFacet === 'types'" class="facet-menu" @click.stop>
            <label v-for="option in cardTypeOptions" :key="option" class="facet-option">
              <input type="checkbox" :checked="cardTypeFilters?.includes(option)" @change="emit('update:cardTypeFilters', toggleFilter(cardTypeFilters, option))">
              <span>{{ option }}</span>
            </label>
          </div>
        </div>
        <div class="facet-dropdown">
          <button type="button" class="facet-trigger" :aria-expanded="openFacet === 'subtypes'" @click.stop="toggleFacetDropdown('subtypes')">
            Subtypes <span>{{ subtypeFilters?.length || '' }}</span>
          </button>
          <div v-if="openFacet === 'subtypes'" class="facet-menu" @click.stop>
            <label v-for="option in subtypeOptions" :key="option" class="facet-option">
              <input type="checkbox" :checked="subtypeFilters?.includes(option)" @change="emit('update:subtypeFilters', toggleFilter(subtypeFilters, option))">
              <span>{{ option }}</span>
            </label>
          </div>
        </div>
      </div>

      <button v-if="showFacetFilters && hasFacetFilters" class="clear-filters" type="button" @click="clearFacetFilters">
        Clear type and color filters
      </button>
    </div>
  </section>
</template>

<style scoped>
.toolbar {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1.1fr;
  gap: 16px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid var(--surface-border-light);
  background: rgba(17, 24, 39, 0.96);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(10px);
}

.toolbar-group {
  display: flex;
  gap: 12px;
  align-items: end;
  flex-wrap: wrap;
}

.primary {
  align-items: flex-start;
}

.controls {
  justify-content: center;
}

.filter {
  justify-content: flex-end;
}

.read-only-note {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.segment {
  padding: 11px 14px;
  border-radius: 12px;
  border: 1px solid var(--surface-border-light);
  background: var(--surface-hover);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 0.92rem;
  font-weight: 700;
}

.control-block {
  display: grid;
  gap: 8px;
  min-width: 140px;
}

.control-label {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.control-value {
  color: var(--text-main);
  font-size: 0.92rem;
  font-weight: 700;
}

.segmented {
  display: inline-flex;
  padding: 4px;
  border-radius: 14px;
  border: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.76);
}

.segment {
  min-width: 76px;
}

.segment.active {
  background: var(--accent-electric-dim);
  border-color: var(--accent-electric-border);
  color: var(--accent-electric);
}

.sort-block {
  min-width: 260px;
}

.sort-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.sort-select,
.sort-direction {
  min-height: 44px;
  border: 1px solid var(--surface-border-light);
  border-radius: 12px;
  background: var(--surface-hover);
  color: var(--text-main);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
}

.sort-select {
  min-width: 0;
  flex: 1;
  padding: 9px 32px 9px 11px;
}

.sort-direction {
  padding: 9px 11px;
  white-space: nowrap;
  cursor: pointer;
}

.sort-select:focus,
.sort-direction:focus-visible {
  outline: none;
  border-color: var(--accent-electric);
  box-shadow: 0 0 0 4px var(--accent-electric-dim);
}

.add-card-shell {
  position: relative;
  width: min(360px, 100%);
}

.add-card-field,
.filter-field {
  display: grid;
  gap: 8px;
  width: 100%;
}

.add-card-field input,
.filter-field input {
  width: 100%;
  padding: 11px 14px;
  box-sizing: border-box;
  border-radius: 12px;
  border: 1px solid var(--surface-border-light);
  background: var(--surface-hover);
  color: var(--text-light);
  font-family: var(--font-sans);
  font-size: 0.94rem;
}

.add-card-field input:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.add-card-field input:focus,
.filter-field input:focus {
  outline: none;
  border-color: var(--accent-electric);
  box-shadow: 0 0 0 4px var(--accent-electric-dim);
}

.autocomplete-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 30;
  display: grid;
  gap: 4px;
  padding: 8px;
  border-radius: 16px;
  border: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.98);
  box-shadow: var(--shadow-lg);
}

.autocomplete-option {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
}

.autocomplete-option.active,
.autocomplete-option:hover {
  background: var(--surface-hover);
}

.autocomplete-image,
.autocomplete-fallback {
  width: 42px;
  height: 58px;
  border-radius: 8px;
}

.autocomplete-image {
  object-fit: cover;
  border: 1px solid var(--surface-border-light);
}

.autocomplete-fallback {
  border: 1px dashed var(--surface-border-light);
  background: rgba(148, 163, 184, 0.08);
}

.autocomplete-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.autocomplete-copy strong {
  color: var(--text-light);
  font-size: 0.92rem;
}

.autocomplete-copy span,
.autocomplete-state {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.autocomplete-state {
  padding: 12px;
}

.facet-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(130px, 1fr));
  gap: 10px;
  width: 100%;
}

.facet-dropdown {
  position: relative;
  min-width: 0;
}

.facet-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  min-height: 42px;
  padding: 9px 11px;
  border: 1px solid var(--surface-border-light);
  border-radius: 10px;
  background: var(--surface-hover);
  color: var(--text-main);
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
}

.facet-trigger[aria-expanded="true"] {
  border-color: var(--accent-electric);
  color: var(--accent-electric);
}

.facet-menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  display: grid;
  max-height: 260px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid var(--surface-border-light);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.98);
  box-shadow: var(--shadow-lg);
}

.facet-option {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 7px;
  border-radius: 8px;
  color: var(--text-main);
  font-size: 0.85rem;
  cursor: pointer;
}

.facet-option:hover {
  background: var(--surface-hover);
}

.facet-option input {
  accent-color: var(--accent-electric);
}

.clear-filters {
  padding: 9px 12px;
  border: 1px solid var(--surface-border-light);
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.clear-filters:hover {
  color: var(--accent-electric);
  border-color: var(--accent-electric-border);
}

@media (max-width: 980px) {
  .toolbar {
    grid-template-columns: 1fr;
    top: 8px;
  }

  .controls,
  .filter {
    justify-content: flex-start;
  }

  .add-card-shell,
  .filter-field {
    width: 100%;
  }

  .facet-filters {
    grid-template-columns: 1fr;
  }
}
</style>
