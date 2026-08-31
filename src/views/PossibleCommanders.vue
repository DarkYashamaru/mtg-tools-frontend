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

const activeCollectionId = computed(() => {
  const rawValue = route.params.collectionId
  return typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null
})

type CommanderInsight = {
  commander: GameplayCard
  cardsInColorIdentity: number
  sharedArchetypeCards: number
  sharedCategoryCards: number
}

function getColorIdentitySet(card: GameplayCard): Set<string> {
  return new Set(card.color_identity.map((color) => color.symbol.toUpperCase()))
}

function isColorIdentityLegal(commander: GameplayCard, candidate: GameplayCard): boolean {
  const commanderColors = getColorIdentitySet(commander)
  return candidate.color_identity.every((color) => commanderColors.has(color.symbol.toUpperCase()))
}

function getCardNameSet(values: Array<{ name: string }>): Set<string> {
  return new Set(
    values
      .map((value) => value?.name?.trim())
      .filter((value): value is string => !!value)
  )
}

const commanderInsights = computed<CommanderInsight[]>(() => {
  if (!Array.isArray(collection.value) || !Array.isArray(validCommanders.value)) {
    return []
  }

  return validCommanders.value
    .map((commander) => {
      const commanderArchetypes = getCardNameSet(commander.archetypes)
      const commanderCategories = getCardNameSet(commander.categories)

      let cardsInColorIdentity = 0
      let sharedArchetypeCards = 0
      let sharedCategoryCards = 0

      for (const candidate of collection.value) {
        if (candidate.oracle_id === commander.oracle_id) {
          continue
        }

        if (!isColorIdentityLegal(commander, candidate)) {
          continue
        }

        cardsInColorIdentity += 1

        const candidateArchetypes = getCardNameSet(candidate.archetypes)
        const candidateCategories = getCardNameSet(candidate.categories)

        if ([...candidateArchetypes].some((name) => commanderArchetypes.has(name))) {
          sharedArchetypeCards += 1
        }

        if ([...candidateCategories].some((name) => commanderCategories.has(name))) {
          sharedCategoryCards += 1
        }
      }

      return {
        commander,
        cardsInColorIdentity,
        sharedArchetypeCards,
        sharedCategoryCards,
      }
    })
    .sort((left, right) =>
      right.cardsInColorIdentity - left.cardsInColorIdentity
      || right.sharedArchetypeCards - left.sharedArchetypeCards
      || right.sharedCategoryCards - left.sharedCategoryCards
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
    set_code: null,
    collector_number: null,
    lang: null,
    image_uri: getBestCardImage(item.commander, 0, 'normal'),
    amount: 1,
    zone: 'commander',
    card_insights: [
      { label: 'Cards in color identity', value: item.cardsInColorIdentity },
      { label: 'Cards sharing archetype', value: item.sharedArchetypeCards },
      { label: 'Cards sharing category', value: item.sharedCategoryCards },
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
  store.clearStore()

  try {
    const { cards } = await loadSavedCollectionGameplay({
      collectionId,
      authHeaders,
      routePath: route.fullPath,
      router,
    })
    store.setCollection(cards)
    await loadValidatedCommanderCandidates(cards)
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
        <p class="description">Select a commander to inspect theme support from the cards available in this collection.</p>
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
          description="Choose a commander to inspect its theme support."
          :items="commanderItems"
          view-mode="grid"
          organization-mode="section"
          :show-quantity-actions="false"
          :hide-singleton-amount="true"
          @card-click="handleCommanderCardClick"
        />
      </section>
    </div>
  </div>
</template>

<style scoped src="./PossibleCommanders.css"></style>
