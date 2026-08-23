<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CollectionHeader from '@/components/collection/CollectionHeader.vue'
import CollectionHoverPreview from '@/components/collection/CollectionHoverPreview.vue'
import CollectionManaCurve from '@/components/collection/CollectionManaCurve.vue'
import CollectionToolbar from '@/components/collection/CollectionToolbar.vue'
import type {
  CollectionCardContextMenuPayload,
  CollectionCardSearchResult,
  CollectionItem,
  CollectionRecord,
  WorkspaceOrganizationMode,
  WorkspaceViewMode,
} from '@/components/collection/types'
import { useAuthStore } from '@/stores/authStore'
import type { GameplayCard } from '@/types/gameplayCard'

const CommanderWorkspace = defineAsyncComponent(() => import('@/components/collection/CommanderWorkspace.vue'))
const StandardWorkspace = defineAsyncComponent(() => import('@/components/collection/StandardWorkspace.vue'))
const BinderWorkspace = defineAsyncComponent(() => import('@/components/collection/BinderWorkspace.vue'))

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { authHeaders } = storeToRefs(authStore)

const isLoading = ref(true)
const errorMessage = ref('')
const collection = ref<CollectionRecord | null>(null)
const filterText = ref('')
const addCardQuery = ref('')
const addCardSuggestions = ref<CollectionCardSearchResult[]>([])
const isSearchingCards = ref(false)
const isAddingCard = ref(false)
const viewMode = ref<WorkspaceViewMode>('list')
const organizationMode = ref<WorkspaceOrganizationMode>('section')
const hoveredItem = ref<CollectionItem | null>(null)
const contextMenuState = ref<CollectionCardContextMenuPayload | null>(null)
const mutatingItemIds = ref<Array<string | number>>([])
let addCardSearchTimeout: ReturnType<typeof window.setTimeout> | null = null
let latestAddCardSearchRequest = 0

const collectionId = computed(() => String(route.params.collectionId ?? ''))
const addCardZone = computed(() => 'mainboard')
const isMasterCollectionRoute = computed(() => collectionId.value === 'master')
const isReadOnlyCollection = computed(() => collection.value?.is_read_only === true)

const filteredCollection = computed<CollectionRecord | null>(() => {
  if (!collection.value) {
    return null
  }

  const query = filterText.value.trim().toLowerCase()
  if (!query) {
    return collection.value
  }

  return {
    ...collection.value,
    items: collection.value.items.filter((item) => {
      const haystack = [
        item.name ?? '',
        item.set_code ?? '',
        item.collector_number ?? '',
        item.lang ?? '',
        item.zone ?? '',
        ...(item.categories ?? []).map((category) => category.name),
        ...(item.archetypes ?? []).map((archetype) => archetype.name),
      ].join(' ').toLowerCase()

      return haystack.includes(query)
    }),
  }
})

const workspaceComponent = computed(() => {
  const deckType = collection.value?.deck_type.toLowerCase()
  if (deckType === 'commander') {
    return CommanderWorkspace
  }
  if (deckType === 'standard') {
    return StandardWorkspace
  }
  return BinderWorkspace
})

const showCommanderBuilderAction = computed(() => (
  collection.value?.deck_type.toLowerCase() === 'binder'
))
const showMasterSearchAction = computed(() => collection.value?.is_virtual === true)
const shouldShowManaCurve = computed(() => {
  const deckType = collection.value?.deck_type.toLowerCase()
  return deckType === 'commander' || deckType === 'standard'
})

function mergeCollectionMetadata(updatedCollection: CollectionRecord): CollectionRecord {
  const currentCollection = collection.value
  if (!currentCollection) {
    return updatedCollection
  }

  const currentItemsById = new Map(currentCollection.items.map((item) => [item.id, item]))
  const currentItemsByCardZone = new Map(
    currentCollection.items.map((item) => [`${item.card_id}:${item.zone}`, item])
  )

  return {
    ...updatedCollection,
    items: updatedCollection.items.map((item) => {
      const existingItem = currentItemsById.get(item.id) ?? currentItemsByCardZone.get(`${item.card_id}:${item.zone}`)

      return {
        ...item,
        cmc: existingItem?.cmc ?? 0,
        card_types: existingItem?.card_types ?? [],
        categories: existingItem?.categories ?? [],
        archetypes: existingItem?.archetypes ?? [],
      }
    }),
  }
}

function buildItemMetadata(gameplayCard: GameplayCard | undefined) {
  return {
    cmc: gameplayCard?.cmc ?? 0,
    card_types: Array.from(new Set(
      gameplayCard?.faces.flatMap((face) => face.card_types ?? []) ?? []
    )),
    categories: gameplayCard?.categories ?? [],
    archetypes: gameplayCard?.archetypes ?? [],
  }
}

async function fetchGameplayCardsByName(items: CollectionItem[]) {
  const uniqueNames = Array.from(new Set(
    items
      .map((item) => item.name?.trim())
      .filter((value): value is string => Boolean(value))
  ))

  if (uniqueNames.length === 0) {
    return new Map<string, GameplayCard>()
  }

  const gameplayResponse = await fetch('/api/deck-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deck_text: uniqueNames.map((name) => `1 ${name}`).join('\n'),
    }),
  })

  const gameplayPayload = await gameplayResponse.json().catch(() => ({}))
  if (!gameplayResponse.ok || !gameplayPayload.success || !Array.isArray(gameplayPayload.cards)) {
    throw new Error(gameplayPayload.error || 'Unable to load gameplay data for this collection.')
  }

  return new Map(
    (gameplayPayload.cards as GameplayCard[]).map((card) => [card.oracle_id, card])
  )
}

async function enrichCollectionWithGameplay(
  baseCollection: CollectionRecord,
  metadataSource: CollectionRecord | null = null,
) {
  const existingMetadataByOracleId = new Map(
    (metadataSource?.items ?? [])
      .filter((item) => item.oracle_id)
      .map((item) => [
        item.oracle_id as string,
        {
          cmc: item.cmc ?? 0,
          card_types: item.card_types ?? [],
          categories: item.categories ?? [],
          archetypes: item.archetypes ?? [],
        },
      ])
  )

  const missingItems = baseCollection.items.filter((item) => (
    Boolean(item.oracle_id)
    && !existingMetadataByOracleId.has(item.oracle_id as string)
    && Boolean(item.name)
  ))

  const fetchedGameplayByOracleId = missingItems.length > 0
    ? await fetchGameplayCardsByName(missingItems)
    : new Map<string, GameplayCard>()

  return {
    ...baseCollection,
    items: baseCollection.items.map((item) => {
      const existingMetadata = item.oracle_id
        ? existingMetadataByOracleId.get(item.oracle_id)
        : undefined
      const gameplayCard = item.oracle_id
        ? fetchedGameplayByOracleId.get(item.oracle_id)
        : undefined

      return {
        ...item,
        ...(existingMetadata ?? buildItemMetadata(gameplayCard)),
      }
    }),
  }
}

async function loadCollection() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const collectionEndpoint = isMasterCollectionRoute.value
      ? '/api/collections/master'
      : `/api/collections/${collectionId.value}`
    const response = await fetch(collectionEndpoint, {
      headers: {
        ...authHeaders.value,
      },
    })

    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()
      router.replace({
        name: 'login',
        query: { redirect: route.fullPath },
      })
      return
    }

    if (!response.ok || !data.success || !data.collection) {
      throw new Error(data.error || 'Unable to load collection workspace.')
    }

    const loadedCollection = data.collection as CollectionRecord
    collection.value = await enrichCollectionWithGameplay(loadedCollection)
    hoveredItem.value = null
    organizationMode.value = 'section'
    viewMode.value = collection.value.deck_type.toLowerCase() === 'binder' ? 'list' : 'grid'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load collection workspace.'
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  router.push({ name: 'deck-dashboard' })
}

function handleHoverItem(item: CollectionItem | null) {
  hoveredItem.value = item
}

function beginItemMutation(itemId: string | number) {
  mutatingItemIds.value = [...new Set([...mutatingItemIds.value, itemId])]
}

function endItemMutation(itemId: string | number) {
  mutatingItemIds.value = mutatingItemIds.value.filter((id) => id !== itemId)
}

async function mutateItemQuantity(item: CollectionItem, direction: 'increment' | 'decrement') {
  if (!collection.value || isReadOnlyCollection.value) {
    return
  }

  beginItemMutation(item.id)
  errorMessage.value = ''
  closeContextMenu()

  try {
    const response = direction === 'increment'
      ? await fetch(`/api/collections/${collection.value.id}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders.value,
          },
          body: JSON.stringify({
            card_id: item.card_id,
            zone: item.zone,
            amount: 1,
          }),
        })
      : await fetch(`/api/collections/${collection.value.id}/items/${item.id}?amount=1`, {
          method: 'DELETE',
          headers: {
            ...authHeaders.value,
          },
        })

    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()
      router.replace({
        name: 'login',
        query: { redirect: route.fullPath },
      })
      return
    }

    if (!response.ok || !data.success || !data.collection) {
      throw new Error(data.error || 'Unable to update collection item.')
    }

    const updatedCollection = mergeCollectionMetadata(data.collection as CollectionRecord)
    collection.value = updatedCollection

    hoveredItem.value = updatedCollection.items.find((candidate) => candidate.id === item.id) ?? null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to update collection item.'
  } finally {
    endItemMutation(item.id)
  }
}

function dismissAddCardSuggestions() {
  addCardSuggestions.value = []
}

async function searchAddCardSuggestions(query: string, requestId: number) {
  isSearchingCards.value = true

  try {
    const response = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}&limit=8`)
    const data = await response.json().catch(() => ({}))

    if (requestId !== latestAddCardSearchRequest) {
      return
    }

    if (!response.ok || !data.success || !Array.isArray(data.cards)) {
      throw new Error(data.error || 'Unable to search cards.')
    }

    addCardSuggestions.value = data.cards as CollectionCardSearchResult[]
  } catch (error) {
    if (requestId === latestAddCardSearchRequest) {
      addCardSuggestions.value = []
      errorMessage.value = error instanceof Error ? error.message : 'Unable to search cards.'
    }
  } finally {
    if (requestId === latestAddCardSearchRequest) {
      isSearchingCards.value = false
    }
  }
}

async function addSuggestedCard(suggestion: CollectionCardSearchResult) {
  if (!collection.value || isAddingCard.value || isReadOnlyCollection.value) {
    return
  }

  isAddingCard.value = true
  errorMessage.value = ''
  addCardQuery.value = ''
  dismissAddCardSuggestions()

  try {
    const response = await fetch(`/api/collections/${collection.value.id}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders.value,
      },
      body: JSON.stringify({
        card_id: suggestion.card_id,
        zone: addCardZone.value,
        amount: 1,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()
      router.replace({
        name: 'login',
        query: { redirect: route.fullPath },
      })
      return
    }

    if (!response.ok || !data.success || !data.collection) {
      throw new Error(data.error || 'Unable to add card to collection.')
    }

    const mergedCollection = mergeCollectionMetadata(data.collection as CollectionRecord)
    collection.value = await enrichCollectionWithGameplay(mergedCollection, collection.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to add card to collection.'
  } finally {
    isAddingCard.value = false
  }
}

function handleContextMenu(payload: CollectionCardContextMenuPayload) {
  contextMenuState.value = payload
}

function closeContextMenu() {
  contextMenuState.value = null
}

function openCardDetails() {
  const item = contextMenuState.value?.item
  if (!item?.oracle_id) {
    closeContextMenu()
    return
  }

  const routeData = router.resolve({
    name: 'card-detail',
    params: { id: item.oracle_id },
  })
  window.open(routeData.href, '_blank')
  closeContextMenu()
}

function handleGlobalPointer() {
  closeContextMenu()
}

function handleGlobalEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeContextMenu()
  }
}

function goToCommanderBuilder() {
  if (!collection.value || collection.value.deck_type.toLowerCase() !== 'binder') {
    return
  }

  router.push({
    name: 'collection-possible-commanders',
    params: { collectionId: String(collection.value.id) },
  })
}

function goToMasterAdvancedSearch() {
  router.push({
    name: 'advanced-search',
    query: { scope: 'master' },
  })
}

onMounted(() => {
  window.addEventListener('click', handleGlobalPointer)
  window.addEventListener('scroll', handleGlobalPointer, true)
  window.addEventListener('keydown', handleGlobalEscape)
  loadCollection()
})

onBeforeUnmount(() => {
  if (addCardSearchTimeout !== null) {
    window.clearTimeout(addCardSearchTimeout)
  }
  window.removeEventListener('click', handleGlobalPointer)
  window.removeEventListener('scroll', handleGlobalPointer, true)
  window.removeEventListener('keydown', handleGlobalEscape)
})

watch(viewMode, (mode) => {
  if (mode !== 'list') {
    hoveredItem.value = null
  }
  closeContextMenu()
})

watch(filterText, () => {
  hoveredItem.value = null
  closeContextMenu()
})

watch(addCardQuery, (value) => {
  const query = value.trim()

  if (addCardSearchTimeout !== null) {
    window.clearTimeout(addCardSearchTimeout)
    addCardSearchTimeout = null
  }

  if (query.length < 3) {
    latestAddCardSearchRequest += 1
    isSearchingCards.value = false
    dismissAddCardSuggestions()
    return
  }

  addCardSearchTimeout = window.setTimeout(() => {
    latestAddCardSearchRequest += 1
    void searchAddCardSuggestions(query, latestAddCardSearchRequest)
  }, 250)
})
</script>

<template>
  <div class="workspace-page">
    <section class="workspace-shell">
      <div class="nav-row">
        <button class="back-button" type="button" @click="goBack">
          Back to Deck Dashboard
        </button>
      </div>

      <div v-if="isLoading" class="loading-panel skeleton-pulse">
        <div class="loading-copy">
          <h2>Loading collection workspace...</h2>
        </div>
      </div>

      <div v-else-if="errorMessage" class="state-panel error">
        <h2>Unable to load collection</h2>
        <p>{{ errorMessage }}</p>
      </div>

      <template v-else-if="collection && filteredCollection">
        <CollectionHeader
          :collection="collection"
          :show-commander-builder-action="showCommanderBuilderAction"
          :show-master-search-action="showMasterSearchAction"
          @create-commander-deck="goToCommanderBuilder"
          @search-master-collection="goToMasterAdvancedSearch"
        />
        <CollectionToolbar
          v-model="viewMode"
          v-model:organization-mode="organizationMode"
          v-model:filter-text="filterText"
          v-model:add-card-query="addCardQuery"
          :collection="collection"
          :add-card-suggestions="addCardSuggestions"
          :add-card-loading="isSearchingCards"
          :add-card-disabled="isAddingCard || isReadOnlyCollection"
          @select-add-card-suggestion="addSuggestedCard"
          @dismiss-add-card-suggestions="dismissAddCardSuggestions"
        />
        <CollectionManaCurve v-if="shouldShowManaCurve" :collection="collection" />

        <div v-if="filteredCollection.items.length === 0" class="state-panel">
          <h2>No cards match this filter</h2>
          <p>Try a different local filter or clear the current search.</p>
        </div>

        <div v-else-if="viewMode === 'list'" class="workspace-content-grid">
          <component
            :is="workspaceComponent"
            :collection="filteredCollection"
            :view-mode="viewMode"
            :organization-mode="organizationMode"
            :mutating-item-ids="mutatingItemIds"
            :show-quantity-actions="!isReadOnlyCollection"
            @hover-item="handleHoverItem"
            @context-menu="handleContextMenu"
            @increment-item="mutateItemQuantity($event, 'increment')"
            @decrement-item="mutateItemQuantity($event, 'decrement')"
          />
          <CollectionHoverPreview :item="hoveredItem" />
        </div>

        <component
          :is="workspaceComponent"
          v-else
          :collection="filteredCollection"
          :view-mode="viewMode"
          :organization-mode="organizationMode"
          :mutating-item-ids="mutatingItemIds"
          :show-quantity-actions="!isReadOnlyCollection"
          @context-menu="handleContextMenu"
          @increment-item="mutateItemQuantity($event, 'increment')"
          @decrement-item="mutateItemQuantity($event, 'decrement')"
        />

        <div
          v-if="contextMenuState"
          class="context-menu"
          :style="{ left: `${contextMenuState.x}px`, top: `${contextMenuState.y}px` }"
          @click.stop
        >
          <button
            class="context-menu-action"
            type="button"
            :disabled="!contextMenuState.item.oracle_id"
            @click="openCardDetails"
          >
            Show card details
          </button>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.workspace-page {
  padding: 20px;
}

.workspace-shell {
  max-width: 1520px;
  margin: 0 auto;
  display: grid;
  gap: 18px;
}

.workspace-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  align-items: start;
}

.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 190px;
  padding: 8px;
  border-radius: 14px;
  border: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.98);
  box-shadow: var(--shadow-lg);
}

.context-menu-action {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 0.92rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.context-menu-action:hover:not(:disabled) {
  background: var(--accent-electric-dim);
  color: var(--accent-electric);
}

.context-menu-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.nav-row {
  display: flex;
  justify-content: flex-start;
}

.back-button {
  padding: 12px 16px;
  border: 1px solid var(--surface-border-light);
  border-radius: 14px;
  background: transparent;
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 0.94rem;
  font-weight: 700;
  cursor: pointer;
}

.loading-panel,
.state-panel {
  padding: 28px;
  border-radius: 24px;
  border: 1px solid var(--surface-border-light);
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.04), rgba(15, 23, 42, 0.98)),
    var(--surface-card);
  box-shadow: var(--shadow-md);
}

.loading-copy h2,
.state-panel h2 {
  margin: 0;
  color: var(--text-light);
  font-size: 1.4rem;
}

.state-panel p {
  margin: 10px 0 0;
  color: var(--text-muted);
  line-height: 1.6;
}

.state-panel.error {
  border-color: var(--error-border);
}

@media (max-width: 760px) {
  .workspace-page {
    padding: 14px;
  }
}

@media (max-width: 980px) {
  .workspace-content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
