<script setup lang="ts">
import { computed } from 'vue'
import DeckSection from './DeckSection.vue'
import type { CollectionCardContextMenuPayload, CollectionItem, CollectionRecord, CommanderDeckTemplateData, WorkspaceViewMode } from './types'

interface Props {
  collection: CollectionRecord
  commanderItems: CollectionItem[]
  commanderTemplate: CommanderDeckTemplateData | null
  viewMode: WorkspaceViewMode
  mutatingItemIds: Array<string | number>
  showQuantityActions?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  hoverItem: [item: CollectionItem | null]
  contextMenu: [payload: CollectionCardContextMenuPayload]
  incrementItem: [item: CollectionItem]
  decrementItem: [item: CollectionItem]
}>()
const nonCommanderItems = computed(() => props.collection.items.filter(item => item.zone !== 'commander' && item.zone !== 'maybeboard'))
const maybeboardItems = computed(() => props.collection.items.filter(item => item.zone === 'maybeboard'))
const itemsById = computed(() => new Map(nonCommanderItems.value.map(item => [String(item.id), item])))

function hasCategory(item: CollectionItem, category: string) {
  return item.categories?.some(candidate => candidate.name === category) ?? false
}

function sectionItems(key: string) {
  if (key === 'card-advantage') return nonCommanderItems.value.filter(item => hasCategory(item, 'Draw'))
  if (key === 'removal') return nonCommanderItems.value.filter(item => hasCategory(item, 'Removal'))
  if (key === 'ramp') return nonCommanderItems.value.filter(item => hasCategory(item, 'Ramp'))
  return []
}

const recommendationSections = computed(() => (props.commanderTemplate?.sections ?? [])
  .filter(section => section.key !== 'lands')
  .map(section => ({
    ...section,
    items: sectionItems(section.key),
    description: `${section.actual} / ${section.target} recommended · ${section.status === 'on-target' ? 'On target' : section.status === 'below' ? 'Below target' : 'Above target'}`,
  })))
const landSections = computed(() => (props.commanderTemplate?.land_sections ?? [])
  .filter(section => {
    const row = props.commanderTemplate?.land_base.rows.find(candidate => candidate.key === section.key)
    return section.copy_count > 0 || Boolean(row && row.maximum > 0)
  })
  .map(section => {
  const row = props.commanderTemplate?.land_base.rows.find(candidate => candidate.key === section.key)
  return {
    ...section,
    items: section.item_ids.map(id => itemsById.value.get(String(id))).filter((item): item is CollectionItem => Boolean(item)),
    description: row ? `${section.copy_count} / ${target(row)} recommended · ${status(row)}` : `${section.copy_count} currently in the deck.`,
    eyebrow: row ? status(row) : '',
  }
}))

function target(row: CommanderDeckTemplateData['land_base']['rows'][number]) {
  return row.minimum === row.maximum ? `${row.minimum}` : `${row.minimum}–${row.maximum}`
}

function status(row: CommanderDeckTemplateData['land_base']['rows'][number]) {
  return row.status === 'planning' ? 'Planning target' : row.status === 'within' ? 'Within range' : row.status === 'below' ? 'Below range' : 'Above range'
}
</script>

<template>
  <section class="template-intro">
    <p class="template-eyebrow">Commander deck guide</p>
    <h2>Recommended deck template</h2>
    <p>This guide is advisory only and does not enforce deck construction requirements.</p>
    <p v-if="!commanderTemplate" class="template-fallback">Commander template recommendations are temporarily unavailable.</p>
    <p v-else>Combined commander mana value: {{ commanderTemplate.commander.combined_mana_value }} · {{ commanderTemplate.commander.color_count }} commander color{{ commanderTemplate.commander.color_count === 1 ? '' : 's' }}.</p>
  </section>

  <section v-if="commanderTemplate" class="land-guide">
    <div>
      <p class="template-eyebrow">Land base guide</p>
      <h3>{{ commanderTemplate.land_base.tier.replaceAll('-', ' ') }}</h3>
      <p>Counts exclude the commander and Maybeboard. Land sections use the backend's canonical produced-mana data, with each land shown in one section.</p>
    </div>
    <div class="land-guide-rows">
      <div v-for="row in commanderTemplate.land_base.rows" :key="row.key" class="land-guide-row">
        <div><strong>{{ row.label }}</strong><small>{{ row.actual }} currently in the deck.</small></div>
        <div class="land-guide-target"><strong>{{ row.actual }} / {{ target(row) }}</strong><small>{{ status(row) }}</small></div>
      </div>
    </div>
  </section>

  <div v-if="commanderTemplate" class="template-sections">
    <DeckSection
      v-for="section in landSections"
      :key="section.key"
      :title="section.title"
      :items="section.items"
      :view-mode="viewMode"
      :description="section.description"
      :eyebrow="section.eyebrow"
      :mutating-item-ids="mutatingItemIds"
      :enforce-singleton-quantities="true"
      :show-quantity-actions="showQuantityActions"
      @hover-item="emit('hoverItem', $event)"
      @context-menu="emit('contextMenu', $event)"
      @increment-item="emit('incrementItem', $event)"
      @decrement-item="emit('decrementItem', $event)"
    />
    <DeckSection
      v-for="section in recommendationSections"
      :key="section.key"
      :title="section.label"
      :items="section.items"
      :view-mode="viewMode"
      :description="section.description"
      :eyebrow="section.status"
      :mutating-item-ids="mutatingItemIds"
      :enforce-singleton-quantities="true"
      :show-quantity-actions="showQuantityActions"
      @hover-item="emit('hoverItem', $event)"
      @context-menu="emit('contextMenu', $event)"
      @increment-item="emit('incrementItem', $event)"
      @decrement-item="emit('decrementItem', $event)"
    />
    <DeckSection
      v-if="maybeboardItems.length > 0"
      title="Maybeboard"
      :items="maybeboardItems"
      :view-mode="viewMode"
      :mutating-item-ids="mutatingItemIds"
      :enforce-singleton-quantities="true"
      :show-quantity-actions="showQuantityActions"
      @hover-item="emit('hoverItem', $event)"
      @context-menu="emit('contextMenu', $event)"
      @increment-item="emit('incrementItem', $event)"
      @decrement-item="emit('decrementItem', $event)"
    />
  </div>
</template>

<style scoped>
.template-intro, .land-guide { display: grid; gap: 8px; padding: 22px; border: 1px solid var(--accent-electric-border); border-radius: 24px; background: linear-gradient(135deg, var(--accent-electric-dim), var(--surface-card)); }
.template-intro h2, .template-intro p, .land-guide h3, .land-guide p { margin: 0; }
.template-intro h2 { color: var(--text-light); font-size: 1.35rem; }
.land-guide h3 { color: var(--text-light); font-size: 1.12rem; text-transform: capitalize; }
.template-intro p, .land-guide p { color: var(--text-muted); line-height: 1.5; }
.template-eyebrow { color: var(--accent-electric) !important; font-size: .72rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.template-fallback { color: var(--accent-warm, #fbbf24) !important; }
.template-sections { display: grid; gap: 18px; margin-top: 18px; }
.land-guide { margin-top: 18px; }
.land-guide-rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
.land-guide-row { display: flex; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid var(--surface-border-light); border-radius: 12px; background: rgba(15, 23, 42, .42); }
.land-guide-row > div { display: grid; gap: 4px; }
.land-guide-row strong { color: var(--text-light); }
.land-guide-row small { color: var(--text-muted); line-height: 1.3; }
.land-guide-target { text-align: right; white-space: nowrap; }
</style>
