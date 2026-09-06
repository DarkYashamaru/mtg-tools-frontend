<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCollectionStore } from '../stores/collectionStore'
import { useAuthStore } from '@/stores/authStore'
import { loadSavedCollectionGameplay } from '@/composables/useSavedCollectionGameplay'
import DeckSection from '@/components/collection/DeckSection.vue'
import { getBestCardImage } from '@/components/cards/cardDisplay'
import type { CollectionItem } from '@/components/collection/types'
import type { GameplayCard } from '@/types/gameplayCard'

const router = useRouter()
const route = useRoute()
const store = useCollectionStore()
const authStore = useAuthStore()

// Bind seamlessly to the reactive store evaluation layer
const { collection, validCommanders } = storeToRefs(store)
const { authHeaders } = storeToRefs(authStore)
const isLoading = ref(false)
const errorMessage = ref('')
const rarityByOracleId = ref<Map<string, string>>(new Map())

const RARITY_SCORE: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  mythic: 3,
}

const activeCollectionId = computed(() => {
  const rawValue = route.params.collectionId
  return typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null
})

type CommanderInsight = {
  commander: GameplayCard
  cardsInColorIdentity: number
  rarity: string | null
  rarityScore: number
}

const COLOR_BITS: Record<string, number> = { W: 1, U: 2, B: 4, R: 8, G: 16 }

function colorIdentityMask(card: GameplayCard): number {
  return card.color_identity.reduce(
    (mask, color) => mask | (COLOR_BITS[color.symbol.toUpperCase()] ?? 0),
    0,
  )
}

function normalizedRarity(value: string | null | undefined): string | null {
  const rarity = value?.trim().toLowerCase()
  return rarity && rarity in RARITY_SCORE ? rarity : null
}

function highestRarityByOracleId(items: CollectionItem[]): Map<string, string> {
  const rarities = new Map<string, string>()

  for (const item of items) {
    const oracleId = item.oracle_id?.trim()
    const rarity = normalizedRarity(item.rarity)
    if (!oracleId || !rarity) continue

    const currentRarity = rarities.get(oracleId)
    if (!currentRarity || RARITY_SCORE[rarity] > RARITY_SCORE[currentRarity]) {
      rarities.set(oracleId, rarity)
    }
  }

  return rarities
}

const commanderInsights = computed<CommanderInsight[]>(() => {
  if (!Array.isArray(collection.value) || !Array.isArray(validCommanders.value)) {
    return []
  }

  const cardCountsByColorMask = Array.from({ length: 32 }, () => 0)
  for (const card of collection.value) {
    cardCountsByColorMask[colorIdentityMask(card)] += 1
  }

  return validCommanders.value
    .map((commander) => {
      const commanderMask = colorIdentityMask(commander)
      let cardsInColorIdentity = 0

      for (let candidateMask = 0; candidateMask < cardCountsByColorMask.length; candidateMask += 1) {
        if ((candidateMask & ~commanderMask) === 0) {
          cardsInColorIdentity += cardCountsByColorMask[candidateMask]
        }
      }

      const rarity = rarityByOracleId.value.get(commander.oracle_id) ?? null
      return {
        commander,
        cardsInColorIdentity: cardsInColorIdentity - 1,
        rarity,
        rarityScore: rarity ? RARITY_SCORE[rarity] : 0,
      }
    })
    .sort((left, right) =>
      right.cardsInColorIdentity - left.cardsInColorIdentity
      || right.rarityScore - left.rarityScore
      || left.commander.name.localeCompare(right.commander.name)
    )
})

const commanderItems = computed<CollectionItem[]>(() => (
  commanderInsights.value.map((item) => ({
    id: item.commander.oracle_id,
    card_id: item.commander.oracle_id,
    oracle_id: item.commander.oracle_id,
    name: item.commander.name,
    cmc: item.commander.cmc ?? 0,
    card_types: Array.from(new Set(item.commander.faces.flatMap((face) => face.card_types ?? []))),
    color_identity: item.commander.color_identity,
    rarity: item.rarity,
    set_code: null,
    collector_number: null,
    lang: null,
    image_uri: getBestCardImage(item.commander, 0, 'normal'),
    amount: 1,
    zone: 'commander',
    card_insights: [
      { label: 'Cards in color identity', value: item.cardsInColorIdentity },
      { label: 'Rarity score', value: item.rarityScore },
    ],
  }))
))



async function loadValidatedCommanderCandidates(cards: GameplayCard[]) {
  const response = await fetch('/api/commanders/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selections: cards.map((card) => [card.oracle_id]) }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success || !Array.isArray(data.results)) {
    throw new Error(data.error || 'Unable to validate commander candidates.')
  }

  store.setValidCommanderOracleIds(
    data.results
      .filter((result: { valid?: boolean; oracle_ids?: string[] }) => result.valid)
      .flatMap((result: { oracle_ids?: string[] }) => result.oracle_ids ?? [])
  )
}
async function loadCollectionFromBackend(collectionId: string) {
  isLoading.value = true
  errorMessage.value = ''
  rarityByOracleId.value = new Map()

  try {
    const { collection: savedCollection, cards } = await loadSavedCollectionGameplay({
      collectionId,
      authHeaders,
      routePath: route.fullPath,
      router,
    })
    rarityByOracleId.value = highestRarityByOracleId(savedCollection.items)
    if (store.validCommanderOracleIds.length === 0) {
      await loadValidatedCommanderCandidates(cards)
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load collection data.'
  } finally {
    isLoading.value = false
  }
}

function handleCommanderClick(oracleId: string) {
  store.selectCommander(oracleId)
  if (activeCollectionId.value) {
    router.push({
      name: 'collection-select-commander-theme',
      params: {
        collectionId: activeCollectionId.value,
        commanderId: oracleId,
      },
    })
    return
  }

  router.push('/tools/bulk-deck-builder/select-commander-theme')
}

function handleCommanderCardClick(item: CollectionItem) {
  if (item.oracle_id) {
    handleCommanderClick(item.oracle_id)
  }
}

function goBackToImporter() {
  if (activeCollectionId.value) {
    router.push(`/tools/bulk-deck-builder/collections/${activeCollectionId.value}`)
    return
  }

  router.push('/tools/bulk-deck-builder')
}

onMounted(() => {
  if (activeCollectionId.value) {
    loadCollectionFromBackend(activeCollectionId.value)
  } else if (collection.value.length > 0) {
    void loadValidatedCommanderCandidates(collection.value)
  }
})
</script>

<template>
  <div class="container">
    <div class="header-action-row">
      <div>
        <h1>Possible Commanders</h1>
        <p class="description">Commander candidates are ranked by cards in their color identity, then by rarity.</p>
      </div>
      <button class="nav-back-btn" @click="goBackToImporter">← Import Different Deck</button>
    </div>

    <div v-if="!collection || collection.length === 0" class="empty-state">
      <h3 v-if="isLoading">Loading Collection</h3>
      <p v-if="isLoading">Resolving gameplay cards for this saved collection...</p>

      <template v-else>
      <h3>No Active Workspace Data Found</h3>
      <p>{{ errorMessage || 'Please import or paste your card collection data first to run evaluation scores.' }}</p>
      <button class="redirect-btn" @click="goBackToImporter">Go to Importer</button>
      </template>
    </div>

    <div v-else class="results-layout">
      <div class="stats-summary">
        <p>Total Collection Size: <strong>{{ collection.length }}</strong></p>
        <p>Potential Commanders Found: <strong>{{ validCommanders?.length || 0 }}</strong></p>
      </div>

      <section class="commander-section">
        <DeckSection
          title="Commander Candidates"
          eyebrow="Collection analysis"
          description="Ranked by color-identity coverage, then rarity."
          :items="commanderItems"
          view-mode="grid"
          organization-mode="zone"
          :show-quantity-actions="false"
          :hide-singleton-amount="true"
          @card-click="handleCommanderCardClick"
        />
      </section>
    </div>
  </div>
</template>

<style scoped src="./PossibleCommanders.css"></style>
