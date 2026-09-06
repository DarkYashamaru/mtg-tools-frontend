<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import CollectionHeader from '@/components/collection/CollectionHeader.vue'
import CollectionHoverPreview from '@/components/collection/CollectionHoverPreview.vue'
import CollectionManaCurve from '@/components/collection/CollectionManaCurve.vue'
import CollectionToolbar from '@/components/collection/CollectionToolbar.vue'
import CommanderBuilderHoverPreview from '@/components/collection/CommanderBuilderHoverPreview.vue'
import CommanderDeckTemplate from '@/components/collection/CommanderDeckTemplate.vue'
import CardPrintPickerModal from '@/components/collection/CardPrintPickerModal.vue'
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
import { useCollectionStore } from '@/stores/collectionStore'
import type { GameplayCard } from '@/types/gameplayCard'
import type { DracoPriceResponse } from '@/types/dracoPrice'
import {
  collectionFacetOptions,
  matchesCollectionFacets,
  type CollectionFacetFilters,
} from '@/components/collection/filtering'
import {
  formatCollectionExport,
  type CollectionExportOptions,
} from '@/components/collection/exporting'
import { sortCollectionItems } from '@/components/collection/sorting'

const CommanderWorkspace = defineAsyncComponent(
  () => import('@/components/collection/CommanderWorkspace.vue'),
)

const StandardWorkspace = defineAsyncComponent(
  () => import('@/components/collection/StandardWorkspace.vue'),
)

const BinderWorkspace = defineAsyncComponent(
  () => import('@/components/collection/BinderWorkspace.vue'),
)

const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const collectionStore = useCollectionStore()
const { authHeaders } = storeToRefs(authStore)

/* -------------------------------------------------------------------------- */
/* Collection state                                                           */
/* -------------------------------------------------------------------------- */

const isLoading = ref(true)

/**
 * Fatal errors prevent the collection itself from being displayed.
 * Normal workspace/action errors use errorMessage instead.
 */
const loadErrorMessage = ref('')
const errorMessage = ref('')

const collection = ref<CollectionRecord | null>(null)

/* -------------------------------------------------------------------------- */
/* Filtering / organization                                                   */
/* -------------------------------------------------------------------------- */

const filterText = ref('')
const colorFilters = ref<string[]>([])
const supertypeFilters = ref<string[]>([])
const cardTypeFilters = ref<string[]>([])
const subtypeFilters = ref<string[]>([])

const viewMode = ref<WorkspaceViewMode>('list')
const organizationMode = ref<WorkspaceOrganizationMode>('zone')
const sortKey = ref<CollectionSortKey>('name')
const sortDirection = ref<CollectionSortDirection>('asc')

const commanderWorkspaceMode = ref<CommanderWorkspaceMode>('normal')

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

const exportOptions = ref<CollectionExportOptions>({
  includeMaybeboard: false,
  includeSectionHeaders: false,
  includeSetCode: false,
  includeCollectorNumber: false,
  includeColorTags: false,
})

const exportMessage = ref('')

/* -------------------------------------------------------------------------- */
/* Add card                                                                   */
/* -------------------------------------------------------------------------- */

const addCardQuery = ref('')
const addCardSuggestions = ref<CollectionCardSearchResult[]>([])

const isSearchingCards = ref(false)
const isAddingCard = ref(false)

let addCardSearchTimeout: ReturnType<typeof window.setTimeout> | null = null
let addCardSearchController: AbortController | null = null
let latestAddCardSearchRequest = 0

/* -------------------------------------------------------------------------- */
/* Item interaction                                                           */
/* -------------------------------------------------------------------------- */

const hoveredItem = ref<CollectionItem | null>(null)

const contextMenuState = ref<CollectionCardContextMenuPayload | null>(null)
const contextMenuElement = ref<HTMLElement | null>(null)

let latestContextMenuRequest = 0

const printPickerItem = ref<CollectionItem | null>(null)
const isReplacingPrint = ref(false)

const mutatingItemIds = ref<Array<string | number>>([])
const isMutatingCommander = ref(false)

/* -------------------------------------------------------------------------- */
/* Deck tools                                                                 */
/* -------------------------------------------------------------------------- */

const isValidatingDeck = ref(false)
const deckLegalityResult = ref<DeckLegalityResult | null>(null)

const isSourceModalOpen = ref(false)
const isAddingSourceCard = ref(false)

const sourceActionError = ref('')
const sourceActionMessage = ref('')

const isBasicLandModalOpen = ref(false)
const basicLandAdjustmentMessage = ref('')

/* -------------------------------------------------------------------------- */
/* Store price refresh                                                        */
/* -------------------------------------------------------------------------- */

const STORE_PRICE_REFRESH_CARD_LIMIT = 300
const isRefreshingStorePrices = ref(false)
const storePriceRefreshProgress = ref('')
let storePriceRefreshController: AbortController | null = null

/* -------------------------------------------------------------------------- */
/* Commander scoring                                                          */
/* -------------------------------------------------------------------------- */

const commanderScoresByOracleId = ref<
  Record<
    string,
    {
      score: number
      reasons: NonNullable<CollectionItem['commander_support_reasons']>
      score_breakdown?: NonNullable<CollectionItem['score_breakdown']>
    }
  >
>({})

type ProfileSectionMode = 'category' | 'type'

const profileSectionsByMode = ref<
  Record<ProfileSectionMode, CollectionProfileSection[]>
>({
  category: [],
  type: [],
})

const profileSections = computed(() => {
  if (organizationMode.value === 'category') {
    return profileSectionsByMode.value.category
  }

  if (organizationMode.value === 'type') {
    return profileSectionsByMode.value.type
  }

  return []
})

/* -------------------------------------------------------------------------- */
/* Route / collection metadata                                                */
/* -------------------------------------------------------------------------- */

const collectionId = computed(() =>
  String(route.params.collectionId ?? ''),
)

const addCardZone = computed(() => 'mainboard')

const isMasterCollectionRoute = computed(
  () => collectionId.value === 'master',
)

const isReadOnlyCollection = computed(
  () => collection.value?.is_read_only === true,
)

const isCommanderCollection = computed(
  () => collection.value?.deck_type.toLowerCase() === 'commander',
)

const collectionCardQuantity = computed(() =>
  collection.value?.items.reduce(
    (total, item) => total + item.amount,
    0,
  ) ?? 0,
)

const canRefreshStorePrices = computed(() =>
  isCommanderCollection.value
  && !isReadOnlyCollection.value
  && collectionCardQuantity.value <= STORE_PRICE_REFRESH_CARD_LIMIT,
)

const storePriceRefreshLimitMessage = computed(() =>
  isCommanderCollection.value &&
  !isReadOnlyCollection.value &&
  collectionCardQuantity.value > STORE_PRICE_REFRESH_CARD_LIMIT
    ? `Store prices cannot be refreshed because this collection has ${collectionCardQuantity.value} cards across all zones. The limit is ${STORE_PRICE_REFRESH_CARD_LIMIT}.`
    : '',
)

const legacyBuilderSource = computed(() =>
  typeof route.query.builderSource === 'string'
    ? route.query.builderSource
    : null,
)

const legacyBuilderTheme = computed(() => {
  const rawValue =
    typeof route.query.builderTheme === 'string'
      ? Number(route.query.builderTheme)
      : Number.NaN

  return Number.isFinite(rawValue)
    ? rawValue
    : null
})

const builderSourceCollectionId = computed(
  () =>
    collection.value?.builder_source_collection_id ??
    legacyBuilderSource.value ??
    'master',
)

const builderThemeId = computed(
  () =>
    collection.value?.builder_theme_id ??
    legacyBuilderTheme.value ??
    -1,
)

const commanderItems = computed(
  () =>
    collection.value?.items.filter(
      (item) => item.zone === 'commander',
    ) ?? [],
)

const isCommanderTemplateMode = computed(
  () =>
    collection.value?.deck_type.toLowerCase() === 'commander' &&
    commanderWorkspaceMode.value === 'template',
)

const existingCommanderDeckOracleIds = computed(() =>
  Array.from(
    new Set(
      (collection.value?.items ?? [])
        .filter(
          (item) =>
            item.oracle_id &&
            !isBasicLand(item),
        )
        .map(
          (item) => item.oracle_id as string,
        ),
    ),
  ),
)

const deckValueUsd = computed(
  () =>
    collection.value?.items
      .filter((item) => item.zone !== 'maybeboard')
      .reduce(
        (total, item) =>
          total +
          (item.gameplay_card?.lowest_price_usd ?? 0) *
            item.amount,
        0,
      ) ?? 0,
)

/* -------------------------------------------------------------------------- */
/* Collection derivations                                                     */
/* -------------------------------------------------------------------------- */

function isBasicLand(item: CollectionItem) {
  return (
    item.gameplay_card?.faces.some(
      (face) =>
        face.supertypes.includes('Basic') &&
        face.card_types.includes('Land'),
    ) ?? false
  )
}

const collectionFacetFilters = computed<CollectionFacetFilters>(
  () => ({
    colors: colorFilters.value,
    supertypes: supertypeFilters.value,
    cardTypes: cardTypeFilters.value,
    subtypes: subtypeFilters.value,
  }),
)

const facetOptions = computed(() =>
  collectionFacetOptions(collection.value?.items ?? []),
)

const scoredCollection = computed<CollectionRecord | null>(() => {
  if (!collection.value) {
    return null
  }

  if (!isCommanderCollection.value) {
    return collection.value
  }

  return {
    ...collection.value,
    items: collection.value.items.map((item) => {
      const score = item.oracle_id
        ? commanderScoresByOracleId.value[item.oracle_id]
        : undefined

      return score
        ? {
            ...item,
            commander_support_score: score.score,
            commander_support_reasons: score.reasons,
            score_breakdown: score.score_breakdown,
          }
        : item
    }),
  }
})

const hasSortableScores = computed(
  () =>
    scoredCollection.value?.items.some(
      (item) =>
        item.commander_support_score !== undefined,
    ) ?? false,
)

const filteredCollection = computed<CollectionRecord | null>(() => {
  if (!scoredCollection.value) {
    return null
  }

  const query = filterText.value.trim().toLowerCase()

  const matchingItems = scoredCollection.value.items.filter(
    (item) => {
      const haystack = [
        item.name ?? '',
        item.set_code ?? '',
        item.collector_number ?? '',
        item.lang ?? '',
        item.zone ?? '',
        ...(item.categories ?? []).map(
          (category) => category.name,
        ),
        ...(item.archetypes ?? []).map(
          (archetype) => archetype.name,
        ),
      ]
        .join(' ')
        .toLowerCase()

      return (
        haystack.includes(query) &&
        matchesCollectionFacets(
          item,
          collectionFacetFilters.value,
        )
      )
    },
  )

  return {
    ...scoredCollection.value,
    items: sortCollectionItems(
      matchingItems,
      sortKey.value,
      sortDirection.value,
    ),
  }
})

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

const exportableFilteredItems = computed(() =>
  (filteredCollection.value?.items ?? []).filter(
    (item) =>
      exportOptions.value.includeMaybeboard ||
      item.zone !== 'maybeboard',
  ),
)

const filteredCardCopies = computed(() =>
  exportableFilteredItems.value.reduce(
    (total, item) => total + item.amount,
    0,
  ),
)

const exportText = computed(() =>
  formatCollectionExport(
    exportableFilteredItems.value,
    exportOptions.value,
  ),
)

function exportFilename() {
  const name = (
    collection.value?.name ?? 'collection'
  )
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-$|^-/g, '')

  return `${name || 'collection'}-export.txt`
}

async function copyExport() {
  exportMessage.value = ''

  try {
    await navigator.clipboard.writeText(
      exportText.value,
    )

    exportMessage.value =
      'Export copied to clipboard.'
  } catch {
    exportMessage.value =
      'Could not copy the export. Use Download TXT instead.'
  }
}

function downloadExport() {
  const blob = new Blob(
    [exportText.value],
    {
      type: 'text/plain;charset=utf-8',
    },
  )

  const url =
    window.URL.createObjectURL(blob)

  const link =
    document.createElement('a')

  link.href = url
  link.download = exportFilename()

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.URL.revokeObjectURL(url)

  exportMessage.value = 'Export downloaded.'
}

/* -------------------------------------------------------------------------- */
/* Workspace component                                                        */
/* -------------------------------------------------------------------------- */

const workspaceComponent = computed(() => {
  const deckType =
    collection.value?.deck_type.toLowerCase()

  if (deckType === 'commander') {
    return CommanderWorkspace
  }

  if (deckType === 'standard') {
    return StandardWorkspace
  }

  return BinderWorkspace
})

const workspaceComponentProps = computed(
  () =>
    isCommanderCollection.value
      ? { showScore: true }
      : {},
)

const showCommanderBuilderAction = computed(
  () =>
    collection.value?.deck_type.toLowerCase() ===
    'binder',
)

const showCommanderBuilderResumeAction = computed(
  () =>
    collection.value?.deck_type.toLowerCase() ===
      'commander' &&
    !isReadOnlyCollection.value &&
    Boolean(
      collection.value.commander_oracle_id,
    ),
)

const showMasterSearchAction = computed(
  () => collection.value?.is_virtual === true,
)

const shouldShowManaCurve = computed(() => {
  const deckType =
    collection.value?.deck_type.toLowerCase()

  return (
    deckType === 'commander' ||
    deckType === 'standard'
  )
})

/* -------------------------------------------------------------------------- */
/* Collection metadata                                                        */
/* -------------------------------------------------------------------------- */

function mergeCollectionMetadata(
  updatedCollection: CollectionRecord,
): CollectionRecord {
  const currentCollection = collection.value

  if (!currentCollection) {
    return updatedCollection
  }

  const currentItemsById = new Map(
    currentCollection.items.map(
      (item) => [item.id, item],
    ),
  )

  const currentItemsByCardZone = new Map(
    currentCollection.items.map(
      (item) => [
        `${item.card_id}:${item.zone}`,
        item,
      ],
    ),
  )

  return {
    ...updatedCollection,

    items: updatedCollection.items.map(
      (item) => {
        const existingItem =
          currentItemsById.get(item.id) ??
          currentItemsByCardZone.get(
            `${item.card_id}:${item.zone}`,
          )

        return {
          ...item,

          cmc:
            existingItem?.cmc ??
            item.cmc ??
            0,

          card_types:
            existingItem?.card_types ??
            item.card_types ??
            [],

          categories:
            existingItem?.categories ??
            item.categories ??
            [],

          archetypes:
            existingItem?.archetypes ??
            item.archetypes ??
            [],

          gameplay_card:
            existingItem?.gameplay_card ??
            item.gameplay_card,
        }
      },
    ),
  }
}

function buildItemMetadata(
  gameplayCard: GameplayCard | undefined,
) {
  return {
    cmc: gameplayCard?.cmc ?? 0,

    card_types: Array.from(
      new Set(
        gameplayCard?.faces.flatMap(
          (face) =>
            face.card_types ?? [],
        ) ?? [],
      ),
    ),

    categories:
      gameplayCard?.categories ?? [],

    archetypes:
      gameplayCard?.archetypes ?? [],

    gameplay_card: gameplayCard,
  }
}

async function fetchGameplayCardsByOracleId(
  items: CollectionItem[],
) {
  const oracleIds = Array.from(
    new Set(
      items
        .map((item) => item.oracle_id?.trim())
        .filter(
          (value): value is string =>
            Boolean(value),
        ),
    ),
  )

  if (oracleIds.length === 0) {
    return new Map<string, GameplayCard>()
  }

  const gameplayResponse = await fetch(
    '/api/deck-cards',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        oracle_ids: oracleIds,
      }),
    },
  )

  const gameplayPayload =
    await gameplayResponse
      .json()
      .catch(() => ({}))

  if (
    !gameplayResponse.ok ||
    !gameplayPayload.success ||
    !Array.isArray(gameplayPayload.cards)
  ) {
    const missingIds = Array.isArray(
      gameplayPayload.missing_oracle_ids,
    )
      ? gameplayPayload.missing_oracle_ids.filter(
          (value: unknown): value is string =>
            typeof value === 'string',
        )
      : []
    const namesByOracleId = new Map(
      items
        .filter((item) => item.oracle_id)
        .map((item) => [
          item.oracle_id as string,
          item.name || 'Unknown card',
        ]),
    )
    const missingLabels = missingIds.map(
      (oracleId: string) =>
        `${namesByOracleId.get(oracleId) || 'Unknown card'} (${oracleId})`,
    )

    throw new Error(
      missingLabels.length > 0
        ? `Gameplay data is missing for: ${missingLabels.join(', ')}`
        : gameplayPayload.error ||
          'Unable to load gameplay data for this collection.',
    )
  }

  return new Map(
    (
      gameplayPayload.cards as GameplayCard[]
    ).map(
      (card) => [
        card.oracle_id,
        card,
      ],
    ),
  )
}

async function enrichCollectionWithGameplay(
  baseCollection: CollectionRecord,
  metadataSource: CollectionRecord | null = null,
) {
  const existingMetadataByOracleId =
    new Map(
      (metadataSource?.items ?? [])
        .filter((item) => item.oracle_id)
        .map((item) => [
          item.oracle_id as string,

          {
            cmc: item.cmc ?? 0,
            card_types:
              item.card_types ?? [],
            categories:
              item.categories ?? [],
            archetypes:
              item.archetypes ?? [],
            gameplay_card:
              item.gameplay_card,
          },
        ]),
    )

  const missingItems =
    baseCollection.items.filter(
      (item) =>
        Boolean(item.oracle_id) &&
        !existingMetadataByOracleId.get(
          item.oracle_id as string,
        )?.gameplay_card &&
        Boolean(item.name),
    )

  const fetchedGameplayByOracleId =
    missingItems.length > 0
      ? await fetchGameplayCardsByOracleId(
          missingItems,
        )
      : new Map<string, GameplayCard>()

  return {
    ...baseCollection,

    items: baseCollection.items.map(
      (item) => {
        const existingMetadata =
          item.oracle_id
            ? existingMetadataByOracleId.get(
                item.oracle_id,
              )
            : undefined

        const gameplayCard =
          existingMetadata?.gameplay_card ??
          (item.oracle_id
            ? fetchedGameplayByOracleId.get(
                item.oracle_id,
              )
            : undefined)

        return {
          ...item,

          ...(existingMetadata?.gameplay_card
            ? existingMetadata
            : buildItemMetadata(gameplayCard)),
        }
      },
    ),
  }
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                    */
/* -------------------------------------------------------------------------- */

function syncSavedCollectionSnapshot() {
  if (isMasterCollectionRoute.value || !collection.value) return

  const cards = collection.value.items
    .map((item) => item.gameplay_card)
    .filter((card): card is GameplayCard => Boolean(card))

  collectionStore.setSavedCollection(collection.value, cards)
}

async function refreshCollectionSupplementaryData() {
  syncSavedCollectionSnapshot()
  profileSectionsByMode.value = { category: [], type: [] }
  await loadCommanderScores()
}

async function loadCollection() {
  isLoading.value = true

  loadErrorMessage.value = ''
  errorMessage.value = ''

  commanderScoresByOracleId.value = {}
  profileSectionsByMode.value = {
    category: [],
    type: [],
  }

  try {
    const collectionEndpoint =
      isMasterCollectionRoute.value
        ? '/api/collections/master'
        : `/api/collections/${collectionId.value}`

    const response = await fetch(
      collectionEndpoint,
      {
        headers: {
          ...authHeaders.value,
        },
      },
    )

    const data = await response
      .json()
      .catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()

      await router.replace({
        name: 'login',
        query: {
          redirect: route.fullPath,
        },
      })

      return
    }

    if (
      !response.ok ||
      !data.success ||
      !data.collection
    ) {
      throw new Error(
        data.error ||
          'Unable to load collection workspace.',
      )
    }

    const loadedCollection =
      data.collection as CollectionRecord

    collection.value =
      await enrichCollectionWithGameplay(
        loadedCollection,
      )

    await refreshCollectionSupplementaryData()

    deckLegalityResult.value = null
    hoveredItem.value = null

    organizationMode.value = 'zone'
    commanderWorkspaceMode.value = 'normal'

    viewMode.value =
      collection.value.deck_type.toLowerCase() ===
      'binder'
        ? 'list'
        : 'grid'
  } catch (error) {
    loadErrorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to load collection workspace.'
  } finally {
    isLoading.value = false
  }
}

/* -------------------------------------------------------------------------- */
/* Store price refresh                                                        */
/* -------------------------------------------------------------------------- */

type StorePriceRefreshCard = {
  oracle_id: string
  name: string
}

type StoreName = 'draco' | 'vault'

function stopStorePriceRefresh() {
  storePriceRefreshController?.abort()
  storePriceRefreshController = null
  isRefreshingStorePrices.value = false
  storePriceRefreshProgress.value = ''
}

function updateStorePriceInCollection(
  oracleId: string,
  store: StoreName,
  price: DracoPriceResponse,
) {
  if (!collection.value) return

  collection.value = {
    ...collection.value,
    items: collection.value.items.map((item) => {
      if (item.oracle_id !== oracleId || !item.gameplay_card) return item

      const gameplayCard = { ...item.gameplay_card }
      if (typeof price.price_cop === 'number') {
        if (store === 'draco') gameplayCard.dracostore_price_cop = price.price_cop
        else gameplayCard.vaultstore_price_cop = price.price_cop
      }
      if (store === 'draco') {
        gameplayCard.dracostore_last_updated = price.last_updated
        gameplayCard.dracostore_next_refresh_at = price.next_refresh_at
        gameplayCard.dracostore_price_stale = price.stale
      } else {
        gameplayCard.vaultstore_last_updated = price.last_updated
        gameplayCard.vaultstore_next_refresh_at = price.next_refresh_at
        gameplayCard.vaultstore_price_stale = price.stale
        gameplayCard.vaultstore_product_url = price.product_url ?? null
      }

      return { ...item, gameplay_card: gameplayCard }
    }),
  }
}

async function refreshCollectionStorePrices() {
  if (isRefreshingStorePrices.value || !canRefreshStorePrices.value || !collection.value) return

  const refreshCollectionId = collectionId.value
  const token = authStore.accessToken
  const run = new AbortController()
  storePriceRefreshController = run
  isRefreshingStorePrices.value = true
  errorMessage.value = ''
  storePriceRefreshProgress.value = 'Preparing store price refresh…'

  const isCurrent = () => (
    !run.signal.aborted
    && token === authStore.accessToken
    && refreshCollectionId === collectionId.value
  )

  try {
    const preflight = await fetch(
      `/api/collections/${encodeURIComponent(refreshCollectionId)}/store-price-refresh`,
      {
        method: 'POST',
        headers: { ...authHeaders.value },
        signal: run.signal,
      },
    )
    const payload = await preflight.json().catch(() => ({}))

    if (preflight.status === 401) {
      authStore.logout()
      await router.replace({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    if (!preflight.ok || !payload.success || !Array.isArray(payload.cards)) {
      throw new Error(payload.error || 'Unable to prepare the store price refresh.')
    }
    if (!isCurrent()) return

    const cards = payload.cards as StorePriceRefreshCard[]
    const queue = cards.flatMap((card) =>
      (['draco', 'vault'] as StoreName[]).map((store) => ({ card, store })),
    )
    const total = queue.length
    let completed = 0
    let updated = 0
    let cached = 0
    let unavailable = 0
    let failed = 0
    const renderProgress = () => {
      storePriceRefreshProgress.value = total === 0
        ? 'There are no cards with store price data to refresh.'
        : `${completed}/${total} store checks processed · ${updated} updated · ${cached} cached · ${unavailable} unavailable or stale${failed ? ` · ${failed} failed` : ''}`
    }
    renderProgress()

    async function worker() {
      while (queue.length && isCurrent()) {
        const task = queue.shift()
        if (!task) return
        try {
          const params = new URLSearchParams({ name: task.card.name })
          const response = await fetch(
            `/api/store-prices/${task.store}/${encodeURIComponent(task.card.oracle_id)}?${params}`,
            { signal: run.signal },
          )
          if (!response.ok) throw new Error('Store price check failed.')
          const price = await response.json() as DracoPriceResponse
          if (!isCurrent()) return

          updateStorePriceInCollection(task.card.oracle_id, task.store, price)
          if (price.cache_status === 'refreshed') updated += 1
          else if (price.cache_status === 'cached') cached += 1
          else unavailable += 1
        } catch (error) {
          if (isCurrent()) failed += 1
        } finally {
          if (isCurrent()) {
            completed += 1
            renderProgress()
          }
        }
      }
    }

    await Promise.all([worker(), worker()])
  } catch (error) {
    if (isCurrent()) {
      errorMessage.value = error instanceof Error
        ? error.message
        : 'Unable to refresh store prices.'
      storePriceRefreshProgress.value = ''
    }
  } finally {
    if (isCurrent()) {
      isRefreshingStorePrices.value = false
      storePriceRefreshController = null
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Commander scores                                                           */
/* -------------------------------------------------------------------------- */

async function loadCommanderScores() {
  if (
    !collection.value ||
    !isCommanderCollection.value ||
    !collection.value.commander_oracle_id
  ) {
    commanderScoresByOracleId.value = {}
    return
  }

  const oracleIds = Array.from(
    new Set(
      collection.value.items
        .map((item) => item.oracle_id)
        .filter(
          (id): id is string =>
            Boolean(id),
        ),
    ),
  )

  if (oracleIds.length === 0) {
    commanderScoresByOracleId.value = {}
    return
  }

  const fetchScores = async (
    sourceCollectionId: string,
  ) => {
    const response = await fetch(
      `/api/commander-builder-source/${sourceCollectionId}/${collection.value!.commander_oracle_id}/scores`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
          ...authHeaders.value,
        },

        body: JSON.stringify({
          oracle_ids: oracleIds,
          theme_id: builderThemeId.value,
        }),
      },
    )

    const data = await response
      .json()
      .catch(() => ({}))

    return {
      response,
      data,
    }
  }

  try {
    let { response, data } =
      await fetchScores(
        builderSourceCollectionId.value,
      )

    if (
      response.status === 404 &&
      builderSourceCollectionId.value !==
        'master'
    ) {
      ;({ response, data } =
        await fetchScores('master'))
    }

    commanderScoresByOracleId.value =
      response.ok &&
      data.success &&
      data.scores
        ? data.scores
        : {}
  } catch {
    /**
     * Scoring is supplementary.
     * Keep the collection usable without it.
     */
    commanderScoresByOracleId.value = {}
  }
}

/* -------------------------------------------------------------------------- */
/* Profile sections                                                           */
/* -------------------------------------------------------------------------- */

async function loadProfileSections() {
  if (!collection.value) {
    profileSectionsByMode.value = {
      category: [],
      type: [],
    }
    return
  }

  const endpoint =
    isMasterCollectionRoute.value
      ? '/api/collections/master/sections'
      : `/api/collections/${collection.value.id}/sections`

  async function loadGroup(
    profileGroup: 'categories' | 'types',
  ): Promise<CollectionProfileSection[]> {
    try {
      const response = await fetch(
        `${endpoint}?profile_group=${profileGroup}`,
        {
          headers: {
            ...authHeaders.value,
          },
        },
      )

      const data = await response
        .json()
        .catch(() => ({}))

      return response.ok &&
        data.success &&
        Array.isArray(data.sections)
        ? (data.sections as CollectionProfileSection[])
        : []
    } catch {
      /**
       * Section organization is supplementary.
       * Keep the flat collection usable.
       */
      return []
    }
  }

  const profileGroup = organizationMode.value === 'category' ? 'categories' : 'types'
  const sections = await loadGroup(profileGroup)
  profileSectionsByMode.value = {
    ...profileSectionsByMode.value,
    [organizationMode.value]: sections,
  }
}

/* -------------------------------------------------------------------------- */
/* Deck validation                                                            */
/* -------------------------------------------------------------------------- */

async function validateDeck() {
  if (
    !collection.value ||
    isValidatingDeck.value
  ) {
    return
  }

  isValidatingDeck.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(
      `/api/collections/${collection.value.id}/validate-legality`,
      {
        method: 'POST',

        headers: {
          ...authHeaders.value,
        },
      },
    )

    const data = await response
      .json()
      .catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()

      await router.replace({
        name: 'login',
        query: {
          redirect: route.fullPath,
        },
      })

      return
    }

    if (
      !response.ok ||
      !data.success ||
      !data.validation
    ) {
      throw new Error(
        data.error ||
          'Unable to validate this deck.',
      )
    }

    deckLegalityResult.value =
      data.validation as DeckLegalityResult
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to validate this deck.'
  } finally {
    isValidatingDeck.value = false
  }
}

/* -------------------------------------------------------------------------- */
/* Hover                                                                      */
/* -------------------------------------------------------------------------- */

function handleHoverItem(
  item: CollectionItem | null,
) {
  hoveredItem.value = item
}

/* -------------------------------------------------------------------------- */
/* Item mutations                                                             */
/* -------------------------------------------------------------------------- */

function beginItemMutation(
  itemId: string | number,
) {
  mutatingItemIds.value = [
    ...new Set([
      ...mutatingItemIds.value,
      itemId,
    ]),
  ]
}

function endItemMutation(
  itemId: string | number,
) {
  mutatingItemIds.value =
    mutatingItemIds.value.filter(
      (id) => id !== itemId,
    )
}

async function mutateItemQuantity(
  item: CollectionItem,
  direction: 'increment' | 'decrement',
) {
  if (
    !collection.value ||
    isReadOnlyCollection.value
  ) {
    return
  }

  beginItemMutation(item.id)

  errorMessage.value = ''
  closeContextMenu()

  try {
    const response =
      direction === 'increment'
        ? await fetch(
            `/api/collections/${collection.value.id}/items`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
                ...authHeaders.value,
              },

              body: JSON.stringify({
                card_id: item.card_id,
                zone: item.zone,
                amount: 1,
              }),
            },
          )
        : await fetch(
            `/api/collections/${collection.value.id}/items/${item.id}?amount=1`,
            {
              method: 'DELETE',

              headers: {
                ...authHeaders.value,
              },
            },
          )

    const data = await response
      .json()
      .catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()

      await router.replace({
        name: 'login',
        query: {
          redirect: route.fullPath,
        },
      })

      return
    }

    if (
      !response.ok ||
      !data.success ||
      !data.collection
    ) {
      throw new Error(
        data.error ||
          'Unable to update collection item.',
      )
    }

    const updatedCollection =
      mergeCollectionMetadata(
        data.collection as CollectionRecord,
      )

    collection.value = updatedCollection

    await refreshCollectionSupplementaryData()

    deckLegalityResult.value = null

    hoveredItem.value =
      updatedCollection.items.find(
        (candidate) =>
          candidate.id === item.id,
      ) ?? null
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to update collection item.'
  } finally {
    endItemMutation(item.id)
  }
}

/* -------------------------------------------------------------------------- */
/* Zone mutations                                                             */
/* -------------------------------------------------------------------------- */

async function moveItemToZone(
  item: CollectionItem,
  zone: 'mainboard' | 'maybeboard',
) {
  if (
    !collection.value ||
    isReadOnlyCollection.value ||
    !isCommanderCollection.value
  ) {
    return
  }

  beginItemMutation(item.id)

  errorMessage.value = ''
  closeContextMenu()

  try {
    const response = await fetch(
      `/api/collections/${collection.value.id}/items/${item.id}/zone`,
      {
        method: 'PATCH',

        headers: {
          'Content-Type':
            'application/json',
          ...authHeaders.value,
        },

        body: JSON.stringify({
          zone,
        }),
      },
    )

    const data = await response
      .json()
      .catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()

      await router.replace({
        name: 'login',
        query: {
          redirect: route.fullPath,
        },
      })

      return
    }

    if (
      !response.ok ||
      !data.success ||
      !data.collection
    ) {
      throw new Error(
        data.error ||
          'Unable to move collection item.',
      )
    }

    const updatedCollection =
      mergeCollectionMetadata(
        data.collection as CollectionRecord,
      )

    collection.value = updatedCollection

    await refreshCollectionSupplementaryData()

    deckLegalityResult.value = null
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to move collection item.'
  } finally {
    endItemMutation(item.id)
  }
}

/* -------------------------------------------------------------------------- */
/* Add card search                                                            */
/* -------------------------------------------------------------------------- */

function dismissAddCardSuggestions() {
  addCardSuggestions.value = []
}

async function searchAddCardSuggestions(
  query: string,
  requestId: number,
) {
  addCardSearchController?.abort()

  const controller =
    new AbortController()

  addCardSearchController = controller
  isSearchingCards.value = true

  try {
    const response = await fetch(
      `/api/cards/search?q=${encodeURIComponent(query)}&limit=8&include_tokens=false`,
      {
        signal: controller.signal,
      },
    )

    const data = await response
      .json()
      .catch(() => ({}))

    if (
      requestId !==
      latestAddCardSearchRequest
    ) {
      return
    }

    if (
      !response.ok ||
      !data.success ||
      !Array.isArray(data.cards)
    ) {
      throw new Error(
        data.error ||
          'Unable to search cards.',
      )
    }

    addCardSuggestions.value =
      data.cards as CollectionCardSearchResult[]
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'AbortError'
    ) {
      return
    }

    if (
      requestId ===
      latestAddCardSearchRequest
    ) {
      addCardSuggestions.value = []

      errorMessage.value =
        error instanceof Error
          ? error.message
          : 'Unable to search cards.'
    }
  } finally {
    if (
      requestId ===
        latestAddCardSearchRequest &&
      addCardSearchController === controller
    ) {
      isSearchingCards.value = false
      addCardSearchController = null
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Add cards                                                                  */
/* -------------------------------------------------------------------------- */

async function addSuggestedCard(
  suggestion: CollectionCardSearchResult,
) {
  if (
    !collection.value ||
    isAddingCard.value ||
    isReadOnlyCollection.value
  ) {
    return
  }

  isAddingCard.value = true

  errorMessage.value = ''
  addCardQuery.value = ''

  dismissAddCardSuggestions()

  try {
    await addCardToMainboard(
      suggestion.card_id,
    )
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to add card to collection.'
  } finally {
    isAddingCard.value = false
  }
}

async function addCardToMainboard(
  cardId: string,
) {
  if (
    !collection.value ||
    isReadOnlyCollection.value
  ) {
    return
  }

  const response = await fetch(
    `/api/collections/${collection.value.id}/items`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
        ...authHeaders.value,
      },

      body: JSON.stringify({
        card_id: cardId,
        zone: addCardZone.value,
        amount: 1,
      }),
    },
  )

  const data = await response
    .json()
    .catch(() => ({}))

  if (response.status === 401) {
    authStore.logout()

    await router.replace({
      name: 'login',
      query: {
        redirect: route.fullPath,
      },
    })

    throw new Error(
      'Authentication required.',
    )
  }

  if (
    !response.ok ||
    !data.success ||
    !data.collection
  ) {
    throw new Error(
      data.error ||
        'Unable to add card to collection.',
    )
  }

  const mergedCollection =
    mergeCollectionMetadata(
      data.collection as CollectionRecord,
    )

  collection.value =
    await enrichCollectionWithGameplay(
      mergedCollection,
      collection.value,
    )

  await refreshCollectionSupplementaryData()

  deckLegalityResult.value = null
}

/* -------------------------------------------------------------------------- */
/* Commander builder source                                                   */
/* -------------------------------------------------------------------------- */

async function addSourceCard(
  item: CollectionItem,
) {
  if (isAddingSourceCard.value) {
    return
  }

  isAddingSourceCard.value = true

  sourceActionError.value = ''
  sourceActionMessage.value = ''

  try {
    await addCardToMainboard(
      item.card_id,
    )

    sourceActionMessage.value =
      `Added ${item.name || 'card'} to the deck.`
  } catch (error) {
    sourceActionError.value =
      error instanceof Error
        ? error.message
        : 'Unable to add source card.'
  } finally {
    isAddingSourceCard.value = false
  }
}

/* -------------------------------------------------------------------------- */
/* Context menu                                                               */
/* -------------------------------------------------------------------------- */

async function handleContextMenu(
  payload: CollectionCardContextMenuPayload,
) {
  const requestId =
    ++latestContextMenuRequest

  contextMenuState.value = {
    ...payload,
  }

  await nextTick()

  if (
    requestId !== latestContextMenuRequest
  ) {
    return
  }

  const menu = contextMenuElement.value
  const state = contextMenuState.value

  if (!menu || !state) {
    return
  }

  const rect =
    menu.getBoundingClientRect()

  const margin = 8

  const maxX = Math.max(
    margin,
    window.innerWidth -
      rect.width -
      margin,
  )

  const maxY = Math.max(
    margin,
    window.innerHeight -
      rect.height -
      margin,
  )

  contextMenuState.value = {
    ...state,

    x: Math.min(
      Math.max(payload.x, margin),
      maxX,
    ),

    y: Math.min(
      Math.max(payload.y, margin),
      maxY,
    ),
  }
}

function closeContextMenu() {
  latestContextMenuRequest += 1
  contextMenuState.value = null
}

/* -------------------------------------------------------------------------- */
/* Printing                                                                   */
/* -------------------------------------------------------------------------- */

function openPrintPicker() {
  const item =
    contextMenuState.value?.item

  if (
    !item?.oracle_id ||
    isReadOnlyCollection.value
  ) {
    return
  }

  printPickerItem.value = item

  closeContextMenu()
}

async function replacePrint(
  cardId: string,
) {
  const item = printPickerItem.value

  if (
    !collection.value ||
    !item ||
    isReplacingPrint.value
  ) {
    return
  }

  isReplacingPrint.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(
      `/api/collections/${collection.value.id}/items/${item.id}/print`,
      {
        method: 'PATCH',

        headers: {
          'Content-Type':
            'application/json',
          ...authHeaders.value,
        },

        body: JSON.stringify({
          card_id: cardId,
        }),
      },
    )

    const data = await response
      .json()
      .catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()

      await router.replace({
        name: 'login',
        query: {
          redirect: route.fullPath,
        },
      })

      return
    }

    if (
      !response.ok ||
      !data.success ||
      !data.collection
    ) {
      throw new Error(
        data.error ||
          'Unable to replace printing.',
      )
    }

    const updated =
      mergeCollectionMetadata(
        data.collection as CollectionRecord,
      )

    collection.value =
      await enrichCollectionWithGameplay(
        updated,
        collection.value,
      )

    printPickerItem.value = null
    hoveredItem.value = null
    deckLegalityResult.value = null

    await refreshCollectionSupplementaryData()
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to replace printing.'
  } finally {
    isReplacingPrint.value = false
  }
}

/* -------------------------------------------------------------------------- */
/* Basic lands                                                                */
/* -------------------------------------------------------------------------- */

function openBasicLandAdjustModal() {
  if (
    !collection.value ||
    !isCommanderCollection.value ||
    isReadOnlyCollection.value
  ) {
    return
  }

  basicLandAdjustmentMessage.value = ''
  isBasicLandModalOpen.value = true
}

async function handleBasicLandUnauthorized() {
  isBasicLandModalOpen.value = false

  authStore.logout()

  await router.replace({
    name: 'login',
    query: {
      redirect: route.fullPath,
    },
  })
}

async function handleBasicLandAdjusted(
  updatedCollection: CollectionRecord,
  adjustment: BasicLandAdjustment,
) {
  const mergedCollection =
    mergeCollectionMetadata(
      updatedCollection,
    )

  collection.value =
    await enrichCollectionWithGameplay(
      mergedCollection,
      collection.value,
    )

  hoveredItem.value = null
  deckLegalityResult.value = null
  isBasicLandModalOpen.value = false

  basicLandAdjustmentMessage.value =
    adjustment.target_reached
      ? `Basic lands adjusted to ${adjustment.reachable_land_count} total lands.`
      : adjustment.warning ||
        `Basic lands adjusted to ${adjustment.reachable_land_count} total lands.`

  await refreshCollectionSupplementaryData()
}

/* -------------------------------------------------------------------------- */
/* Card details                                                               */
/* -------------------------------------------------------------------------- */

function openCardDetails() {
  const item =
    contextMenuState.value?.item

  if (!item?.oracle_id) {
    closeContextMenu()
    return
  }

  const routeData = router.resolve({
    name: 'card-detail',

    params: {
      id: item.oracle_id,
    },
  })

  window.open(
    routeData.href,
    '_blank',
    'noopener,noreferrer',
  )

  closeContextMenu()
}

function openItemCardDetails(
  item: CollectionItem,
) {
  if (!item.oracle_id) {
    return
  }

  const routeData = router.resolve({
    name: 'card-detail',

    params: {
      id: item.oracle_id,
    },
  })

  window.open(
    routeData.href,
    '_blank',
    'noopener,noreferrer',
  )
}

/* -------------------------------------------------------------------------- */
/* Commander mutation                                                         */
/* -------------------------------------------------------------------------- */

async function mutateCommander(
  item: CollectionItem,
  action: 'set' | 'remove',
) {
  if (
    !collection.value ||
    isReadOnlyCollection.value ||
    isMutatingCommander.value
  ) {
    return
  }

  isMutatingCommander.value = true

  errorMessage.value = ''
  closeContextMenu()

  try {
    const response =
      action === 'set'
        ? await fetch(
            `/api/collections/${collection.value.id}/commander`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
                ...authHeaders.value,
              },

              body: JSON.stringify({
                item_id: item.id,
              }),
            },
          )
        : await fetch(
            `/api/collections/${collection.value.id}/commander/${item.id}`,
            {
              method: 'DELETE',

              headers: {
                ...authHeaders.value,
              },
            },
          )

    const data = await response
      .json()
      .catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()

      await router.replace({
        name: 'login',
        query: {
          redirect: route.fullPath,
        },
      })

      return
    }

    if (
      !response.ok ||
      !data.success ||
      !data.collection
    ) {
      throw new Error(
        data.error ||
          'Unable to update commander.',
      )
    }

    const updated =
      mergeCollectionMetadata(
        data.collection as CollectionRecord,
      )

    collection.value =
      await enrichCollectionWithGameplay(
        updated,
        collection.value,
      )

    isSourceModalOpen.value = false
    deckLegalityResult.value = null

    await refreshCollectionSupplementaryData()
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to update commander.'
  } finally {
    isMutatingCommander.value = false
  }
}

/* -------------------------------------------------------------------------- */
/* Global input                                                               */
/* -------------------------------------------------------------------------- */

function handleGlobalPointer() {
  closeContextMenu()
}

function handleGlobalEscape(
  event: KeyboardEvent,
) {
  if (event.key === 'Escape') {
    closeContextMenu()
    return
  }

  const target = event.target

  /**
   * Don't trigger collection keyboard shortcuts
   * while the user is typing.
   */
  if (
    target instanceof HTMLElement &&
    (
      target.matches(
        'input, textarea, select',
      ) ||
      target.isContentEditable
    )
  ) {
    return
  }

  const item =
    contextMenuState.value?.item

  if (
    !item ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat
  ) {
    return
  }

  const key =
    event.key.toLowerCase()

  if (
    key === 'm' &&
    item.zone === 'mainboard'
  ) {
    event.preventDefault()

    void moveItemToZone(
      item,
      'maybeboard',
    )
  } else if (
    key === 'a' &&
    item.zone === 'maybeboard'
  ) {
    event.preventDefault()

    void moveItemToZone(
      item,
      'mainboard',
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

function goToCommanderBuilder() {
  if (
    !collection.value ||
    collection.value.deck_type.toLowerCase() !==
      'binder'
  ) {
    return
  }

  void router.push({
    name: 'collection-possible-commanders',

    params: {
      collectionId: String(
        collection.value.id,
      ),
    },
  })
}

function reopenCommanderBuilder() {
  if (
    !collection.value?.commander_oracle_id
  ) {
    return
  }

  sourceActionError.value = ''
  sourceActionMessage.value = ''

  isSourceModalOpen.value = true
}

function closeSourceBrowser() {
  isSourceModalOpen.value = false

  sourceActionError.value = ''
  sourceActionMessage.value = ''
}

function goToMasterAdvancedSearch() {
  void router.push({
    name: 'advanced-search',

    query: {
      scope: 'master',
    },
  })
}

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

onMounted(() => {
  window.addEventListener(
    'click',
    handleGlobalPointer,
  )

  window.addEventListener(
    'scroll',
    handleGlobalPointer,
    true,
  )

  window.addEventListener(
    'resize',
    handleGlobalPointer,
  )

  window.addEventListener(
    'keydown',
    handleGlobalEscape,
  )

  void loadCollection()
})

onBeforeUnmount(() => {
  stopStorePriceRefresh()
  if (addCardSearchTimeout !== null) {
    window.clearTimeout(
      addCardSearchTimeout,
    )
  }

  addCardSearchController?.abort()

  window.removeEventListener(
    'click',
    handleGlobalPointer,
  )

  window.removeEventListener(
    'scroll',
    handleGlobalPointer,
    true,
  )

  window.removeEventListener(
    'resize',
    handleGlobalPointer,
  )

  window.removeEventListener(
    'keydown',
    handleGlobalEscape,
  )
})

/* -------------------------------------------------------------------------- */
/* Watchers                                                                   */
/* -------------------------------------------------------------------------- */

watch(
  () => authStore.accessToken,
  () => stopStorePriceRefresh(),
)

watch(
  collectionId,
  (newId, oldId) => {
    if (newId !== oldId) {
      closeContextMenu()
      dismissAddCardSuggestions()
      stopStorePriceRefresh()

      void loadCollection()
    }
  },
)

watch(
  organizationMode,
  (mode) => {
    if (mode === 'zone' || !collection.value) return
    const current = profileSectionsByMode.value[mode]
    if (current.length === 0) void loadProfileSections()
  },
)

watch(
  hasSortableScores,
  (hasScores) => {
    if (
      !hasScores &&
      sortKey.value === 'score'
    ) {
      sortKey.value = 'name'
      sortDirection.value = 'asc'
    }
  },
)

watch(
  viewMode,
  (mode) => {
    if (mode !== 'list') {
      hoveredItem.value = null
    }

    closeContextMenu()
  },
)

watch(
  () =>
    exportOptions.value.includeSetCode,
  (includeSetCode) => {
    if (!includeSetCode) {
      exportOptions.value.includeCollectorNumber =
        false
    }

    exportMessage.value = ''
  },
)

watch(
  [
    filterText,
    colorFilters,
    supertypeFilters,
    cardTypeFilters,
    subtypeFilters,
  ],
  () => {
    hoveredItem.value = null

    exportMessage.value = ''

    closeContextMenu()
  },
)

watch(
  [sortKey, sortDirection],
  () => {
    exportMessage.value = ''
  },
)

watch(
  addCardQuery,
  (value) => {
    const query = value.trim()

    if (
      addCardSearchTimeout !== null
    ) {
      window.clearTimeout(
        addCardSearchTimeout,
      )

      addCardSearchTimeout = null
    }

    if (query.length < 3) {
      latestAddCardSearchRequest += 1

      addCardSearchController?.abort()
      addCardSearchController = null

      isSearchingCards.value = false

      dismissAddCardSuggestions()

      return
    }

    addCardSearchTimeout =
      window.setTimeout(() => {
        latestAddCardSearchRequest += 1

        void searchAddCardSuggestions(
          query,
          latestAddCardSearchRequest,
        )
      }, 250)
  },
)
</script>

<template>
  <div class="workspace-page">
    <section class="workspace-shell">
      <!-- Loading --------------------------------------------------------- -->

      <div
        v-if="isLoading"
        class="loading-panel skeleton-pulse"
        role="status"
        aria-live="polite"
      >
        <div class="loading-copy">
          <h2>
            Loading collection workspace...
          </h2>
        </div>
      </div>

      <!-- Fatal load error ------------------------------------------------ -->

      <div
        v-else-if="loadErrorMessage"
        class="state-panel error"
      >
        <h2>
          Unable to load collection
        </h2>

        <p>
          {{ loadErrorMessage }}
        </p>
      </div>

      <!-- Workspace ------------------------------------------------------- -->

      <template
        v-else-if="
          collection &&
          filteredCollection
        "
      >
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

        <!-- Deck analytics ------------------------------------------------ -->

        <CollectionManaCurve
          v-if="shouldShowManaCurve"
          :collection="collection"
        />

        <!-- Export -------------------------------------------------------- -->

        <section class="export-panel">
          <div class="export-summary">
            <div class="export-heading">
              <span class="export-title">
                Export filtered cards
              </span>

              <span class="export-count">
                {{ filteredCardCopies }}
                cards ·
                {{ exportableFilteredItems.length }}
                entries
              </span>
            </div>

            <span
              v-if="exportMessage"
              class="export-message"
              role="status"
            >
              {{ exportMessage }}
            </span>
          </div>

          <div class="export-actions">
            <details
              class="export-options-menu"
            >
              <summary>
                Options
              </summary>

              <div class="export-options">
                <label>
                  <input
                    v-model="exportOptions.includeMaybeboard"
                    type="checkbox"
                  >

                  Include Maybeboard
                </label>

                <label>
                  <input
                    v-model="exportOptions.includeSectionHeaders"
                    type="checkbox"
                  >

                  Generic section headers
                </label>

                <label>
                  <input
                    v-model="exportOptions.includeSetCode"
                    type="checkbox"
                  >

                  Set code
                </label>

                <label
                  :class="{
                    disabled:
                      !exportOptions.includeSetCode,
                  }"
                >
                  <input
                    v-model="exportOptions.includeCollectorNumber"
                    type="checkbox"
                    :disabled="!exportOptions.includeSetCode"
                  >

                  Collector number
                </label>

                <label>
                  <input
                    v-model="exportOptions.includeColorTags"
                    type="checkbox"
                  >

                  Color tags
                </label>
              </div>
            </details>

            <button
              type="button"
              class="export-button export-button-primary"
              :disabled="!exportText"
              @click="copyExport"
            >
              Copy
            </button>

            <button
              type="button"
              class="export-button"
              :disabled="!exportText"
              @click="downloadExport"
            >
              Download TXT
            </button>
          </div>
        </section>

        <!-- Workspace feedback ------------------------------------------- -->

        <div
          v-if="errorMessage"
          class="workspace-message workspace-message-error"
          role="alert"
        >
          <span>
            {{ errorMessage }}
          </span>

          <button
            type="button"
            class="workspace-message-dismiss"
            aria-label="Dismiss error"
            @click="errorMessage = ''"
          >
            ×
          </button>
        </div>

        <p
          v-if="basicLandAdjustmentMessage"
          class="workspace-message workspace-message-success"
          role="status"
        >
          {{ basicLandAdjustmentMessage }}
        </p>

        <p
          v-if="storePriceRefreshLimitMessage"
          class="workspace-message workspace-message-error"
          role="status"
        >
          {{ storePriceRefreshLimitMessage }}
        </p>

        <p
          v-if="storePriceRefreshProgress"
          class="workspace-message workspace-message-success"
          role="status"
          aria-live="polite"
        >
          {{ storePriceRefreshProgress }}
        </p>

        <!--
          The toolbar and the cards are deliberately one workspace.

          Add card, filters, sorting, organization and view controls
          remain immediately above the cards they affect.
        -->

        <section class="deck-workspace">
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
            :show-store-price-refresh="isCommanderCollection && !isReadOnlyCollection"
            :store-price-refresh-disabled="!canRefreshStorePrices || isRefreshingStorePrices"
            :store-price-refresh-label="isRefreshingStorePrices ? 'Refreshing…' : 'Refresh store prices'"
            @adjust-basic-lands="openBasicLandAdjustModal"
            @refresh-store-prices="refreshCollectionStorePrices"
            @select-add-card-suggestion="addSuggestedCard"
            @dismiss-add-card-suggestions="dismissAddCardSuggestions"
          />

          <!-- Empty result ----------------------------------------------- -->

          <div
            v-if="
              filteredCollection.items.length === 0 &&
              !isCommanderTemplateMode
            "
            class="state-panel state-panel-compact"
          >
            <h2>
              No cards match this filter
            </h2>

            <p>
              Try a different local filter or clear the current search.
            </p>
          </div>

          <!-- Commander template list ------------------------------------ -->

          <div
            v-else-if="
              isCommanderTemplateMode &&
              viewMode === 'list'
            "
            class="workspace-content-grid"
          >
            <main class="workspace-main">
              <CommanderDeckTemplate
                :collection="filteredCollection"
                :commander-items="commanderItems"
                :view-mode="viewMode"
                :mutating-item-ids="mutatingItemIds"
                :show-quantity-actions="!isReadOnlyCollection"
                @hover-item="handleHoverItem"
                @context-menu="handleContextMenu"
                @increment-item="mutateItemQuantity($event, 'increment')"
                @decrement-item="mutateItemQuantity($event, 'decrement')"
              />
            </main>

            <aside class="workspace-preview">
              <CollectionHoverPreview
                :item="hoveredItem"
              />
            </aside>
          </div>

          <!-- Commander template grid ------------------------------------ -->

          <CommanderDeckTemplate
            v-else-if="isCommanderTemplateMode"
            :collection="filteredCollection"
            :commander-items="commanderItems"
            :view-mode="viewMode"
            :mutating-item-ids="mutatingItemIds"
            :show-quantity-actions="!isReadOnlyCollection"
            @context-menu="handleContextMenu"
            @increment-item="mutateItemQuantity($event, 'increment')"
            @decrement-item="mutateItemQuantity($event, 'decrement')"
          />

          <!-- Standard workspace list ------------------------------------ -->

          <div
            v-else-if="viewMode === 'list'"
            class="workspace-content-grid"
          >
            <main class="workspace-main">
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
            </main>

            <aside class="workspace-preview">
              <CommanderBuilderHoverPreview
                v-if="isCommanderCollection"
                :item="hoveredItem"
              />

              <CollectionHoverPreview
                v-else
                :item="hoveredItem"
              />
            </aside>
          </div>

          <!-- Standard workspace grid ------------------------------------ -->

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
        </section>

        <!-- Context menu -------------------------------------------------- -->

        <Teleport to="body">
          <div
            v-if="contextMenuState"
            ref="contextMenuElement"
            class="context-menu"
            :style="{
              left: `${contextMenuState.x}px`,
              top: `${contextMenuState.y}px`,
            }"
            @click.stop
          >
            <button
              class="context-menu-action"
              type="button"
              :disabled="!contextMenuState.item.oracle_id"
              @click="openCardDetails"
            >
              <span>
                Show card details
              </span>
            </button>

            <button
              v-if="
                !isReadOnlyCollection &&
                contextMenuState.item.oracle_id
              "
              class="context-menu-action"
              type="button"
              @click="openPrintPicker"
            >
              <span>
                Change printing
              </span>
            </button>

            <button
              v-if="
                collection.deck_type.toLowerCase() === 'commander' &&
                !isReadOnlyCollection
              "
              class="context-menu-action"
              type="button"
              :disabled="isMutatingCommander"
              @click="
                mutateCommander(
                  contextMenuState.item,
                  contextMenuState.item.zone === 'commander'
                    ? 'remove'
                    : 'set',
                )
              "
            >
              <span>
                {{
                  contextMenuState.item.zone === 'commander'
                    ? 'Remove as commander'
                    : 'Set as commander'
                }}
              </span>
            </button>

            <button
              v-if="
                isCommanderCollection &&
                !isReadOnlyCollection &&
                contextMenuState.item.zone === 'mainboard'
              "
              class="context-menu-action"
              type="button"
              :disabled="
                mutatingItemIds.includes(
                  contextMenuState.item.id,
                )
              "
              @click="
                moveItemToZone(
                  contextMenuState.item,
                  'maybeboard',
                )
              "
            >
              <span>
                Move to Maybeboard
              </span>

              <kbd>M</kbd>
            </button>

            <button
              v-else-if="
                isCommanderCollection &&
                !isReadOnlyCollection &&
                contextMenuState.item.zone === 'maybeboard'
              "
              class="context-menu-action"
              type="button"
              :disabled="
                mutatingItemIds.includes(
                  contextMenuState.item.id,
                )
              "
              @click="
                moveItemToZone(
                  contextMenuState.item,
                  'mainboard',
                )
              "
            >
              <span>
                Move to Mainboard
              </span>

              <kbd>A</kbd>
            </button>
          </div>
        </Teleport>

        <!-- Modals -------------------------------------------------------- -->

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

<style scoped src="./CollectionWorkspaceView.css"></style>