<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CollectionHeader from '@/components/collection/CollectionHeader.vue'
import CollectionHoverPreview from '@/components/collection/CollectionHoverPreview.vue'
import CollectionManaCurve from '@/components/collection/CollectionManaCurve.vue'
import CollectionToolbar from '@/components/collection/CollectionToolbar.vue'
import CommanderBuilderHoverPreview from '@/components/collection/CommanderBuilderHoverPreview.vue'
import CommanderDeckTemplate from '@/components/collection/CommanderDeckTemplate.vue'
import CardPrintPickerModal from "@/components/collection/CardPrintPickerModal.vue"
import BasicLandAdjustModal from '@/components/collection/BasicLandAdjustModal.vue'
import CommanderSourceBrowserModal from '@/components/collection/CommanderSourceBrowserModal.vue'
import type {
  BasicLandAdjustment,
  CommanderWorkspaceMode,
  CollectionCardContextMenuPayload,
  CollectionCardSearchResult,
  CollectionItem,
  CollectionProfileSection,
  CollectionSortDirection,
  CollectionSortKey,
  CollectionRecord,
  DeckLegalityResult,
  WorkspaceOrganizationMode,
  WorkspaceViewMode,
} from '@/components/collection/types'
import { useAuthStore } from '@/stores/authStore'
import type { GameplayCard } from '@/types/gameplayCard'
import { collectionFacetOptions, matchesCollectionFacets, type CollectionFacetFilters } from '@/components/collection/filtering'
import { formatCollectionExport, type CollectionExportOptions } from '@/components/collection/exporting'
import { sortCollectionItems } from '@/components/collection/sorting'
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
const colorFilters = ref<string[]>([])
const supertypeFilters = ref<string[]>([])
const cardTypeFilters = ref<string[]>([])
const subtypeFilters = ref<string[]>([])
const exportOptions = ref<CollectionExportOptions>({
  includeMaybeboard: false,
  includeSectionHeaders: false,
  includeSetCode: false,
  includeCollectorNumber: false,
  includeColorTags: false,
})
const exportMessage = ref('')
const addCardQuery = ref('')
const addCardSuggestions = ref<CollectionCardSearchResult[]>([])
const isSearchingCards = ref(false)
const isAddingCard = ref(false)
const viewMode = ref<WorkspaceViewMode>('list')
const organizationMode = ref<WorkspaceOrganizationMode>('section')
const sortKey = ref<CollectionSortKey>('name')
const sortDirection = ref<CollectionSortDirection>('asc')
const commanderWorkspaceMode = ref<CommanderWorkspaceMode>('normal')
const hoveredItem = ref<CollectionItem | null>(null)
const contextMenuState = ref<CollectionCardContextMenuPayload | null>(null)
const printPickerItem = ref<CollectionItem | null>(null)
const isReplacingPrint = ref(false)
const mutatingItemIds = ref<Array<string | number>>([])
const isMutatingCommander = ref(false)
const isValidatingDeck = ref(false)
const deckLegalityResult = ref<DeckLegalityResult | null>(null)
const isSourceModalOpen = ref(false)
const isAddingSourceCard = ref(false)
const sourceActionError = ref('')
const sourceActionMessage = ref('')
const isBasicLandModalOpen = ref(false)
const basicLandAdjustmentMessage = ref('')
const commanderScoresByOracleId = ref<Record<string, {
  score: number
  reasons: NonNullable<CollectionItem['commander_support_reasons']>
  score_breakdown?: NonNullable<CollectionItem['score_breakdown']>
}>>({})
const profileSections = ref<CollectionProfileSection[]>([])
let addCardSearchTimeout: ReturnType<typeof window.setTimeout> | null = null
let latestAddCardSearchRequest = 0

const collectionId = computed(() => String(route.params.collectionId ?? ''))
const addCardZone = computed(() => 'mainboard')
const isMasterCollectionRoute = computed(() => collectionId.value === 'master')
const isReadOnlyCollection = computed(() => collection.value?.is_read_only === true)
const isCommanderCollection = computed(() => collection.value?.deck_type.toLowerCase() === 'commander')
const legacyBuilderSource = computed(() => typeof route.query.builderSource === 'string' ? route.query.builderSource : null)
const legacyBuilderTheme = computed(() => {
  const rawValue = typeof route.query.builderTheme === 'string' ? Number(route.query.builderTheme) : Number.NaN
  return Number.isFinite(rawValue) ? rawValue : null
})
const builderSourceCollectionId = computed(() => (
  collection.value?.builder_source_collection_id ?? legacyBuilderSource.value ?? 'master'
))
const builderThemeId = computed(() => (
  collection.value?.builder_theme_id ?? legacyBuilderTheme.value ?? -1
))
const commanderItems = computed(() => collection.value?.items.filter((item) => item.zone === 'commander') ?? [])
const isCommanderTemplateMode = computed(() => collection.value?.deck_type.toLowerCase() === 'commander' && commanderWorkspaceMode.value === 'template')
const existingCommanderDeckOracleIds = computed(() => Array.from(new Set(
  (collection.value?.items ?? [])
    .filter((item) => item.oracle_id && !isBasicLand(item))
    .map((item) => item.oracle_id as string),
)))
const deckValueUsd = computed(() => (
  collection.value?.items.filter((item) => item.zone !== 'maybeboard').reduce((total, item) => (
    total + (item.gameplay_card?.lowest_price_usd ?? 0) * item.amount
  ), 0) ?? 0
))

function isBasicLand(item: CollectionItem) {
  return item.gameplay_card?.faces.some((face) => (
    face.supertypes.includes("Basic") && face.card_types.includes("Land")
  )) ?? false
}

const collectionFacetFilters = computed<CollectionFacetFilters>(() => ({
  colors: colorFilters.value,
  supertypes: supertypeFilters.value,
  cardTypes: cardTypeFilters.value,
  subtypes: subtypeFilters.value,
}))

const facetOptions = computed(() => collectionFacetOptions(collection.value?.items ?? []))

const scoredCollection = computed<CollectionRecord | null>(() => {
  if (!collection.value) return null
  if (!isCommanderCollection.value) return collection.value
  return {
    ...collection.value,
    items: collection.value.items.map((item) => {
      const score = item.oracle_id ? commanderScoresByOracleId.value[item.oracle_id] : undefined
      return score ? {
        ...item,
        commander_support_score: score.score,
        commander_support_reasons: score.reasons,
        score_breakdown: score.score_breakdown,
      } : item
    }),
  }
})

const hasSortableScores = computed(() => (
  scoredCollection.value?.items.some((item) => item.commander_support_score !== undefined) ?? false
))

const filteredCollection = computed<CollectionRecord | null>(() => {
  if (!scoredCollection.value) {
    return null
  }

  const query = filterText.value.trim().toLowerCase()
  const matchingItems = scoredCollection.value.items.filter((item) => {
    const haystack = [
      item.name ?? '',
      item.set_code ?? '',
      item.collector_number ?? '',
      item.lang ?? '',
      item.zone ?? '',
      ...(item.categories ?? []).map((category) => category.name),
      ...(item.archetypes ?? []).map((archetype) => archetype.name),
    ].join(' ').toLowerCase()

    return haystack.includes(query) && matchesCollectionFacets(item, collectionFacetFilters.value)
  })

  return {
    ...scoredCollection.value,
    items: sortCollectionItems(matchingItems, sortKey.value, sortDirection.value),
  }
})


const exportableFilteredItems = computed(() => (
  (filteredCollection.value?.items ?? []).filter((item) => (
    exportOptions.value.includeMaybeboard || item.zone !== 'maybeboard'
  ))
))

const filteredCardCopies = computed(() => (
  exportableFilteredItems.value.reduce((total, item) => total + item.amount, 0)
))

const exportText = computed(() => formatCollectionExport(
  exportableFilteredItems.value,
  exportOptions.value,
))

function exportFilename() {
  const name = (collection.value?.name ?? "collection")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-$|^-/g, "")
  return (name || "collection") + "-export.txt"
}

async function copyExport() {
  exportMessage.value = ''
  try {
    await navigator.clipboard.writeText(exportText.value)
    exportMessage.value = 'Export copied to clipboard.'
  } catch {
    exportMessage.value = 'Could not copy the export. Use Download TXT instead.'
  }
}

function downloadExport() {
  const blob = new Blob([exportText.value], { type: 'text/plain;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = exportFilename()
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

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
const workspaceComponentProps = computed(() => isCommanderCollection.value ? { showScore: true } : {})

const showCommanderBuilderAction = computed(() => (
  collection.value?.deck_type.toLowerCase() === 'binder'
))
const showCommanderBuilderResumeAction = computed(() => (
  collection.value?.deck_type.toLowerCase() === 'commander'
  && !isReadOnlyCollection.value
  && Boolean(collection.value.commander_oracle_id)
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
        gameplay_card: existingItem?.gameplay_card,
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
    gameplay_card: gameplayCard,
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
          gameplay_card: item.gameplay_card,
        },
      ])
  )

  const missingItems = baseCollection.items.filter((item) => (
    Boolean(item.oracle_id)
    && !existingMetadataByOracleId.get(item.oracle_id as string)?.gameplay_card
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
      const gameplayCard = existingMetadata?.gameplay_card ?? (item.oracle_id
        ? fetchedGameplayByOracleId.get(item.oracle_id)
        : undefined)

      return {
        ...item,
        ...(existingMetadata?.gameplay_card ? existingMetadata : buildItemMetadata(gameplayCard)),
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
    await loadCommanderScores()
    await loadProfileSections()
    deckLegalityResult.value = null
    hoveredItem.value = null
    organizationMode.value = 'section'
    commanderWorkspaceMode.value = 'normal'
    viewMode.value = collection.value.deck_type.toLowerCase() === 'binder' ? 'list' : 'grid'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load collection workspace.'
  } finally {
    isLoading.value = false
  }
}

async function loadCommanderScores() {
  if (!collection.value || !isCommanderCollection.value || !collection.value.commander_oracle_id) {
    commanderScoresByOracleId.value = {}
    return
  }
  const oracleIds = Array.from(new Set(
    collection.value.items.map((item) => item.oracle_id).filter((id): id is string => Boolean(id))
  ))
  if (oracleIds.length === 0) {
    commanderScoresByOracleId.value = {}
    return
  }
  const fetchScores = async (sourceCollectionId: string) => {
    const response = await fetch(
      `/api/commander-builder-source/${sourceCollectionId}/${collection.value!.commander_oracle_id}/scores`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders.value },
        body: JSON.stringify({ oracle_ids: oracleIds }),
      },
    )
    const data = await response.json().catch(() => ({}))
    return { response, data }
  }

  try {
    let { response, data } = await fetchScores(builderSourceCollectionId.value)
    if (response.status === 404 && builderSourceCollectionId.value !== 'master') {
      ;({ response, data } = await fetchScores('master'))
    }
    commanderScoresByOracleId.value = response.ok && data.success && data.scores ? data.scores : {}
  } catch {
    // Scoring is supplementary; the collection workspace remains editable without it.
    commanderScoresByOracleId.value = {}
  }
}

async function loadProfileSections() {
  if (!collection.value) {
    profileSections.value = []
    return
  }

  const endpoint = isMasterCollectionRoute.value
    ? '/api/collections/master/sections'
    : `/api/collections/${collection.value.id}/sections`
  try {
    const response = await fetch(endpoint, { headers: { ...authHeaders.value } })
    const data = await response.json().catch(() => ({}))
    profileSections.value = response.ok && data.success && Array.isArray(data.sections)
      ? data.sections as CollectionProfileSection[]
      : []
  } catch {
    // Section organization is supplementary; keep the flat collection usable if
    // cached scoring has not been refreshed yet.
    profileSections.value = []
  }
}

async function validateDeck() {
  if (!collection.value || isValidatingDeck.value) {
    return
  }

  isValidatingDeck.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`/api/collections/${collection.value.id}/validate-legality`, {
      method: 'POST',
      headers: { ...authHeaders.value },
    })
    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()
      router.replace({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    if (!response.ok || !data.success || !data.validation) {
      throw new Error(data.error || 'Unable to validate this deck.')
    }

    deckLegalityResult.value = data.validation as DeckLegalityResult
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to validate this deck.'
  } finally {
    isValidatingDeck.value = false
  }
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
    await loadCommanderScores()
    await loadProfileSections()
    deckLegalityResult.value = null

    hoveredItem.value = updatedCollection.items.find((candidate) => candidate.id === item.id) ?? null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to update collection item.'
  } finally {
    endItemMutation(item.id)
  }
}

async function moveItemToZone(item: CollectionItem, zone: 'mainboard' | 'maybeboard') {
  if (!collection.value || isReadOnlyCollection.value || !isCommanderCollection.value) return

  beginItemMutation(item.id)
  errorMessage.value = ''
  closeContextMenu()
  try {
    const response = await fetch(`/api/collections/${collection.value.id}/items/${item.id}/zone`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders.value },
      body: JSON.stringify({ zone }),
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      authStore.logout()
      router.replace({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    if (!response.ok || !data.success || !data.collection) {
      throw new Error(data.error || 'Unable to move collection item.')
    }

    const updatedCollection = mergeCollectionMetadata(data.collection as CollectionRecord)
    collection.value = updatedCollection
    await loadCommanderScores()
    await loadProfileSections()
    deckLegalityResult.value = null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to move collection item.'
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
    await addCardToMainboard(suggestion.card_id)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to add card to collection.'
  } finally {
    isAddingCard.value = false
  }
}

async function addCardToMainboard(cardId: string) {
  if (!collection.value || isReadOnlyCollection.value) return
  const response = await fetch(`/api/collections/${collection.value.id}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders.value,
      },
      body: JSON.stringify({
        card_id: cardId,
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
      throw new Error('Authentication required.')
    }

    if (!response.ok || !data.success || !data.collection) {
      throw new Error(data.error || 'Unable to add card to collection.')
    }

    const mergedCollection = mergeCollectionMetadata(data.collection as CollectionRecord)
    collection.value = await enrichCollectionWithGameplay(mergedCollection, collection.value)
    await loadCommanderScores()
    await loadProfileSections()
    deckLegalityResult.value = null
}

async function addSourceCard(item: CollectionItem) {
  if (isAddingSourceCard.value) return
  isAddingSourceCard.value = true
  sourceActionError.value = ''
  sourceActionMessage.value = ''
  try {
    await addCardToMainboard(item.card_id)
    sourceActionMessage.value = `Added ${item.name || 'card'} to the deck.`
  } catch (error) {
    sourceActionError.value = error instanceof Error ? error.message : 'Unable to add source card.'
  } finally {
    isAddingSourceCard.value = false
  }
}

function handleContextMenu(payload: CollectionCardContextMenuPayload) {
  contextMenuState.value = payload
}

function openPrintPicker() {
  const item = contextMenuState.value?.item
  if (!item?.oracle_id || isReadOnlyCollection.value) return
  printPickerItem.value = item
  closeContextMenu()
}

async function replacePrint(cardId: string) {
  const item = printPickerItem.value
  if (!collection.value || !item || isReplacingPrint.value) return
  isReplacingPrint.value = true
  errorMessage.value = ""
  try {
    const response = await fetch(`/api/collections/${collection.value.id}/items/${item.id}/print`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders.value },
      body: JSON.stringify({ card_id: cardId }),
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) { authStore.logout(); await router.replace({ name: "login", query: { redirect: route.fullPath } }); return }
    if (!response.ok || !data.success || !data.collection) throw new Error(data.error || "Unable to replace printing.")
    const updated = mergeCollectionMetadata(data.collection as CollectionRecord)
    collection.value = await enrichCollectionWithGameplay(updated, collection.value)
    printPickerItem.value = null
    hoveredItem.value = null
    deckLegalityResult.value = null
    await loadCommanderScores()
    await loadProfileSections()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to replace printing."
  } finally { isReplacingPrint.value = false }
}

function openBasicLandAdjustModal() {
  if (!collection.value || !isCommanderCollection.value || isReadOnlyCollection.value) return
  basicLandAdjustmentMessage.value = ''
  isBasicLandModalOpen.value = true
}

async function handleBasicLandUnauthorized() {
  isBasicLandModalOpen.value = false
  authStore.logout()
  await router.replace({ name: 'login', query: { redirect: route.fullPath } })
}

async function handleBasicLandAdjusted(
  updatedCollection: CollectionRecord,
  adjustment: BasicLandAdjustment,
) {
  const mergedCollection = mergeCollectionMetadata(updatedCollection)
  collection.value = await enrichCollectionWithGameplay(mergedCollection, collection.value)
  hoveredItem.value = null
  deckLegalityResult.value = null
  isBasicLandModalOpen.value = false
  basicLandAdjustmentMessage.value = adjustment.target_reached
    ? `Basic lands adjusted to ${adjustment.reachable_land_count} total lands.`
    : adjustment.warning || `Basic lands adjusted to ${adjustment.reachable_land_count} total lands.`
  await loadCommanderScores()
  await loadProfileSections()
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



async function mutateCommander(item: CollectionItem, action: 'set' | 'remove') {
  if (!collection.value || isReadOnlyCollection.value || isMutatingCommander.value) {
    return
  }

  isMutatingCommander.value = true
  errorMessage.value = ''
  closeContextMenu()

  try {
    const response = action === 'set'
      ? await fetch(`/api/collections/${collection.value.id}/commander`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders.value },
          body: JSON.stringify({ item_id: item.id }),
        })
      : await fetch(`/api/collections/${collection.value.id}/commander/${item.id}`, {
          method: 'DELETE',
          headers: { ...authHeaders.value },
        })
    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()
      router.replace({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    if (!response.ok || !data.success || !data.collection) {
      throw new Error(data.error || 'Unable to update commander.')
    }

    const updated = mergeCollectionMetadata(data.collection as CollectionRecord)
    collection.value = await enrichCollectionWithGameplay(updated, collection.value)
    isSourceModalOpen.value = false
    await loadCommanderScores()
    await loadProfileSections()
    deckLegalityResult.value = null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to update commander.'
  } finally {
    isMutatingCommander.value = false
  }
}
function handleGlobalPointer() {
  closeContextMenu()
}

function handleGlobalEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeContextMenu()
    return
  }

  const item = contextMenuState.value?.item
  if (!item || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
  const key = event.key.toLowerCase()
  if (key === 'm' && item.zone === 'mainboard') {
    event.preventDefault()
    void moveItemToZone(item, 'maybeboard')
  } else if (key === 'a' && item.zone === 'maybeboard') {
    event.preventDefault()
    void moveItemToZone(item, 'mainboard')
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

function reopenCommanderBuilder() {
  if (!collection.value?.commander_oracle_id) {
    return
  }
  sourceActionError.value = ''
  sourceActionMessage.value = ''
  isSourceModalOpen.value = true
}

function closeSourceBrowser() {
  isSourceModalOpen.value = false
  sourceActionError.value = ''
}
  sourceActionMessage.value = ''

function openItemCardDetails(item: CollectionItem) {
  if (!item.oracle_id) return
  const routeData = router.resolve({ name: 'card-detail', params: { id: item.oracle_id } })
  window.open(routeData.href, '_blank')
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

watch(hasSortableScores, (hasScores) => {
  if (!hasScores && sortKey.value === 'score') {
    sortKey.value = 'name'
    sortDirection.value = 'asc'
  }
})

watch(viewMode, (mode) => {
  if (mode !== 'list') {
    hoveredItem.value = null
  }
  closeContextMenu()
})

watch(() => exportOptions.value.includeSetCode, (includeSetCode) => {
  if (!includeSetCode) {
    exportOptions.value.includeCollectorNumber = false
  }
})

watch([filterText, colorFilters, supertypeFilters, cardTypeFilters, subtypeFilters], () => {
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
          :deck-value-usd="deckValueUsd"
          :legality-result="deckLegalityResult"
          :is-validating-deck="isValidatingDeck"
          :show-deck-metrics="true"
          :show-commander-builder-action="showCommanderBuilderAction"
          :show-commander-builder-resume-action="showCommanderBuilderResumeAction"
          :show-master-search-action="showMasterSearchAction"
          @create-commander-deck="goToCommanderBuilder"
          @open-commander-builder="reopenCommanderBuilder"
          @search-master-collection="goToMasterAdvancedSearch"
          @validate-deck="validateDeck"
        />
        <section class="export-panel">
          <div>
            <span class="export-title">Export filtered cards</span>
            <span class="export-count">{{ filteredCardCopies }} cards across {{ exportableFilteredItems.length }} entries</span>
          </div>
          <div class="export-options">
            <label><input v-model="exportOptions.includeMaybeboard" type="checkbox"> Include Maybeboard</label>
            <label><input v-model="exportOptions.includeSectionHeaders" type="checkbox"> Generic section headers</label>
            <label><input v-model="exportOptions.includeSetCode" type="checkbox"> Set code</label>
            <label><input v-model="exportOptions.includeCollectorNumber" type="checkbox" :disabled="!exportOptions.includeSetCode"> Collector number</label>
            <label><input v-model="exportOptions.includeColorTags" type="checkbox"> Color tags</label>
          </div>
          <div class="export-actions">
            <button type="button" :disabled="!exportText" @click="copyExport">Copy export</button>
            <button type="button" :disabled="!exportText" @click="downloadExport">Download TXT</button>
            <span v-if="exportMessage" class="export-message">{{ exportMessage }}</span>
          </div>
        </section>

        <CollectionManaCurve v-if="shouldShowManaCurve" :collection="collection" />
        <CollectionToolbar
          v-model="viewMode"
          v-model:commander-workspace-mode="commanderWorkspaceMode"
          v-model:organization-mode="organizationMode"
          v-model:sort-key="sortKey"
          v-model:sort-direction="sortDirection"
          v-model:filter-text="filterText"
          v-model:color-filters="colorFilters"
          v-model:supertype-filters="supertypeFilters"
          v-model:card-type-filters="cardTypeFilters"
          v-model:subtype-filters="subtypeFilters"
          v-model:add-card-query="addCardQuery"
          :collection="collection"
          :show-score-sort="hasSortableScores"
          :supertype-options="facetOptions.supertypes"
          :card-type-options="facetOptions.cardTypes"
          :subtype-options="facetOptions.subtypes"
          :add-card-suggestions="addCardSuggestions"
          :add-card-loading="isSearchingCards"
          :add-card-disabled="isAddingCard || isReadOnlyCollection"
          :show-basic-land-adjust="isCommanderCollection && !isReadOnlyCollection"
          :basic-land-adjust-disabled="commanderItems.length === 0"
          @adjust-basic-lands="openBasicLandAdjustModal"
          @select-add-card-suggestion="addSuggestedCard"
          @dismiss-add-card-suggestions="dismissAddCardSuggestions"
        />

        <p v-if="basicLandAdjustmentMessage" class="basic-land-adjustment-message">
          {{ basicLandAdjustmentMessage }}
        </p>

        <div v-if="filteredCollection.items.length === 0 && !isCommanderTemplateMode" class="state-panel">
          <h2>No cards match this filter</h2>
          <p>Try a different local filter or clear the current search.</p>
        </div>

        <div v-else-if="isCommanderTemplateMode && viewMode === 'list'" class="workspace-content-grid">
          <CommanderDeckTemplate :collection="filteredCollection" :commander-items="commanderItems" :view-mode="viewMode" :mutating-item-ids="mutatingItemIds" :show-quantity-actions="!isReadOnlyCollection" @hover-item="handleHoverItem" @context-menu="handleContextMenu" @increment-item="mutateItemQuantity($event, 'increment')" @decrement-item="mutateItemQuantity($event, 'decrement')" />
          <CollectionHoverPreview :item="hoveredItem" />
        </div>

        <CommanderDeckTemplate v-else-if="isCommanderTemplateMode" :collection="filteredCollection" :commander-items="commanderItems" :view-mode="viewMode" :mutating-item-ids="mutatingItemIds" :show-quantity-actions="!isReadOnlyCollection" @context-menu="handleContextMenu" @increment-item="mutateItemQuantity($event, 'increment')" @decrement-item="mutateItemQuantity($event, 'decrement')" />

        <div v-else-if="viewMode === 'list'" class="workspace-content-grid">
          <component
            :is="workspaceComponent"
            v-bind="workspaceComponentProps"
            :collection="filteredCollection"
            :view-mode="viewMode"
            :organization-mode="organizationMode"
            :profile-sections="profileSections"
            :mutating-item-ids="mutatingItemIds"
            :show-quantity-actions="!isReadOnlyCollection"
            @hover-item="handleHoverItem"
            @context-menu="handleContextMenu"
            @increment-item="mutateItemQuantity($event, 'increment')"
            @decrement-item="mutateItemQuantity($event, 'decrement')"
          />
          <CommanderBuilderHoverPreview v-if="isCommanderCollection" :item="hoveredItem" />
          <CollectionHoverPreview v-else :item="hoveredItem" />
        </div>

        <component
          :is="workspaceComponent"
          v-bind="workspaceComponentProps"
          v-else
          :collection="filteredCollection"
          :view-mode="viewMode"
          :organization-mode="organizationMode"
          :profile-sections="profileSections"
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
          <button
            v-if="!isReadOnlyCollection && contextMenuState.item.oracle_id"
            class="context-menu-action"
            type="button"
            @click="openPrintPicker"
          >
            Change printing
          </button>
          <button
            v-if="collection?.deck_type.toLowerCase() === 'commander' && !isReadOnlyCollection"
            class="context-menu-action"
            type="button"
            :disabled="isMutatingCommander"
            @click="mutateCommander(contextMenuState.item, contextMenuState.item.zone === 'commander' ? 'remove' : 'set')"
          >
            {{ contextMenuState.item.zone === 'commander' ? 'Remove as commander' : 'Set as commander' }}
          </button>
          <button
            v-if="isCommanderCollection && !isReadOnlyCollection && contextMenuState.item.zone === 'mainboard'"
            class="context-menu-action"
            type="button"
            :disabled="mutatingItemIds.includes(contextMenuState.item.id)"
            @click="moveItemToZone(contextMenuState.item, 'maybeboard')"
          >
            Move to Maybeboard (M)
          </button>
          <button
            v-else-if="isCommanderCollection && !isReadOnlyCollection && contextMenuState.item.zone === 'maybeboard'"
            class="context-menu-action"
            type="button"
            :disabled="mutatingItemIds.includes(contextMenuState.item.id)"
            @click="moveItemToZone(contextMenuState.item, 'mainboard')"
          >
            Move to Mainboard (A)
          </button>
        </div>

        <BasicLandAdjustModal
          :open="isBasicLandModalOpen"
          :collection="collection"
          :auth-headers="authHeaders"
          @close="isBasicLandModalOpen = false"
          @applied="handleBasicLandAdjusted"
          @unauthorized="handleBasicLandUnauthorized"
        />

        <CardPrintPickerModal
          :open="!!printPickerItem"
          :item="printPickerItem"
          :replacing="isReplacingPrint"
          @close="printPickerItem = null"
          @select="replacePrint"
        />

        <CommanderSourceBrowserModal
          v-if="collection.commander_oracle_id"
          :open="isSourceModalOpen"
          :source-collection-id="builderSourceCollectionId"
          :commander-oracle-id="collection.commander_oracle_id"
          :theme-id="builderThemeId"
          :deck-oracle-ids="existingCommanderDeckOracleIds"
          :adding-card="isAddingSourceCard"
          :action-error="sourceActionError"
          :action-message="sourceActionMessage"
          @close="closeSourceBrowser"
          @add-card="addSourceCard"
          @open-card="openItemCardDetails"
        />
      </template>
    </section>
  </div>
</template>

<style scoped>
.workspace-page {
  padding: 24px;
}

.workspace-shell {
  max-width: none;
  margin: 0;
  display: grid;
  gap: 18px;
}

.workspace-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  align-items: start;
}

.export-panel {
  display: grid;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid var(--surface-border-light);
  border-radius: 16px;
  background: var(--surface-card);
}

.export-title {
  color: var(--text-light);
  font-weight: 800;
}

.export-count,
.export-message {
  margin-left: 10px;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.basic-land-adjustment-message {
  margin: 0;
  padding: 11px 14px;
  border: 1px solid rgba(34, 197, 94, 0.35);
  border-radius: 12px;
  color: #bbf7d0;
  background: rgba(22, 163, 74, 0.14);
}

.export-options,
.export-actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: center;
}

.export-options label {
  color: var(--text-main);
  font-size: 0.9rem;
}

.export-options input {
  margin-right: 6px;
  accent-color: var(--accent-electric);
}

.export-actions button {
  padding: 9px 13px;
  border: 1px solid var(--surface-border-light);
  border-radius: 10px;
  background: var(--surface-hover);
  color: var(--text-main);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.export-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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
