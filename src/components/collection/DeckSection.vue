<script setup lang="ts">
import { computed, ref } from 'vue'
import CardImageTile from './CardImageTile.vue'
import CollectionListSection from './CollectionListSection.vue'
import type {
  CollectionCardContextMenuPayload,
  CollectionItem,
  CollectionProfileSection,
  WorkspaceOrganizationMode,
  WorkspaceViewMode,
} from './types'
import { groupCollectionItemsByProfileSection } from './grouping'

interface Props {
  title: string
  items: CollectionItem[]
  viewMode: WorkspaceViewMode
  organizationMode?: WorkspaceOrganizationMode
  profileSections?: CollectionProfileSection[]
  hideSingletonAmount?: boolean
  enforceSingletonQuantities?: boolean
  mutatingItemIds?: Array<string | number>
  showQuantityActions?: boolean
  eyebrow?: string
  description?: string
  showCardCount?: boolean
  primaryActionLabel?: string
  primaryActionDisabled?: boolean
  showScore?: boolean
  collapsible?: boolean
  initiallyCollapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  organizationMode: 'section',
  profileSections: () => [],
  hideSingletonAmount: false,
  enforceSingletonQuantities: false,
  mutatingItemIds: () => [],
  showQuantityActions: true,
  eyebrow: '',
  description: '',
  showCardCount: true,
  primaryActionLabel: '',
  primaryActionDisabled: false,
  showScore: false,
  collapsible: false,
  initiallyCollapsed: false,
})
const emit = defineEmits<{
  hoverItem: [item: CollectionItem | null]
  contextMenu: [payload: CollectionCardContextMenuPayload]
  incrementItem: [item: CollectionItem]
  decrementItem: [item: CollectionItem]
  cardClick: [item: CollectionItem]
  primaryAction: [item: CollectionItem]
}>()
const totalCards = computed(() => props.items.reduce((sum, item) => sum + item.amount, 0))
const isCollapsed = ref(props.initiallyCollapsed)
const profileSectionGroups = computed(() => (
  props.organizationMode === 'category'
    ? groupCollectionItemsByProfileSection(props.items, props.profileSections)
    : []
))
</script>

<template>
  <div v-if="viewMode === 'list' && organizationMode === 'category' && profileSectionGroups.length" class="section-stack">
    <CollectionListSection
      v-for="group in profileSectionGroups"
      :key="group.key"
      :title="group.title"
      :items="group.items"
      :hide-singleton-amount="hideSingletonAmount"
      :enforce-singleton-quantities="enforceSingletonQuantities"
      :mutating-item-ids="mutatingItemIds"
      :description="group.description"
      :show-quantity-actions="showQuantityActions"
      :primary-action-label="primaryActionLabel"
      :primary-action-disabled="primaryActionDisabled"
      :show-score="showScore"
      @hover-item="emit('hoverItem', $event)"
      @context-menu="emit('contextMenu', $event)"
      @increment-item="emit('incrementItem', $event)"
      @decrement-item="emit('decrementItem', $event)"
      @card-click="emit('cardClick', $event)"
      @primary-action="emit('primaryAction', $event)"
    />
  </div>

  <CollectionListSection
    v-else-if="viewMode === 'list'"
    :title="title"
    :items="items"
    :hide-singleton-amount="hideSingletonAmount"
      :enforce-singleton-quantities="enforceSingletonQuantities"
    :mutating-item-ids="mutatingItemIds"
    :eyebrow="eyebrow"
    :description="description"
    :show-card-count="showCardCount"
    :show-quantity-actions="showQuantityActions"
    :primary-action-label="primaryActionLabel"
    :primary-action-disabled="primaryActionDisabled"
    :show-score="showScore"
    @hover-item="emit('hoverItem', $event)"
    @context-menu="emit('contextMenu', $event)"
    @increment-item="emit('incrementItem', $event)"
    @decrement-item="emit('decrementItem', $event)"
    @card-click="emit('cardClick', $event)"
    @primary-action="emit('primaryAction', $event)"
  />

  <section v-else class="deck-section">
    <header class="section-header">
      <div>
        <p v-if="eyebrow" class="section-eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
        <p v-if="showCardCount || description">
          <template v-if="showCardCount">{{ totalCards }} cards</template>
          <template v-if="showCardCount && description"> · </template>
          <template v-if="description">{{ description }}</template>
        </p>
      </div>

      <button
        v-if="collapsible && items.length"
        class="section-toggle"
        type="button"
        :aria-expanded="!isCollapsed"
        @click="isCollapsed = !isCollapsed"
      >
        {{ isCollapsed ? 'Show cards' : 'Hide cards' }}
      </button>
    </header>

    <div v-if="items.length === 0" class="empty-section">
      No cards in this section.
    </div>

    <div v-else-if="isCollapsed" class="collapsed-section-copy">
      {{ totalCards }} cards hidden
    </div>

    <template v-else-if="organizationMode === 'category' && profileSectionGroups.length">
      <div class="section-stack">
        <section v-for="group in profileSectionGroups" :key="group.key" class="section-block">
          <header class="profile-section-header">
            <h3>{{ group.title }}</h3>
            <p>{{ group.totalCards }} cards<span v-if="group.description"> · {{ group.description }}</span></p>
          </header>

          <div class="grid-layout">
            <CardImageTile
              v-for="item in group.items"
              :key="`${group.key}-${item.id}`"
              :item="item"
              :hide-singleton-amount="hideSingletonAmount"
      :enforce-singleton-quantities="enforceSingletonQuantities"
              :is-mutating="mutatingItemIds.includes(item.id)"
              :show-quantity-actions="showQuantityActions"
              :primary-action-label="primaryActionLabel"
              :primary-action-disabled="primaryActionDisabled"
              @context-menu="emit('contextMenu', $event)"
              @increment-item="emit('incrementItem', $event)"
              @decrement-item="emit('decrementItem', $event)"
              @card-click="emit('cardClick', $event)"
              @primary-action="emit('primaryAction', $event)"
            />
          </div>
        </section>
      </div>
    </template>

    <div v-else class="grid-layout">
      <CardImageTile
        v-for="item in items"
        :key="item.id"
        :item="item"
        :hide-singleton-amount="hideSingletonAmount"
      :enforce-singleton-quantities="enforceSingletonQuantities"
        :is-mutating="mutatingItemIds.includes(item.id)"
        :show-quantity-actions="showQuantityActions"
        :primary-action-label="primaryActionLabel"
        :primary-action-disabled="primaryActionDisabled"
        @context-menu="emit('contextMenu', $event)"
        @increment-item="emit('incrementItem', $event)"
        @decrement-item="emit('decrementItem', $event)"
        @card-click="emit('cardClick', $event)"
        @primary-action="emit('primaryAction', $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.deck-section {
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid var(--surface-border-light);
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.04), rgba(15, 23, 42, 0.98)),
    var(--surface-card);
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.section-header h2 {
  margin: 0;
  color: var(--text-light);
  font-size: 1.25rem;
}

.section-eyebrow {
  margin: 0 0 6px;
  color: var(--accent-electric);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.section-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.section-toggle {
  flex-shrink: 0;
  padding: 8px 12px;
  border: 1px solid var(--accent-electric-border);
  border-radius: 10px;
  background: var(--accent-electric-dim);
  color: var(--accent-electric);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.section-toggle:hover {
  background: rgba(56, 189, 248, 0.18);
}

.empty-section,
.collapsed-section-copy {
  padding: 18px;
  border-radius: 16px;
  border: 1px dashed var(--surface-border-light);
  color: var(--text-muted);
}

.grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}

.section-stack {
  display: grid;
  gap: 22px;
}

.section-block {
  display: grid;
  gap: 14px;
}

.profile-section-header h3 {
  margin: 0;
  color: var(--text-light);
  font-size: 1.05rem;
}

.profile-section-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 0.86rem;
}

@media (max-width: 640px) {
  .section-header {
    align-items: stretch;
    flex-direction: column;
  }

  .section-toggle {
    width: 100%;
  }
}
</style>
