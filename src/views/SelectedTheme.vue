<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CommanderHero from '@/components/CommanderHero.vue'
import DeckSection from '@/components/collection/DeckSection.vue'
import { useAuthStore } from '@/stores/authStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { loadSavedCollectionGameplay } from '@/composables/useSavedCollectionGameplay'
import type { CollectionItem } from '@/components/collection/types'
import type { Card, CardThemeResponse } from '@/utils/deckScorer'

type OverviewBucket = {
  key: string
  title: string
  description: string
  tagSlug: string
}

type CardOverviewGroup = OverviewBucket & {
  cards: Card[]
  items: CollectionItem[]
}

const OVERVIEW_BUCKETS: OverviewBucket[] = [
  {
    key: 'ramp',
    title: 'Ramp',
    description: 'Cards tagged to accelerate mana and push the deck ahead on resources.',
    tagSlug: 'ramp',
  },
  {
    key: 'card-advantage',
    title: 'Card Advantage',
    description: 'Cards tagged to generate extra cards, selection, or sustained advantage.',
    tagSlug: 'card-advantage',
  },
  {
    key: 'spot-removal',
    title: 'Spot Removal',
    description: 'Cards tagged to answer a single threat efficiently.',
    tagSlug: 'spot-removal',
  },
  {
    key: 'sweeper',
    title: 'Board Wipe',
    description: 'Cards tagged to reset the board or clear multiple permanents.',
    tagSlug: 'sweeper',
  },
]

const router = useRouter()
const route = useRoute()
const store = useCollectionStore()
const authStore = useAuthStore()
const { authHeaders } = storeToRefs(authStore)

const activeCommander = ref<Card | null>(null)
const activeTheme = ref<CardThemeResponse | null>(null)
const collectionCards = ref<Card[]>([])
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
  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return null
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? parsed : null
})

const colorLegalCards = computed(() => {
  if (!activeCommander.value) {
    return []
  }

  const commanderColors = new Set(activeCommander.value.color_identity.map((color) => color.symbol.toUpperCase()))

  return collectionCards.value
    .filter((card) => card.oracle_id !== activeCommander.value?.oracle_id)
    .filter((card) => card.color_identity.every((color) => commanderColors.has(color.symbol.toUpperCase())))
    .sort((left, right) => {
      const cmcDifference = (left.cmc ?? 0) - (right.cmc ?? 0)
      if (cmcDifference !== 0) {
        return cmcDifference
      }

      return left.name.localeCompare(right.name)
    })
})

const overviewGroups = computed<CardOverviewGroup[]>(() => (
  OVERVIEW_BUCKETS.map((bucket) => ({
    ...bucket,
    cards: colorLegalCards.value.filter((card) => getCardTags(card).has(bucket.tagSlug)),
    items: colorLegalCards.value
      .filter((card) => getCardTags(card).has(bucket.tagSlug))
      .map((card, index) => toCollectionItem(card, bucket.key, index)),
  }))
))

const matchedCardTotal = computed(() => {
  const uniqueCards = new Set<string>()

  for (const group of overviewGroups.value) {
    for (const card of group.cards) {
      uniqueCards.add(card.oracle_id)
    }
  }

  return uniqueCards.size
})

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
    if (!activeCommander.value) {
      throw new Error('The selected commander is not present in this collection.')
    }

    const response = await fetch(`/api/themes/by-commander/${activeCommanderId.value}`)
    if (!response.ok) {
      throw new Error('Failed to pull commander theme profiles.')
    }

    const themes = await response.json()
    activeTheme.value = Array.isArray(themes)
      ? themes.find((theme) => Number(theme.theme_id) === activeThemeId.value) ?? null
      : null

    if (!activeTheme.value) {
      throw new Error('The selected theme was not found for this commander.')
    }

    store.setSelectedTheme(activeTheme.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load selected theme.'
  } finally {
    isLoading.value = false
  }
}

function getCardTags(card: Card): Set<string> {
  const tagSet = new Set<string>()

  for (const tag of card.tags?.direct ?? []) {
    if (tag?.slug) {
      tagSet.add(tag.slug)
    }
  }

  for (const tag of card.tags?.inherited ?? []) {
    if (tag?.slug) {
      tagSet.add(tag.slug)
    }
  }

  return tagSet
}

function toCollectionItem(card: Card, groupKey: string, index: number): CollectionItem {
  return {
    id: index + 1,
    card_id: `${groupKey}-${card.oracle_id}`,
    oracle_id: card.oracle_id,
    name: card.name,
    cmc: card.cmc ?? 0,
    card_types: Array.from(new Set(card.faces.flatMap((face) => face.card_types ?? []))),
    set_code: null,
    collector_number: null,
    lang: null,
    image_uri: card.faces[0]?.normal_image ?? card.faces[0]?.small_image ?? card.faces[0]?.large_image ?? null,
    amount: 1,
    zone: 'mainboard',
    categories: card.categories ?? [],
    archetypes: card.archetypes ?? [],
  }
}

function goBack() {
  if (activeCollectionId.value && activeCommanderId.value) {
    router.push({
      name: 'collection-select-commander-theme',
      params: {
        collectionId: activeCollectionId.value,
        commanderId: activeCommanderId.value,
      },
    })
    return
  }

  router.push('/tools/bulk-deck-builder/select-commander-theme')
}

function openCardDetail(oracleId: string) {
  const routeData = router.resolve({
    name: 'card-detail',
    params: { id: oracleId },
  })
  window.open(routeData.href, '_blank')
}

function handleSectionCardClick(item: CollectionItem) {
  if (item.oracle_id) {
    openCardDetail(item.oracle_id)
  }
}

async function startConstructingDeck() {
  if (!activeCommander.value || !activeCollectionId.value || !activeThemeId.value || !activeTheme.value || isStartingBuilder.value) {
    return
  }

  isStartingBuilder.value = true
  errorMessage.value = ''

  try {
    const response = await fetch('/api/collections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders.value,
      },
      body: JSON.stringify({
        name: `${activeCommander.value.name} ${activeTheme.value.name} Deck`,
        deck_type: 'Commander',
        deck_text: `Commander\n1 ${activeCommander.value.name}`,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()
      await router.replace({
        name: 'login',
        query: { redirect: route.fullPath },
      })
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

onMounted(() => {
  loadSelectedThemePage()
})
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
          <p class="intro-copy">
            This view surfaces color-legal cards from your collection that match the core deck-building roles we care
            about next: ramp, card advantage, spot removal, and board wipes. Cards are grouped by inherited or direct
            tags instead of gameplay categories.
          </p>
          <div class="summary-strip">
            <div class="summary-chip">
              <span class="summary-label">Color-Legal Pool</span>
              <strong>{{ colorLegalCards.length }}</strong>
            </div>
            <div class="summary-chip">
              <span class="summary-label">Tagged Matches</span>
              <strong>{{ matchedCardTotal }}</strong>
            </div>
          <div class="summary-chip">
            <span class="summary-label">Active Theme</span>
            <strong>{{ activeTheme.name }}</strong>
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

        <section class="workspace-stack">
          <DeckSection
            v-for="group in overviewGroups"
            :key="group.key"
            :title="group.title"
            :eyebrow="group.tagSlug"
            :description="group.description"
          :items="group.items"
          view-mode="grid"
          organization-mode="section"
          :show-quantity-actions="false"
          @card-click="handleSectionCardClick"
        />
      </section>
      </div>
    </section>
  </div>
</template>

<style scoped src="./SelectedTheme.css"></style>
