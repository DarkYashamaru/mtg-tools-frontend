<script setup lang="ts">
import { computed } from 'vue'
import { naturalCollectionSortDirection } from './sorting'
import type {
  CollectionSortDirection,
  CollectionSortKey,
  CommanderWorkspaceMode,
  WorkspaceOrganizationMode,
  WorkspaceViewMode,
} from './types'

interface Props {
  modelValue: WorkspaceViewMode
  commanderWorkspaceMode?: CommanderWorkspaceMode
  organizationMode: WorkspaceOrganizationMode

  sortKey: CollectionSortKey
  sortDirection: CollectionSortDirection
  showScoreSort?: boolean

  deckType: string
  readOnly?: boolean

  showBasicLandAdjust?: boolean
  basicLandAdjustDisabled?: boolean

  showStorePriceRefresh?: boolean
  storePriceRefreshDisabled?: boolean
  storePriceRefreshLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  commanderWorkspaceMode: 'normal',
  showScoreSort: false,
  readOnly: false,

  showBasicLandAdjust: false,
  basicLandAdjustDisabled: false,

  showStorePriceRefresh: false,
  storePriceRefreshDisabled: false,
  storePriceRefreshLabel: 'Refresh store prices',
})

const emit = defineEmits<{
  'update:modelValue': [value: WorkspaceViewMode]
  'update:commanderWorkspaceMode': [value: CommanderWorkspaceMode]
  'update:organizationMode': [value: WorkspaceOrganizationMode]
  'update:sortKey': [value: CollectionSortKey]
  'update:sortDirection': [value: CollectionSortDirection]
  adjustBasicLands: []
  refreshStorePrices: []
}>()

const isCommander = computed(() =>
  props.deckType.toLowerCase() === 'commander',
)

const scopeLabel = computed(() => {
  if (props.readOnly) {
    return 'Read-only aggregate'
  }

  if (props.deckType.toLowerCase() === 'binder') {
    return 'Binder'
  }

  return 'Deck editor'
})

const sortDirectionLabel = computed(() => {
  if (props.sortKey === 'name') {
    return props.sortDirection === 'asc'
      ? 'A → Z'
      : 'Z → A'
  }

  return props.sortDirection === 'asc'
    ? 'Low → High'
    : 'High → Low'
})

function setSortKey(event: Event) {
  const target =
    event.target as HTMLSelectElement

  const key =
    target.value as CollectionSortKey

  emit('update:sortKey', key)

  emit(
    'update:sortDirection',
    naturalCollectionSortDirection(key),
  )
}

function toggleSortDirection() {
  emit(
    'update:sortDirection',
    props.sortDirection === 'asc'
      ? 'desc'
      : 'asc',
  )
}
</script>

<template>
  <div class="view-options">
    <div class="control-group">
      <span class="control-label">
        View
      </span>

      <div class="segmented">
        <button
          type="button"
          class="segment"
          :class="{
            active: modelValue === 'grid',
          }"
          :aria-pressed="
            modelValue === 'grid'
          "
          @click="
            emit('update:modelValue', 'grid')
          "
        >
          Grid
        </button>

        <button
          type="button"
          class="segment"
          :class="{
            active: modelValue === 'list',
          }"
          :aria-pressed="
            modelValue === 'list'
          "
          @click="
            emit('update:modelValue', 'list')
          "
        >
          List
        </button>
      </div>
    </div>

    <div class="control-group organize-group">
      <span class="control-label">
        Organize
      </span>

      <div class="segmented">
        <button
          type="button"
          class="segment"
          :class="{
            active:
              organizationMode === 'zone',
          }"
          :aria-pressed="
            organizationMode === 'zone'
          "
          @click="
            emit(
              'update:organizationMode',
              'zone',
            )
          "
        >
          Zones
        </button>

        <button
          type="button"
          class="segment"
          :class="{
            active:
              organizationMode === 'category',
          }"
          :aria-pressed="
            organizationMode === 'category'
          "
          @click="
            emit(
              'update:organizationMode',
              'category',
            )
          "
        >
          Categories
        </button>

        <button
          type="button"
          class="segment"
          :class="{
            active:
              organizationMode === 'type',
          }"
          :aria-pressed="
            organizationMode === 'type'
          "
          @click="
            emit(
              'update:organizationMode',
              'type',
            )
          "
        >
          Types
        </button>
      </div>
    </div>

    <div class="control-group sort-group">
      <label
        class="control-label"
        for="collection-sort-key"
      >
        Sort
      </label>

      <div class="sort-controls">
        <select
          id="collection-sort-key"
          class="sort-select"
          :value="sortKey"
          @change="setSortKey"
        >
          <option value="name">
            Name
          </option>

          <option value="mana-value">
            Mana value
          </option>

          <option value="rarity">
            Rarity
          </option>

          <option
            v-if="showScoreSort"
            value="score"
          >
            Score
          </option>

          <option value="usd-price">
            USD price
          </option>
        </select>

        <button
          type="button"
          class="sort-direction"
          :aria-label="
            'Reverse sort direction. Current order: '
              + sortDirectionLabel
          "
          :title="
            'Reverse sort direction. Current order: '
              + sortDirectionLabel
          "
          @click="toggleSortDirection"
        >
          {{ sortDirectionLabel }}
        </button>
      </div>
    </div>

    <div
      v-if="isCommander"
      class="control-group"
    >
      <span class="control-label">
        Workspace
      </span>

      <div class="segmented">
        <button
          type="button"
          class="segment"
          :class="{
            active:
              commanderWorkspaceMode
              === 'normal',
          }"
          :aria-pressed="
            commanderWorkspaceMode
              === 'normal'
          "
          @click="
            emit(
              'update:commanderWorkspaceMode',
              'normal',
            )
          "
        >
          Normal
        </button>

        <button
          type="button"
          class="segment"
          :class="{
            active:
              commanderWorkspaceMode
              === 'template',
          }"
          :aria-pressed="
            commanderWorkspaceMode
              === 'template'
          "
          @click="
            emit(
              'update:commanderWorkspaceMode',
              'template',
            )
          "
        >
          Template
        </button>
      </div>
    </div>

    <div class="view-options-spacer" />

    <div class="context-actions">
      <span class="scope-badge">
        {{ scopeLabel }}
      </span>

      <button
        v-if="showBasicLandAdjust"
        type="button"
        class="utility-button"
        :disabled="
          basicLandAdjustDisabled
        "
        @click="
          emit('adjustBasicLands')
        "
      >
        Adjust basics
      </button>

      <button
        v-if="showStorePriceRefresh"
        type="button"
        class="utility-button"
        :disabled="
          storePriceRefreshDisabled
        "
        @click="
          emit('refreshStorePrices')
        "
      >
        {{ storePriceRefreshLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.view-options {
  display: flex;
  gap: 16px;
  align-items: end;
  width: 100%;
  min-width: 0;
}

.control-group {
  display: grid;
  gap: 6px;
  flex: 0 0 auto;
}

.control-label {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}

.segmented {
  display: inline-flex;
  padding: 3px;
  border:
    1px solid
    var(--surface-border-light);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.72);
}

.segment {
  min-height: 36px;
  padding: 7px 11px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 120ms ease,
    color 120ms ease;
}

.segment:hover:not(:disabled) {
  color: var(--text-main);
}

.segment.active {
  background: var(--accent-electric-dim);
  color: var(--accent-electric);
}

.segment:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.sort-group {
  min-width: 235px;
}

.sort-controls {
  display: flex;
  gap: 6px;
}

.sort-select,
.sort-direction {
  min-height: 42px;
  border:
    1px solid
    var(--surface-border-light);
  border-radius: 9px;
  background: rgba(15, 23, 42, 0.72);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 700;
}

.sort-select {
  flex: 1;
  min-width: 130px;
  padding: 8px 30px 8px 10px;
}

.sort-direction {
  padding: 8px 10px;
  white-space: nowrap;
  cursor: pointer;
}

.sort-select:hover,
.sort-direction:hover {
  background: var(--surface-hover);
}

.sort-select:focus,
.sort-direction:focus-visible {
  outline: none;
  border-color: var(--accent-electric);
  box-shadow:
    0 0 0 3px
    var(--accent-electric-dim);
}

.view-options-spacer {
  flex: 1;
}

.context-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  align-self: center;
}

.scope-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 4px 9px;
  border:
    1px solid
    var(--surface-border-light);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.utility-button {
  min-height: 34px;
  padding: 6px 9px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease;
}

.utility-button:hover:not(:disabled) {
  border-color: var(--surface-border-light);
  background: var(--surface-hover);
  color: var(--text-main);
}

.utility-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.segment:focus-visible,
.utility-button:focus-visible {
  outline:
    2px solid
    var(--accent-electric);
  outline-offset: 2px;
}

@media (max-width: 1180px) {
  .view-options {
    flex-wrap: wrap;
  }

  .view-options-spacer {
    display: none;
  }

  .context-actions {
    margin-left: auto;
  }
}

@media (max-width: 720px) {
  .view-options {
    align-items: stretch;
  }

  .control-group {
    flex: 1 1 auto;
  }

  .context-actions {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 560px) {
  .view-options {
    flex-direction: column;
  }

  .control-group {
    width: 100%;
  }

  .segmented {
    display: flex;
    width: 100%;
    box-sizing: border-box;
  }

  .segment {
    flex: 1;
  }

  .sort-group {
    min-width: 0;
  }

  .context-actions {
    flex-wrap: wrap;
  }
}
</style>