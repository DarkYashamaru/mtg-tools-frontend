<script setup lang="ts">
import type { CollectionExportOptions } from './exporting'

const props = defineProps<{
  options: CollectionExportOptions
  cardCopies: number
  entryCount: number
  message: string
  canExport: boolean
}>()
const emit = defineEmits<{
  'update:options': [options: CollectionExportOptions]
  copy: []
  download: []
}>()
function updateOption(key: keyof CollectionExportOptions, event: Event) {
  emit('update:options', { ...props.options, [key]: (event.target as HTMLInputElement).checked })
}
</script>

<template>
  <section class="export-panel">
    <div class="export-summary">
      <div class="export-heading">
        <span class="export-title">
          Export filtered cards
        </span>

        <span class="export-count">
          {{ cardCopies }}
          cards ·
          {{ entryCount }}
          entries
        </span>
      </div>

      <span
        v-if="message"
        class="export-message"
        role="status"
      >
        {{ message }}
      </span>
    </div>

    <div class="export-actions">
      <details
        class="export-options-menu"
      >
        <summary>
          Options
        </summary>

        <div class="export-options">
          <label>
            <input
              :checked="options.includeMaybeboard"
              @change="updateOption('includeMaybeboard', $event)"
              type="checkbox"
            >

            Include Maybeboard
          </label>

          <label>
            <input
              :checked="options.includeSectionHeaders"
              @change="updateOption('includeSectionHeaders', $event)"
              type="checkbox"
            >

            Generic section headers
          </label>

          <label>
            <input
              :checked="options.includeSetCode"
              @change="updateOption('includeSetCode', $event)"
              type="checkbox"
            >

            Set code
          </label>

          <label
            :class="{
              disabled:
                !options.includeSetCode,
            }"
          >
            <input
              :checked="options.includeCollectorNumber"
              @change="updateOption('includeCollectorNumber', $event)"
              type="checkbox"
              :disabled="!options.includeSetCode"
            >

            Collector number
          </label>

          <label>
            <input
              :checked="options.includeColorTags"
              @change="updateOption('includeColorTags', $event)"
              type="checkbox"
            >

            Color tags
          </label>
        </div>
      </details>

      <button
        type="button"
        class="export-button export-button-primary"
        :disabled="!canExport"
        @click="emit('copy')"
      >
        Copy
      </button>

      <button
        type="button"
        class="export-button"
        :disabled="!canExport"
        @click="emit('download')"
      >
        Download TXT
      </button>
    </div>
  </section>

</template>

<style scoped>
.export-panel {
  position: relative;

  width: 100%;
  max-width: 100%;
  min-width: 0;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 14px;

  padding: 10px 12px;

  border: 1px solid var(--surface-border-light);
  border-radius: 14px;

  background: var(--surface-card);

  box-sizing: border-box;
}

.export-summary {
  flex: 1 1 auto;

  min-width: 0;

  display: flex;
  align-items: center;
  flex-wrap: wrap;

  gap: 6px 12px;
}

.export-heading {
  min-width: 0;

  display: flex;
  align-items: baseline;
  flex-wrap: wrap;

  gap: 6px 10px;
}

.export-title {
  color: var(--text-light);

  font-weight: 800;

  white-space: nowrap;
}

.export-count,
.export-message {
  min-width: 0;

  color: var(--text-muted);

  font-size: 0.86rem;
}

.export-message {
  color: var(--accent-electric);
}

.export-actions {
  flex: 0 0 auto;

  min-width: 0;

  display: flex;
  align-items: center;

  gap: 8px;
}

.export-button,
.export-options-menu > summary {
  min-height: 36px;

  padding: 7px 11px;

  border: 1px solid var(--surface-border-light);
  border-radius: 9px;

  background: var(--surface-hover);
  color: var(--text-main);

  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;

  cursor: pointer;
  user-select: none;

  box-sizing: border-box;

  transition:
    border-color 120ms ease,
    background-color 120ms ease,
    color 120ms ease,
    transform 120ms ease;
}

.export-button:hover:not(:disabled),
.export-options-menu > summary:hover {
  border-color: var(--accent-electric);

  color: var(--accent-electric);
}

.export-button:active:not(:disabled),
.export-options-menu > summary:active {
  transform: translateY(1px);
}

.export-button:focus-visible,
.export-options-menu > summary:focus-visible {
  outline: 2px solid var(--accent-electric);
  outline-offset: 2px;
}

.export-button-primary {
  background: var(--accent-electric-dim);

  color: var(--accent-electric);
}

.export-button:disabled {
  cursor: not-allowed;

  opacity: 0.45;
}

.export-options-menu {
  position: relative;

  min-width: 0;
}

.export-options-menu > summary {
  display: flex;
  align-items: center;

  gap: 7px;

  list-style: none;
}

.export-options-menu > summary::-webkit-details-marker {
  display: none;
}

.export-options-menu > summary::after {
  content: '▾';

  font-size: 0.72rem;

  transition: transform 140ms ease;
}

.export-options-menu[open] > summary::after {
  transform: rotate(180deg);
}

.export-options {
  position: absolute;

  z-index: 30;

  top: calc(100% + 8px);
  right: 0;

  width: min(
    310px,
    calc(100vw - 32px)
  );

  max-width: calc(100vw - 32px);

  display: grid;

  gap: 4px;

  padding: 8px;

  border: 1px solid var(--surface-border-light);
  border-radius: 12px;

  background: rgba(15, 23, 42, 0.98);

  box-shadow: var(--shadow-lg);

  backdrop-filter: blur(16px);

  box-sizing: border-box;
}

.export-options label {
  min-width: 0;
  min-height: 36px;

  display: flex;
  align-items: center;

  gap: 9px;

  padding: 7px 9px;

  border-radius: 8px;

  color: var(--text-main);

  font-size: 0.88rem;

  cursor: pointer;
}

.export-options label:hover {
  background: var(--surface-hover);
}

.export-options label.disabled {
  opacity: 0.45;

  cursor: not-allowed;
}

.export-options input {
  flex: 0 0 auto;

  margin: 0;

  accent-color: var(--accent-electric);
}

@media (max-width: 1100px) {
.export-panel {
    align-items: flex-start;

    flex-wrap: wrap;
  }

.export-actions {
    margin-left: auto;
  }

}
@media (max-width: 760px) {
.export-panel {
    padding: 10px;
  }

.export-summary,
.export-heading {
    width: 100%;
  }

.export-actions {
    width: 100%;

    margin-left: 0;
  }

.export-actions .export-button {
    flex: 1 1 0;

    min-width: 0;
  }

.export-options-menu {
    flex: 0 0 auto;
  }

.export-options {
    right: auto;
    left: 0;
  }

}
@media (max-width: 480px) {
.export-actions {
    display: grid;

    grid-template-columns:
      auto
      minmax(0, 1fr)
      minmax(0, 1fr);
  }

.export-button,
.export-options-menu > summary {
    min-width: 0;

    padding-inline: 9px;
  }

}
@media (prefers-reduced-motion: reduce) {
.export-button,
.export-options-menu > summary,
.export-options-menu > summary::after {
    transition: none;
  }

}
</style>
