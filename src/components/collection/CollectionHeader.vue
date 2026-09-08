<script setup lang="ts">
import { computed } from 'vue'
import type { CollectionRecord, DeckLegalityResult } from './types'

interface Props {
  collection: CollectionRecord
  deckValueUsd?: number
  legalityResult?: DeckLegalityResult | null
  isValidatingDeck?: boolean
  showDeckMetrics?: boolean
  showCommanderBuilderAction?: boolean
  showCommanderBuilderResumeAction?: boolean
  commanderBuilderOpen?: boolean
  showMasterSearchAction?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showCommanderBuilderAction: false,
  showCommanderBuilderResumeAction: false,
  commanderBuilderOpen: false,
  showMasterSearchAction: false,
  deckValueUsd: 0,
  legalityResult: null,
  isValidatingDeck: false,
  showDeckMetrics: false,
})
defineEmits<{
  createCommanderDeck: []
  openCommanderBuilder: []
  searchMasterCollection: []
  validateDeck: []
}>()

const commanderCards = computed(() => props.collection.commander_cards ?? [])
const commanderLabel = computed(() => {
  if (commanderCards.value.length > 0) {
    const names = commanderCards.value
      .map((card) => card.name?.trim())
      .filter((name): name is string => !!name)

    return names.length > 0 ? names.join(' + ') : null
  }

  return props.collection.commander_name
})

const commanderHeroImage = computed(() => {
  if (commanderCards.value.length > 0) {
    return commanderCards.value[0]?.image_uri ?? props.collection.commander_image_uri
  }

  return props.collection.commander_image_uri
})

function collectionSubtitle(collection: CollectionRecord) {
  if (collection.is_virtual) {
    const sourceCount = collection.source_collection_count ?? 0
    const label = sourceCount === 1 ? '1 collection' : `${sourceCount} collections`
    return `Read-only aggregate across ${label}`
  }

  const deckType = collection.deck_type.toLowerCase()

  if (deckType === 'commander') {
    return commanderLabel.value
      ? `Commander: ${commanderLabel.value}`
      : 'Commander deck'
  }

  if (deckType === 'standard') {
    return 'Standard deck'
  }

  return 'Binder collection'
}

const isCommanderDeck = computed(() => props.collection.deck_type.toLowerCase() === 'commander')
const formattedDeckValue = computed(() => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(props.deckValueUsd ?? 0))
</script>

<template>
  <header
    class="collection-header"
    :class="{
      'has-art': !!commanderHeroImage && collection.deck_type.toLowerCase() === 'commander',
    }"
  >
    <img
      v-if="commanderHeroImage && collection.deck_type.toLowerCase() === 'commander'"
      :src="commanderHeroImage"
      :alt="commanderLabel || collection.name"
      class="header-art"
      loading="lazy"
    >

    <div class="header-overlay"></div>

    <div class="header-copy">
      <span class="eyebrow">{{ collection.deck_type }}</span>
      <h1>{{ collection.name }}</h1>
      <p class="subtitle">{{ collectionSubtitle(collection) }}</p>

      <div class="meta-row">
        <span class="meta-pill">{{ collection.item_count }} cards</span>
        <span v-if="collection.is_read_only" class="meta-pill">Read-only</span>
        <span v-if="commanderLabel" class="meta-pill commander-pill">{{ commanderLabel }}</span>
      </div>

      <div v-if="isCommanderDeck && showDeckMetrics" class="deck-metrics">
        <span class="metric-label">Deck value</span>
        <strong>{{ formattedDeckValue }} USD</strong>
        <button class="secondary-action" type="button" :disabled="isValidatingDeck" @click="$emit('validateDeck')">
          {{ isValidatingDeck ? 'Validating…' : 'Validate deck' }}
        </button>
      </div>

      <div v-if="legalityResult" class="legality-result" :class="legalityResult.legal ? 'is-legal' : 'is-illegal'">
        <strong>{{ legalityResult.legal ? 'Commander deck is legal.' : 'Commander deck is not legal.' }}</strong>
        <ul v-if="!legalityResult.legal">
          <li v-if="!legalityResult.checks.card_count.valid">
            {{ legalityResult.checks.card_count.actual }} of {{ legalityResult.checks.card_count.required }} cards.
          </li>
          <li v-if="!legalityResult.checks.commander.valid">Choose a commander to validate color identity.</li>
          <li v-if="!legalityResult.checks.duplicates.valid">
            Duplicate nonbasic cards: {{ legalityResult.checks.duplicates.cards.map((card) => `${card.name ?? 'Unknown card'} (${card.copies})`).join(', ') }}.
          </li>
          <li v-if="!legalityResult.checks.color_identity.valid && legalityResult.checks.commander.valid">
            Off-color cards: {{ legalityResult.checks.color_identity.cards.map((card) => `${card.name ?? 'Unknown card'} (${card.colors.join('')})`).join(', ') }}.
          </li>
        </ul>
      </div>

      <div v-if="showCommanderBuilderAction || showCommanderBuilderResumeAction || showMasterSearchAction" class="action-row">
        <button v-if="showCommanderBuilderAction" class="primary-action" type="button" @click="$emit('createCommanderDeck')">
          Create commander deck from collection
        </button>
        <button v-if="showCommanderBuilderResumeAction" class="primary-action" type="button" :aria-pressed="commanderBuilderOpen" @click="$emit('openCommanderBuilder')">
          {{ commanderBuilderOpen ? 'Close Card Pool' : 'Browse Card Pool' }}
        </button>
        <button v-if="showMasterSearchAction" class="secondary-action" type="button" @click="$emit('searchMasterCollection')">
          Advanced search this pool
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.collection-header {
  position: relative;
  overflow: hidden;
  padding: 28px;
  border-radius: 28px;
  border: 1px solid var(--surface-border-light);
  background:
    linear-gradient(135deg, rgba(56, 189, 248, 0.16), rgba(15, 23, 42, 0.96)),
    var(--surface-card);
  box-shadow: var(--shadow-lg);
  min-height: 210px;
}

.header-art {
  position: absolute;
  inset: -5%;
  width: 110%;
  height: 110%;
  object-fit: cover;
  filter: blur(22px) saturate(0.9);
  opacity: 0.34;
  transform: scale(1.08);
}

.header-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(9, 13, 22, 0.34), rgba(9, 13, 22, 0.88)),
    linear-gradient(90deg, rgba(9, 13, 22, 0.96), rgba(9, 13, 22, 0.54));
}

.header-copy {
  position: relative;
  z-index: 1;
  max-width: 720px;
}

.eyebrow {
  display: inline-block;
  margin-bottom: 10px;
  color: var(--accent-electric);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: var(--text-light);
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.04;
}

.subtitle {
  margin: 10px 0 0;
  color: var(--text-main);
  font-size: 1rem;
  line-height: 1.5;
}

.meta-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.action-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.deck-metrics {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
  color: var(--text-light);
}

.metric-label {
  color: var(--text-main);
  font-size: 0.9rem;
}

.legality-result {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--surface-border-light);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.72);
  color: var(--text-light);
}

.legality-result.is-legal {
  border-color: rgba(74, 222, 128, 0.6);
}

.legality-result.is-illegal {
  border-color: rgba(251, 113, 133, 0.65);
}

.legality-result ul {
  margin: 8px 0 0;
  padding-left: 20px;
  color: var(--text-main);
}

.meta-pill {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.72);
  color: var(--text-main);
  font-size: 0.88rem;
  font-weight: 700;
}

.commander-pill {
  border-color: var(--accent-electric-border);
  color: var(--accent-electric);
}

.primary-action {
  padding: 12px 16px;
  border: none;
  border-radius: 14px;
  background: var(--accent-electric);
  color: #07121a;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
}

.secondary-action {
  padding: 12px 16px;
  border: 1px solid var(--surface-border-light);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.72);
  color: var(--text-light);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
}

.secondary-action:disabled {
  cursor: wait;
  opacity: 0.65;
}
/* Compact deck identity and action toolbar */
.collection-header { min-height: 0; padding: 18px 20px; border-radius: 20px; }
.header-art { opacity: 0.18; filter: blur(18px) saturate(0.8); }
.header-copy { max-width: none; display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto auto auto; align-items: center; column-gap: 22px; }
.header-copy > .eyebrow, .header-copy > h1, .header-copy > .subtitle, .header-copy > .meta-row { grid-column: 1; }
.header-copy > .eyebrow { grid-row: 1; margin-bottom: 4px; }
.header-copy > h1 { grid-row: 2; font-size: clamp(1.4rem, 2.5vw, 2rem); }
.header-copy > .subtitle { grid-row: 3; margin-top: 5px; }
.header-copy > .meta-row { grid-row: 4; margin-top: 10px; }
.header-copy > .deck-metrics { grid-column: 2; grid-row: 1; margin-top: 0; justify-self: end; }
.header-copy > .action-row { grid-column: 2; grid-row: 2; margin-top: 4px; justify-self: end; }
.header-copy > .legality-result { grid-column: 2; grid-row: 3 / span 2; margin-top: 8px; max-width: 620px; }
@media (max-width: 780px) { .header-copy { grid-template-columns: 1fr; } .header-copy > .deck-metrics, .header-copy > .action-row, .header-copy > .legality-result { grid-column: 1; grid-row: auto; justify-self: start; } .header-copy > .deck-metrics { margin-top: 14px; } }
</style>
