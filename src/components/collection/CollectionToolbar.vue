<script setup lang="ts">
import { computed } from 'vue'
import type { CollectionRecord, WorkspaceViewMode } from './types'

interface Props {
  collection: CollectionRecord
  modelValue: WorkspaceViewMode
  filterText: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: WorkspaceViewMode]
  'update:filterText': [value: string]
}>()

const lowerDeckType = computed(() => props.collection.deck_type.toLowerCase())
const canUseGrid = computed(() => true)
const canUseList = computed(() => true)

function setViewMode(value: WorkspaceViewMode) {
  emit('update:modelValue', value)
}
</script>

<template>
  <section class="toolbar">
    <div class="toolbar-group primary">
      <button class="card-search-button" type="button" disabled aria-disabled="true">
        Card Search
      </button>
      <button class="quiet-button" type="button" disabled aria-disabled="true">
        Quick Add
      </button>
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
        <span class="control-value">{{ lowerDeckType === 'binder' ? 'Binder optimized' : 'Deck editor' }}</span>
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
  align-items: center;
}

.controls {
  justify-content: center;
}

.filter {
  justify-content: flex-end;
}

.card-search-button,
.quiet-button,
.segment {
  padding: 11px 14px;
  border-radius: 12px;
  font-family: var(--font-sans);
  font-size: 0.92rem;
  font-weight: 700;
}

.card-search-button {
  border: none;
  background: var(--accent-electric);
  color: #07121a;
}

.quiet-button,
.segment {
  border: 1px solid var(--surface-border-light);
  background: var(--surface-hover);
  color: var(--text-main);
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

.filter-field {
  display: grid;
  gap: 8px;
  width: min(320px, 100%);
}

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

.filter-field input:focus {
  outline: none;
  border-color: var(--accent-electric);
  box-shadow: 0 0 0 4px var(--accent-electric-dim);
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

  .filter-field {
    width: 100%;
  }
}
</style>
