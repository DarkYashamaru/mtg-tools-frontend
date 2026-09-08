<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import CollectionHoverPreview from './CollectionHoverPreview.vue'
import CommanderBuilderHoverPreview from './CommanderBuilderHoverPreview.vue'
import CommanderDeckTemplate from './CommanderDeckTemplate.vue'
import type {
  CollectionRecord,
  CollectionItem,
  CollectionProfileSection,
  CollectionCardContextMenuPayload,
  WorkspaceViewMode,
  WorkspaceOrganizationMode,
} from './types'

const CommanderWorkspace = defineAsyncComponent(() => import('./CommanderWorkspace.vue'))
const StandardWorkspace = defineAsyncComponent(() => import('./StandardWorkspace.vue'))
const BinderWorkspace = defineAsyncComponent(() => import('./BinderWorkspace.vue'))

const props = defineProps<{
  collection: CollectionRecord
  viewMode: WorkspaceViewMode
  organizationMode: WorkspaceOrganizationMode
  profileSections: CollectionProfileSection[]
  commanderItems: CollectionItem[]
  templateMode: boolean
  sourceBrowserOpen: boolean
  hoveredItem: CollectionItem | null
  mutatingItemIds: Array<string | number>
  readOnly: boolean
}>()
const emit = defineEmits<{
  'hover-item': [item: CollectionItem | null]
  'context-menu': [payload: CollectionCardContextMenuPayload]
  'increment-item': [item: CollectionItem]
  'decrement-item': [item: CollectionItem]
}>()
const isCommander = computed(() => props.collection.deck_type.toLowerCase() === 'commander')
const component = computed(() => {
  if (props.templateMode) return CommanderDeckTemplate
  if (isCommander.value) return CommanderWorkspace
  if (props.collection.deck_type.toLowerCase() === 'standard') return StandardWorkspace
  return BinderWorkspace
})
const componentProps = computed(() => props.templateMode
  ? { commanderItems: props.commanderItems }
  : { organizationMode: props.organizationMode, profileSections: props.profileSections,
      ...(isCommander.value ? { showScore: true } : {}) })
const events = {
  contextMenu: (payload: CollectionCardContextMenuPayload) => emit('context-menu', payload),
  incrementItem: (item: CollectionItem) => emit('increment-item', item),
  decrementItem: (item: CollectionItem) => emit('decrement-item', item),
}
</script>

<template>
  <div v-if="sourceBrowserOpen && collection.commander_oracle_id" class="commander-source-split">
    <main class="commander-source-deck-pane">
      <CommanderWorkspace
        :collection="collection"
        :view-mode="viewMode"
        :organization-mode="organizationMode"
        :profile-sections="profileSections"
        :mutating-item-ids="mutatingItemIds"
        :show-quantity-actions="!readOnly"
        :show-score="true"
        v-on="events"
      />
    </main>
    <aside class="commander-source-browser-pane">
      <slot name="source-browser" />
    </aside>
  </div>

  <div v-else-if="collection.items.length === 0 && !templateMode" class="state-panel state-panel-compact">
    <h2>No cards match this filter</h2>
    <p>Try a different local filter or clear the current search.</p>
  </div>

  <div v-else-if="viewMode === 'list'" class="workspace-content-grid">
    <main class="workspace-main">
      <component
        :is="component"
        v-bind="componentProps"
        :collection="collection"
        :view-mode="viewMode"
        :mutating-item-ids="mutatingItemIds"
        :show-quantity-actions="!readOnly"
        v-on="events"
        @hover-item="emit('hover-item', $event)"
      />
    </main>
    <aside class="workspace-preview">
      <CommanderBuilderHoverPreview v-if="isCommander && !templateMode" :item="hoveredItem" />
      <CollectionHoverPreview v-else :item="hoveredItem" />
    </aside>
  </div>

  <component
    :is="component"
    v-else
    v-bind="componentProps"
    :collection="collection"
    :view-mode="viewMode"
    :mutating-item-ids="mutatingItemIds"
    :show-quantity-actions="!readOnly"
    v-on="events"
  />
</template>

<style scoped>
.workspace-content-grid {
  width: 100%;
  max-width: 100%;
  min-width: 0;

  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    minmax(280px, 350px);

  gap: clamp(14px, 1.25vw, 20px);

  align-items: start;

  box-sizing: border-box;
}

.workspace-main {
  width: 100%;
  max-width: 100%;
  min-width: 0;

  box-sizing: border-box;
}

.workspace-preview {
  position: sticky;
  top: 16px;

  width: 100%;
  max-width: 100%;
  min-width: 0;

  max-height: calc(100vh - 32px);

  box-sizing: border-box;
}

@media (max-width: 1100px) {
.workspace-content-grid {
    grid-template-columns:
      minmax(0, 1fr)
      280px;
  }

}
@media (max-width: 980px) {
.workspace-content-grid {
    grid-template-columns:
      minmax(0, 1fr);
  }

.workspace-preview {
    display: none;
  }

}
.commander-source-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(520px, 0.95fr);
  gap: clamp(14px, 1.5vw, 24px);
  align-items: start;
  width: 100%;
  min-width: 0;
}

.commander-source-deck-pane,
.commander-source-browser-pane {
  min-width: 0;
}

.commander-source-browser-pane {
  position: sticky;
  top: 16px;
}

@media (max-width: 1200px) {
.commander-source-split {
    grid-template-columns: minmax(0, 1fr);
  }

.commander-source-browser-pane {
    position: static;
  }

}
@media (min-width: 1201px) {
.commander-source-split {
    height: calc(100dvh - 32px);
    min-height: 620px;
  }

.commander-source-deck-pane,
.commander-source-browser-pane {
    height: 100%;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }

.commander-source-browser-pane {
    position: static;
  }

}
@media (max-width: 1200px) {
.commander-source-split {
    height: auto;
    min-height: 0;
  }

.commander-source-deck-pane,
.commander-source-browser-pane {
    height: auto;
    overflow: visible;
  }

}

.state-panel {
  width: 100%;
  max-width: 100%;
  min-width: 0;

  padding: clamp(20px, 2vw, 28px);

  border: 1px solid var(--surface-border-light);
  border-radius: 18px;

  background:
    linear-gradient(
      180deg,
      rgba(148, 163, 184, 0.04),
      rgba(15, 23, 42, 0.98)
    ),
    var(--surface-card);

  box-shadow: var(--shadow-md);

  box-sizing: border-box;
}

.state-panel-compact {
  padding: 20px;
}

.state-panel h2 {
  margin: 0;

  color: var(--text-light);

  font-size: clamp(
    1.15rem,
    1.4vw,
    1.4rem
  );
}

.state-panel p {
  margin: 8px 0 0;

  color: var(--text-muted);

  line-height: 1.5;
}
@media (max-width: 760px) { .state-panel { border-radius: 14px; } }
</style>
