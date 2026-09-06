<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  CollectionCardSearchResult,
} from './types'

interface Props {
  modelValue: string
  suggestions: CollectionCardSearchResult[]
  loading: boolean
  disabled?: boolean
  readOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  readOnly: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [value: CollectionCardSearchResult]
  dismiss: []
}>()

const activeSuggestionIndex = ref(-1)

const normalizedQuery = computed(() =>
  props.modelValue.trim(),
)

const shouldShowSuggestions = computed(() => (
  normalizedQuery.value.length >= 3
  && (
    props.loading
    || props.suggestions.length > 0
  )
))

const shouldShowEmptyState = computed(() => (
  normalizedQuery.value.length >= 3
  && !props.loading
  && props.suggestions.length === 0
))

function selectSuggestion(
  suggestion: CollectionCardSearchResult,
) {
  emit('select', suggestion)
}

function dismissSuggestions() {
  activeSuggestionIndex.value = -1
  emit('dismiss')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    dismissSuggestions()
    return
  }

  if (props.suggestions.length === 0) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()

    activeSuggestionIndex.value =
      (activeSuggestionIndex.value + 1)
      % props.suggestions.length

    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()

    activeSuggestionIndex.value =
      activeSuggestionIndex.value <= 0
        ? props.suggestions.length - 1
        : activeSuggestionIndex.value - 1

    return
  }

  if (
    event.key === 'Enter'
    && activeSuggestionIndex.value >= 0
  ) {
    event.preventDefault()

    const suggestion =
      props.suggestions[
        activeSuggestionIndex.value
      ]

    if (suggestion) {
      selectSuggestion(suggestion)
    }
  }
}

watch(
  () => props.suggestions,
  suggestions => {
    activeSuggestionIndex.value =
      suggestions.length > 0 ? 0 : -1
  },
)

watch(
  () => props.modelValue,
  value => {
    if (!value.trim()) {
      activeSuggestionIndex.value = -1
    }
  },
)
</script>

<template>
  <div class="add-card">
    <label class="field">
      <span class="control-label">
        Add card
      </span>

      <div class="input-shell">
        <input
          :value="modelValue"
          type="text"
          :placeholder="
            readOnly
              ? 'Master collection is read-only.'
              : 'Type 3+ letters to add a card...'
          "
          :disabled="disabled || readOnly"
          @input="
            emit(
              'update:modelValue',
              ($event.target as HTMLInputElement).value,
            )
          "
          @keydown="handleKeydown"
        >
      </div>
    </label>

    <p
      v-if="readOnly"
      class="read-only-note"
    >
      This view aggregates cards from every saved
      collection and cannot be edited directly.
    </p>

    <div
      v-if="
        shouldShowSuggestions
          || shouldShowEmptyState
      "
      class="autocomplete-panel"
    >
      <div
        v-if="loading"
        class="autocomplete-state"
      >
        Searching cards...
      </div>

      <template
        v-else-if="suggestions.length > 0"
      >
        <button
          v-for="(suggestion, index) in suggestions"
          :key="
            `${suggestion.card_id}-`
              + `${suggestion.set_code}-`
              + suggestion.collector_number
          "
          type="button"
          class="autocomplete-option"
          :class="{
            active:
              index === activeSuggestionIndex,
          }"
          @mousedown.prevent="
            selectSuggestion(suggestion)
          "
        >
          <img
            v-if="suggestion.image_uri"
            class="autocomplete-image"
            :src="suggestion.image_uri"
            :alt="
              suggestion.name || 'Card image'
            "
          >

          <div
            v-else
            class="autocomplete-fallback"
          />

          <div class="autocomplete-copy">
            <strong>
              {{
                suggestion.name
                  || 'Unknown Card'
              }}
            </strong>

            <span>
              {{ suggestion.set_code || '—' }}
              ·
              {{
                suggestion.collector_number
                  || '—'
              }}
              ·
              {{ suggestion.lang || '—' }}
            </span>
          </div>
        </button>
      </template>

      <div
        v-else
        class="autocomplete-state"
      >
        No matching cards.
      </div>
    </div>
  </div>
</template>

<style scoped>
.add-card {
  position: relative;
  min-width: 0;
  width: 100%;
}

.field {
  display: grid;
  gap: 7px;
}

.control-label {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}

.input-shell input {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--surface-border-light);
  border-radius: 11px;
  background: rgba(15, 23, 42, 0.72);
  color: var(--text-light);
  font-family: var(--font-sans);
  font-size: 0.92rem;
  transition:
    border-color 120ms ease,
    background 120ms ease,
    box-shadow 120ms ease;
}

.input-shell input:hover:not(:disabled) {
  background: var(--surface-hover);
}

.input-shell input:focus {
  outline: none;
  border-color: var(--accent-electric);
  box-shadow:
    0 0 0 3px
    var(--accent-electric-dim);
}

.input-shell input:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.read-only-note {
  margin: 7px 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.4;
}

.autocomplete-panel {
  position: absolute;
  z-index: 50;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  display: grid;
  gap: 4px;
  padding: 7px;
  border: 1px solid var(--surface-border-light);
  border-radius: 13px;
  background: rgba(15, 23, 42, 0.99);
  box-shadow: var(--shadow-lg);
}

.autocomplete-option {
  display: grid;
  grid-template-columns:
    40px
    minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 7px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
}

.autocomplete-option:hover,
.autocomplete-option.active {
  background: var(--surface-hover);
}

.autocomplete-image,
.autocomplete-fallback {
  width: 40px;
  height: 56px;
  border-radius: 7px;
}

.autocomplete-image {
  object-fit: cover;
  border:
    1px solid
    var(--surface-border-light);
}

.autocomplete-fallback {
  border:
    1px dashed
    var(--surface-border-light);
  background: rgba(148, 163, 184, 0.08);
}

.autocomplete-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.autocomplete-copy strong {
  overflow: hidden;
  color: var(--text-light);
  font-size: 0.88rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.autocomplete-copy span,
.autocomplete-state {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.autocomplete-state {
  padding: 11px;
}
</style>