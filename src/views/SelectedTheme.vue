<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CommanderHero from '@/components/CommanderHero.vue'
import DeckSection from '@/components/collection/DeckSection.vue'
import { createCustomTheme, isCustomThemeId } from '@/constants/commanderThemes'
import { useAuthStore } from '@/stores/authStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { loadSavedCollectionGameplay } from '@/composables/useSavedCollectionGameplay'
import type { CollectionItem } from '@/components/collection/types'
import type { CommanderSupportEntry, CommanderSupportResponse } from '@/types/commanderSupport'
import type { Card, CardThemeResponse } from '@/utils/deckScorer'
import { getBestCardImage } from '@/components/cards/cardDisplay'

type CardPool = 'collection' | 'all'
type CardTileSource = Pick<CollectionItem, 'card_id' | 'image_uri' | 'zone'>

type OverviewCardEntry = {
  card: Card
  score: number
  reasons: NonNullable<CollectionItem['commander_support_reasons']>
  score_breakdown?: NonNullable<CollectionItem['score_breakdown']>
  owned: boolean
  source_item?: CardTileSource
}

type OverviewSection = {
  key: string
  title: string
  description: string
  entries: OverviewCardEntry[]
  entry_total?: number
  returned_total?: number
}

type OverviewResponse = {
  success: boolean
  candidate_total: number
  sections: OverviewSection[]
  commander_support: CommanderSupportResponse
}

type CardOverviewGroup = OverviewSection & { items: CollectionItem[] }

type CommanderSupportGroup = {
  key: string
  title: string
  description: string
  entries: CommanderSupportEntry[]
  items: CollectionItem[]
}

const router = useRouter()
const route = useRoute()
const store = useCollectionStore()
const authStore = useAuthStore()
const { authHeaders } = storeToRefs(authStore)

const activeCommander = ref<Card | null>(null)
const activeTheme = ref<CardThemeResponse | null>(null)
const collectionCards = ref<Card[]>([])
const collectionOverview = ref<OverviewResponse | null>(null)
const allOverview = ref<OverviewResponse | null>(null)
const selectedCardPool = ref<CardPool>('collection')
const hasLoadedAllCards = ref(false)
const isLoadingAllCards = ref(false)
const allCardsError = ref('')
const isLoading = ref(true)
const isStartingBuilder = ref(false)
const errorMessage = ref('')

const activeCollectionId = computed(() => {
  const rawValue = route.params.collectionId
  return typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null
})

const activeCommanderId = computed(() => {
  const rawValue = route.params.commanderId
  return typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null
})

const activeThemeId = computed(() => {
  const rawValue = route.params.themeId
  if (typeof rawValue !== 'string' || rawValue.length === 0) return null
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? parsed : null
})

const activeOverview = computed(() => (
  selectedCardPool.value === 'all' ? allOverview.value : collectionOverview.value
))

const commanderSupport = computed(() => activeOverview.value?.commander_support ?? null)
const selectedPoolLabel = computed(() => (
  selectedCardPool.value === 'collection' ? 'My Collection' : 'All Cards'
))
const poolDescription = computed(() => (
  selectedCardPool.value === 'collection'
    ? 'This view surfaces color-legal cards from your collection that match the core deck-building roles we care about next: ramp, card advantage, spot removal, and board wipes.'
    : 'This view surfaces every color-legal Commander card, so you can compare upgrades outside your current collection using the same role groups and ordering.'
))

const overviewGroups = computed<CardOverviewGroup[]>(() => (
  (activeOverview.value?.sections ?? []).map((section) => ({
    ...section,
    items: section.entries.map((entry, index) => overviewEntryToCollectionItem(section.key, entry, index)),
  }))
))

const matchedCardTotal = computed(() => {
  const uniqueCards = new Set<string>()
  for (const group of overviewGroups.value) {
    for (const entry of group.entries) uniqueCards.add(entry.card.oracle_id)
  }
  return uniqueCards.size
})

function sectionDescription(section: OverviewSection): string {
  if (!section.entry_total || section.entry_total <= section.entries.length) {
    return section.description
  }
  return section.description + " Showing the top " + section.entries.length + " of " + section.entry_total + " matches."
}

const commanderSupportGroups = computed<CommanderSupportGroup[]>(() => {
  if (!commanderSupport.value?.supported) return []
  return (commanderSupport.value.bucket_metadata ?? []).map((bucket) => {
    const entries = commanderSupport.value?.buckets?.[bucket.key] ?? []
    return {
      key: bucket.key,
      title: bucket.title,
      description: bucket.description,
      entries,
      items: entries.map((entry, index) => commanderSupportEntryToCollectionItem(entry, index)),
    }
  })
})

const commanderSupportCardTotal = computed(() => (
  commanderSupportGroups.value.reduce((sum, group) => sum + group.entries.length, 0)
))

async function loadSelectedThemePage() {
  if (!activeCollectionId.value || !activeCommanderId.value || activeThemeId.value === null) {
    errorMessage.value = 'Missing collection, commander, or theme identifier.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  try {
    const { cards } = await loadSavedCollectionGameplay({
      collectionId: activeCollectionId.value,
      authHeaders,
      routePath: route.fullPath,
      router,
    })
    collectionCards.value = cards
    store.setCollection(cards)
    store.selectCommander(activeCommanderId.value)
    activeCommander.value = cards.find((card) => card.oracle_id === activeCommanderId.value) ?? null
    if (!activeCommander.value) throw new Error('The selected commander is not present in this collection.')

    if (isCustomThemeId(activeThemeId.value)) {
      activeTheme.value = createCustomTheme()
    } else {
      const response = await fetch(`/api/themes/by-commander/${activeCommanderId.value}`)
      if (!response.ok) throw new Error('Failed to pull commander theme profiles.')
      const themes = await response.json()
      activeTheme.value = Array.isArray(themes)
        ? themes.find((theme) => Number(theme.theme_id) === activeThemeId.value) ?? null
        : null
    }
    if (!activeTheme.value) throw new Error('The selected theme was not found for this commander.')

    store.setSelectedTheme(activeTheme.value)
    collectionOverview.value = await loadOverview('collection')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load selected theme.'
  } finally {
    isLoading.value = false
  }
}

async function loadOverview(pool: CardPool): Promise<OverviewResponse> {
  if (!activeCollectionId.value || !activeCommander.value) throw new Error('Commander overview is unavailable.')
  const response = await fetch(
    `/api/commander-overview/${activeCollectionId.value}/${activeCommander.value.oracle_id}?scope=${pool}`,
    { headers: { ...authHeaders.value } },
  )
  const payload = await response.json().catch(() => null)
  if (response.status === 401) {
    authStore.logout()
    await router.replace({ name: 'login', query: { redirect: route.fullPath } })
    throw new Error('Authentication required.')
  }
  if (!response.ok || !payload?.success || !Array.isArray(payload.sections)) {
    throw new Error(payload?.error || 'Unable to load the commander card overview.')
  }
  return payload as OverviewResponse
}

async function selectCardPool(pool: CardPool) {
  if (pool === 'collection') {
    selectedCardPool.value = pool
    allCardsError.value = ''
    return
  }
  if (hasLoadedAllCards.value) {
    selectedCardPool.value = pool
    return
  }
  if (!activeCommander.value || isLoadingAllCards.value) return

  selectedCardPool.value = pool
  isLoadingAllCards.value = true
  allCardsError.value = ''
  try {
    allOverview.value = await loadOverview('all')
    hasLoadedAllCards.value = true
  } catch (error) {
    selectedCardPool.value = 'collection'
    allCardsError.value = error instanceof Error ? error.message : 'Unable to load the full Commander card pool.'
  } finally {
    isLoadingAllCards.value = false
  }
}

function createCardTileItem({
  card,
  id,
  score,
  reasons = [],
  scoreBreakdown,
  sourceItem,
}: {
  card: Card
  id: string
  score: number
  reasons?: NonNullable<CollectionItem['commander_support_reasons']>
  scoreBreakdown?: NonNullable<CollectionItem['score_breakdown']>
  sourceItem?: CardTileSource
}): CollectionItem {
  return {
    id,
    card_id: sourceItem?.card_id ?? id,
    oracle_id: card.oracle_id,
    name: card.name,
    commander_support_score: score,
    commander_support_reasons: reasons,
    score_breakdown: scoreBreakdown,
    cmc: card.cmc ?? 0,
    card_types: Array.from(new Set(card.faces.flatMap((face) => face.card_types ?? []))),
    set_code: null,
    collector_number: null,
    lang: null,
    image_uri: sourceItem?.image_uri ?? getBestCardImage(card, 0, 'normal'),
    amount: 1,
    zone: sourceItem?.zone ?? 'mainboard',
    categories: card.categories ?? [],
    archetypes: card.archetypes ?? [],
  }
}

function overviewEntryToCollectionItem(sectionKey: string, entry: OverviewCardEntry, index: number): CollectionItem {
  return createCardTileItem({
    card: entry.card,
    id: `${selectedCardPool.value}-${sectionKey}-${entry.card.oracle_id}-${index}`,
    score: entry.score,
    reasons: entry.reasons ?? [],
    scoreBreakdown: entry.score_breakdown,
    sourceItem: entry.source_item,
  })
}

function commanderSupportEntryToCollectionItem(entry: CommanderSupportEntry, index: number): CollectionItem {
  return createCardTileItem({
    card: entry.card,
    id: `${entry.bucket}-${entry.oracle_id}-${index}`,
    score: entry.score,
    reasons: entry.reasons,
    sourceItem: entry.source_item,
  })
}

function goBack() {
  if (activeCollectionId.value && activeCommanderId.value) {
    router.push({
      name: 'collection-select-commander-theme',
      params: { collectionId: activeCollectionId.value, commanderId: activeCommanderId.value },
    })
    return
  }
  router.push('/tools/bulk-deck-builder/select-commander-theme')
}

function openCardDetail(oracleId: string) {
  const routeData = router.resolve({ name: 'card-detail', params: { id: oracleId } })
  window.open(routeData.href, '_blank')
}

function handleSectionCardClick(item: CollectionItem) {
  if (item.oracle_id) openCardDetail(item.oracle_id)
}

async function startConstructingDeck() {
  if (!activeCommander.value || !activeCollectionId.value || !activeThemeId.value || !activeTheme.value || isStartingBuilder.value) return
  isStartingBuilder.value = true
  errorMessage.value = ''
  try {
    const response = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders.value },
      body: JSON.stringify({
        name: `${activeCommander.value.name} ${activeTheme.value.name} Deck`,
        deck_type: 'Commander',
        deck_text: `Commander\n1 ${activeCommander.value.name}`,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      authStore.logout()
      await router.replace({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    if (!response.ok || !data.success || !data.collection?.id) {
      throw new Error(data.error || 'Unable to start commander builder.')
    }
    await router.push({
      name: 'commander-builder',
      params: {
        collectionId: activeCollectionId.value,
        commanderId: activeCommanderId.value,
        themeId: activeThemeId.value,
        builderCollectionId: data.collection.id,
      },
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to start commander builder.'
  } finally {
    isStartingBuilder.value = false
  }
}

onMounted(() => { loadSelectedThemePage() })
</script>
<template>
  <div class="workspace-page">
    <section class="workspace-shell">
      <div class="nav-row">
        <button class="back-button" type="button" @click="goBack">
          Back to Theme Selection
        </button>
      </div>

      <div v-if="isLoading" class="loading-panel skeleton-pulse">
        <div class="loading-copy">
          <h2>Loading strategy workspace...</h2>
        </div>
      </div>

      <div v-else-if="!activeCommander || !activeTheme || errorMessage" class="state-panel error">
        <h2>No strategy workspace active</h2>
        <p>{{ errorMessage || 'Return to theme selection and choose both a commander and an active strategy profile.' }}</p>
      </div>

      <div v-else class="page-stack">
        <CommanderHero :commander="activeCommander" show-tags>
          <template #banner>
            <div class="theme-banner">
              Active Strategy: <strong>{{ activeTheme.name }}</strong>
            </div>
          </template>
        </CommanderHero>

        <section class="overview-intro">
          <div>
            <p class="eyebrow">Deck Building Overview</p>
            <h2>Category Snapshot Before Assembly</h2>
          </div>
          <p class="intro-copy">{{ poolDescription }}</p>

          <div class="card-pool-toggle" role="group" aria-label="Card pool">
            <button
              class="card-pool-button"
              :class="{ active: selectedCardPool === 'collection' }"
              type="button"
              :aria-pressed="selectedCardPool === 'collection'"
              :disabled="isLoadingAllCards"
              @click="selectCardPool('collection')"
            >
              My Collection
            </button>
            <button
              class="card-pool-button"
              :class="{ active: selectedCardPool === 'all' }"
              type="button"
              :aria-pressed="selectedCardPool === 'all'"
              :disabled="isLoadingAllCards"
              @click="selectCardPool('all')"
            >
              {{ isLoadingAllCards ? 'Loading All Cards…' : 'All Cards / Upgrades' }}
            </button>
          </div>
          <p v-if="isLoadingAllCards" class="pool-loading" role="status">
            Loading the full Commander card pool. This can take a moment for larger color identities.
          </p>
          <p v-else-if="allCardsError" class="pool-error">{{ allCardsError }}</p>

          <div class="summary-strip">
            <div class="summary-chip">
              <span class="summary-label">{{ selectedPoolLabel }} Color-Legal Pool</span>
              <strong>{{ activeOverview?.candidate_total ?? 0 }}</strong>
            </div>
            <div class="summary-chip">
              <span class="summary-label">Tagged Matches</span>
              <strong>{{ matchedCardTotal }}</strong>
            </div>
            <div class="summary-chip">
              <span class="summary-label">Active Theme</span>
              <strong>{{ activeTheme.name }}</strong>
            </div>
            <div v-if="commanderSupport?.supported" class="summary-chip">
              <span class="summary-label">Commander Synergy Picks</span>
              <strong>{{ commanderSupportCardTotal }}</strong>
            </div>
          </div>

          <div class="overview-actions">
            <button
              class="start-builder-button"
              type="button"
              :disabled="isStartingBuilder"
              @click="startConstructingDeck"
            >
              Start Constructing Deck
            </button>
          </div>
        </section>

        <section v-if="commanderSupportGroups.length" class="support-spotlight">
          <div class="support-spotlight-header">
            <div>
              <p class="eyebrow">Commander Support</p>
              <h2>Commander-Specific Synergy Spotlight</h2>
            </div>
            <p class="support-spotlight-copy">
              These picks come from the commander-specific profile and are ranked for this commander before you enter the full builder.
            </p>
          </div>

          <DeckSection
            v-for="group in commanderSupportGroups"
            :key="group.key"
            :title="group.title"
            :eyebrow="group.key"
            :description="group.description"
            :items="group.items"
            view-mode="grid"
            organization-mode="section"
            :show-quantity-actions="false"
            :hide-singleton-amount="true"
            collapsible
            @card-click="handleSectionCardClick"
          />
        </section>

        <section class="workspace-stack">
          <DeckSection
            v-for="group in overviewGroups"
            :key="`${selectedCardPool}-${group.key}`"
            :title="group.title"
            :eyebrow="group.key"
            :description="sectionDescription(group)"
            :items="group.items"
            view-mode="grid"
            organization-mode="section"
            :show-quantity-actions="false"
            :hide-singleton-amount="true"
            collapsible
            :initially-collapsed="true"
            @card-click="handleSectionCardClick"
          />
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped src="./SelectedTheme.css"></style>
