<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  CollectionCardSearchResult,
  CollectionRecord,
  WorkspaceOrganizationMode,
  WorkspaceViewMode,
} from './types'

interface Props {
  collection: CollectionRecord
  modelValue: WorkspaceViewMode
  organizationMode: WorkspaceOrganizationMode
  filterText: string
  addCardQuery: string
  addCardSuggestions: CollectionCardSearchResult[]
  addCardLoading: boolean
  addCardDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  addCardDisabled: false,
})
const emit = defineEmits<{
  'update:modelValue': [value: WorkspaceViewMode]
  'update:organizationMode': [value: WorkspaceOrganizationMode]
  'update:filterText': [value: string]
  'update:addCardQuery': [value: string]
  selectAddCardSuggestion: [value: CollectionCardSearchResult]
  dismissAddCardSuggestions: []
}>()

const lowerDeckType = computed(() => props.collection.deck_type.toLowerCase())
const isReadOnly = computed(() => props.collection.is_read_only === true)
const canUseGrid = computed(() => true)
const canUseList = computed(() => true)
const activeSuggestionIndex = ref(-1)
const shouldShowSuggestions = computed(() => (
  props.addCardQuery.trim().length >= 3 && (props.addCardLoading || props.addCardSuggestions.length > 0)
))
const shouldShowEmptyState = computed(() => (
  props.addCardQuery.trim().length >= 3 && !props.addCardLoading && props.addCardSuggestions.length === 0
))

function setViewMode(value: WorkspaceViewMode) {
  emit('update:modelValue', value)
}

function setOrganizationMode(value: WorkspaceOrganizationMode) {
  emit('update:organizationMode', value)
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
            :class="{ active: organizationMode === 'section' }"
            @click="setOrganizationMode('section')"
          >
            Sections
          </button>
          <button
            type="button"
            class="segment"
            :class="{ active: organizationMode === 'category' }"
            @click="setOrganizationMode('category')"
          >
            Categories
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
}
</style>
