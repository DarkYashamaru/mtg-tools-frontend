<script setup lang="ts">
import { computed } from 'vue'
import DeckSection from './DeckSection.vue'
import type { CollectionCardContextMenuPayload, CollectionItem, CollectionRecord, WorkspaceViewMode } from './types'

interface Props { collection: CollectionRecord; commanderItems: CollectionItem[]; viewMode: WorkspaceViewMode; mutatingItemIds: Array<string | number>; showQuantityActions?: boolean }
const props = defineProps<Props>()
const emit = defineEmits<{ hoverItem: [item: CollectionItem | null]; contextMenu: [payload: CollectionCardContextMenuPayload]; incrementItem: [item: CollectionItem]; decrementItem: [item: CollectionItem] }>()
const hasCommanderGameplayData = computed(() => props.commanderItems.some((item) => item.gameplay_card !== undefined))
const commanderManaValue = computed(() => props.commanderItems.reduce((total, item) => total + (item.cmc ?? 0), 0))
const roleTargets = computed(() => {
  if (!hasCommanderGameplayData.value) return { ramp: 12, cardAdvantage: 12 }
  const manaValue = commanderManaValue.value
  if (manaValue <= 2) return { ramp: 8, cardAdvantage: 16 }
  if (manaValue === 3) return { ramp: 10, cardAdvantage: 14 }
  if (manaValue === 4) return { ramp: 12, cardAdvantage: 12 }
  if (manaValue <= 6) return { ramp: 14, cardAdvantage: 10 }
  return { ramp: 16, cardAdvantage: 8 }
})
function hasCategory(item: CollectionItem, category: string) { return item.categories?.some((candidate) => candidate.name === category) ?? false }
const nonCommanderItems = computed(() => props.collection.items.filter((item) => item.zone !== 'commander'))
const sections = computed(() => [
  { title: 'Lands', target: 38, items: nonCommanderItems.value.filter((item) => item.card_types?.includes('Land')) },
  { title: 'Card Advantage', target: roleTargets.value.cardAdvantage, items: nonCommanderItems.value.filter((item) => hasCategory(item, 'Draw')) },
  { title: 'Removal', target: 12, items: nonCommanderItems.value.filter((item) => hasCategory(item, 'Removal')) },
  { title: 'Ramp', target: roleTargets.value.ramp, items: nonCommanderItems.value.filter((item) => hasCategory(item, 'Ramp')) },
].map((section) => {
  const actual = section.items.reduce((total, item) => total + item.amount, 0)
  const status = actual < section.target ? 'Below target' : actual > section.target ? 'Above target' : 'On target'
  return { ...section, description: `${actual} / ${section.target} recommended · ${status}`, status }
}))
</script>

<template>
  <section class="template-intro">
    <p class="template-eyebrow">Commander deck guide</p>
    <h2>Recommended deck template</h2>
    <p>This guide is advisory only and does not enforce deck construction requirements.</p>
    <p v-if="!hasCommanderGameplayData" class="template-fallback">Commander gameplay data is unavailable, so Ramp and Card Advantage use the 4-MV baseline.</p>
    <p v-else>Combined commander mana value: {{ commanderManaValue }}.</p>
  </section>
  <div class="template-sections">
    <DeckSection v-for="section in sections" :key="section.title" :title="section.title" :items="section.items" :view-mode="viewMode" :description="section.description" :eyebrow="section.status" :mutating-item-ids="mutatingItemIds" :show-quantity-actions="showQuantityActions" @hover-item="emit('hoverItem', $event)" @context-menu="emit('contextMenu', $event)" @increment-item="emit('incrementItem', $event)" @decrement-item="emit('decrementItem', $event)" />
  </div>
</template>

<style scoped>
.template-intro { display: grid; gap: 8px; padding: 22px; border: 1px solid var(--accent-electric-border); border-radius: 24px; background: linear-gradient(135deg, var(--accent-electric-dim), var(--surface-card)); }
.template-intro h2, .template-intro p { margin: 0; }
.template-intro h2 { color: var(--text-light); font-size: 1.35rem; }
.template-intro p { color: var(--text-muted); line-height: 1.5; }
.template-eyebrow { color: var(--accent-electric) !important; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
.template-fallback { color: var(--accent-warm, #fbbf24) !important; }
.template-sections { display: grid; gap: 18px; }
</style>
