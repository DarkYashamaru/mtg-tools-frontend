<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CollectionHeader from '@/components/collection/CollectionHeader.vue'
import CommanderBuilderHoverPreview from '@/components/collection/CommanderBuilderHoverPreview.vue'
import CollectionManaCurve from '@/components/collection/CollectionManaCurve.vue'
import CollectionToolbar from '@/components/collection/CollectionToolbar.vue'
import CommanderWorkspace from '@/components/collection/CommanderWorkspace.vue'
import CommanderBuilderSourceList from '@/components/collection/CommanderBuilderSourceList.vue'
import type {
  CollectionCardContextMenuPayload,
  CollectionCardSearchResult,
  CollectionItem,
  CollectionRecord,
  WorkspaceOrganizationMode,
  WorkspaceViewMode,
} from '@/components/collection/types'
import { createCustomTheme, isCustomThemeId } from '@/constants/commanderThemes'
import { useAuthStore } from '@/stores/authStore'
import type { GameplayCard } from '@/types/gameplayCard'
import type { CardThemeResponse } from '@/utils/deckScorer'

type SourcePool = 'collection' | 'all'
type SourceMode = 'sections' | 'spotlight'

type SourceOverviewEntry = {
  oracle_id: string
  name: string
  score: number
  reasons: NonNullable<CollectionItem['commander_support_reasons']>
  score_breakdown?: NonNullable<CollectionItem['score_breakdown']>
  source_item: Pick<CollectionItem, 'card_id' | 'image_uri' | 'amount' | 'zone'>
}

type SourceTab = {
  key: string
  title: string
  description: string
  entries: SourceOverviewEntry[]
  items: CollectionItem[]
  entryTotal: number
  nextOffset: number
  hasMore: boolean
  isLoading: boolean
  loadError: string
}

type SourceMetadataResponse = {
  success: boolean
  scope: SourcePool
  candidate_total: number | null
  sections: Array<Pick<SourceTab, 'key' | 'title' | 'description'> & { entry_total: number }>
}

type SourcePageResponse = SourceMetadataResponse & {
  section: {
    key: string
    entries: SourceOverviewEntry[]
    entry_total: number
    next_offset: number
    has_more: boolean
  }
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { authHeaders } = storeToRefs(authStore)

const isLoading = ref(true)
const errorMessage = ref('')

const sourceCollection = ref<CollectionRecord | null>(null)
const builderCollection = ref<CollectionRecord | null>(null)

const activeTheme = ref<CardThemeResponse | null>(null)

const selectedSourcePool = ref<SourcePool>('collection')
const sourceMode = ref<SourceMode>('sections')
const sourceTabsByPool = ref<Record<SourcePool, SourceTab[]>>({ collection: [], all: [] })
const spotlightTabsByPool = ref<Record<SourcePool, SourceTab[]>>({ collection: [], all: [] })
const activeSourceTabKey = ref<string>('ramp')
const isLoadingAllSource = ref(false)
const sourcePoolError = ref('')
const builderScoresByOracleId = ref<Record<string, SourceOverviewEntry>>({})

const sourceTabs = computed(() => (sourceMode.value === 'spotlight' ? spotlightTabsByPool.value : sourceTabsByPool.value)[selectedSourcePool.value])

const viewMode = ref<WorkspaceViewMode>('grid')
const organizationMode = ref<WorkspaceOrganizationMode>('section')

const filterText = ref('')

const addCardQuery = ref('')
const addCardSuggestions = ref<CollectionCardSearchResult[]>([])
const isSearchingCards = ref(false)
const isAddingDirectCard = ref(false)
const isAddingSourceCard = ref(false)

const hoveredItem = ref<CollectionItem | null>(null)
const hoveredSourceItem = ref<CollectionItem | null>(null)

const contextMenuState = ref<CollectionCardContextMenuPayload | null>(null)

const mutatingItemIds = ref<Array<string | number>>([])

let addCardSearchTimeout: ReturnType<typeof window.setTimeout> | null = null
let latestAddCardSearchRequest = 0

const sourceCollectionId = computed(() =>
  String(route.params.collectionId ?? ''),
)

const builderCollectionId = computed(() =>
  String(route.params.builderCollectionId ?? ''),
)

const commanderId = computed(() =>
  String(route.params.commanderId ?? ''),
)

const themeId = computed(() => {
  const parsed = Number(route.params.themeId)
  return Number.isFinite(parsed) ? parsed : null
})

const activeSourceTab = computed(() => {
  return (
    sourceTabs.value.find(
      (tab) => tab.key === activeSourceTabKey.value,
    ) ?? sourceTabs.value[0]
  )
})

const highestSourceEntryByOracleId = computed(() => {
  const entriesByOracleId = new Map<string, SourceOverviewEntry>(
    Object.entries(builderScoresByOracleId.value),
  )

  for (const section of sourceTabs.value) {
    for (const entry of section.entries) {
      const current = entriesByOracleId.get(entry.oracle_id)
      if (!current || entry.score > current.score) entriesByOracleId.set(entry.oracle_id, entry)
    }
  }

  return entriesByOracleId
})

const scoredBuilderCollection = computed<CollectionRecord | null>(() => {
  if (!builderCollection.value) {
    return null
  }

  return {
    ...builderCollection.value,

    items: builderCollection.value.items.map((item) => {
      const sourceEntry = item.oracle_id
        ? highestSourceEntryByOracleId.value.get(item.oracle_id)
        : undefined

      if (!sourceEntry) {
        return item
      }

      return {
        ...item,
        commander_support_score: sourceEntry.score,
        commander_support_reasons: sourceEntry.reasons,
        score_breakdown: sourceEntry.score_breakdown,
        gameplay_card: item.gameplay_card,
      }
    }),
  }
})

const filteredBuilderCollection =
  computed<CollectionRecord | null>(() => {
    if (!scoredBuilderCollection.value) {
      return null
    }

    const query = filterText.value
      .trim()
      .toLowerCase()

    if (!query) {
      return scoredBuilderCollection.value
    }

    return {
      ...scoredBuilderCollection.value,

      items: scoredBuilderCollection.value.items.filter(
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

          return haystack.includes(query)
        },
      ),
    }
  })

const builderSummary = computed(() => ({
  sourceCards: sourceTabs.value.reduce(
    (sum, tab) => sum + tab.entryTotal,
    0,
  ),

  builderCards:
    builderCollection.value?.item_count ?? 0,
}))

function buildItemMetadata(
  gameplayCard: GameplayCard | undefined,
) {
  return {
    cmc: gameplayCard?.cmc ?? 0,

    card_types: Array.from(
      new Set(
        gameplayCard?.faces.flatMap(
          (face) => face.card_types ?? [],
        ) ?? [],
      ),
    ),

    color_identity:
      gameplayCard?.color_identity ?? [],

    tags:
      gameplayCard?.tags ?? {
        direct: [],
        inherited: [],
      },

    categories:
      gameplayCard?.categories ?? [],

    archetypes:
      gameplayCard?.archetypes ?? [],

    gameplay_card: gameplayCard,
  }
}

function overviewEntryToCollectionItem(
  sectionKey: string,
  entry: SourceOverviewEntry,
  index: number,
): CollectionItem {
  return {
    id: `${selectedSourcePool.value}-${sectionKey}-${entry.oracle_id}-${index}`,
    card_id: entry.source_item.card_id,
    oracle_id: entry.oracle_id,
    name: entry.name,
    commander_support_score: entry.score,
    commander_support_reasons: entry.reasons,
    score_breakdown: entry.score_breakdown,
    cmc: 0,
    card_types: [],
    color_identity: [],
    tags: { direct: [], inherited: [] },
    categories: [],
    archetypes: [],
    set_code: null,
    collector_number: null,
    lang: null,
    image_uri: entry.source_item.image_uri,
    amount: entry.source_item.amount,
    zone: entry.source_item.zone,
  }
}

function makeSourceTab(section: SourceMetadataResponse['sections'][number]): SourceTab {
  return {
    key: section.key,
    title: section.title,
    description: section.description,
    entries: [],
    items: [],
    entryTotal: section.entry_total,
    nextOffset: 0,
    hasMore: section.entry_total > 0,
    isLoading: false,
    loadError: '',
  }
}

async function fetchGameplayCardsByName(
  items: CollectionItem[],
) {
  const uniqueNames = Array.from(
    new Set(
      items
        .map((item) => item.name?.trim())
        .filter(
          (value): value is string =>
            Boolean(value),
        ),
    ),
  )

  if (uniqueNames.length === 0) {
    return new Map<string, GameplayCard>()
  }

  const gameplayResponse = await fetch(
    '/api/deck-cards',
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        deck_text: uniqueNames
          .map((name) => `1 ${name}`)
          .join('\n'),
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
    throw new Error(
      gameplayPayload.error ||
        'Unable to load gameplay data for this collection.',
    )
  }

  return new Map(
    (
      gameplayPayload.cards as GameplayCard[]
    ).map((card) => [
      card.oracle_id,
      card,
    ]),
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

            color_identity:
              item.color_identity ?? [],

            tags:
              item.tags ?? {
                direct: [],
                inherited: [],
              },

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
      ? await fetchGameplayCardsByName(
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

function mergeCollectionMetadata(
  currentCollection: CollectionRecord | null,
  updatedCollection: CollectionRecord,
): CollectionRecord {
  if (!currentCollection) {
    return updatedCollection
  }

  const currentItemsById = new Map(
    currentCollection.items.map(
      (item) => [item.id, item],
    ),
  )

  const currentItemsByCardZone =
    new Map(
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
            existingItem?.cmc ?? 0,

          card_types:
            existingItem?.card_types ??
            [],

          color_identity:
            existingItem?.color_identity ??
            [],

          tags:
            existingItem?.tags ?? {
              direct: [],
              inherited: [],
            },

          categories:
            existingItem?.categories ?? [],

          archetypes:
            existingItem?.archetypes ?? [],

          gameplay_card:
            existingItem?.gameplay_card,
        }
      },
    ),
  }
}

async function fetchCollectionRecord(
  collectionId: string,
) {
  const response = await fetch(
    `/api/collections/${collectionId}`,
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
        'Unable to load collection.',
    )
  }

  return data.collection as CollectionRecord
}

async function loadThemeProfile() {
  if (
    !commanderId.value ||
    themeId.value === null
  ) {
    return null
  }

  if (isCustomThemeId(themeId.value)) {
    return createCustomTheme() as CardThemeResponse
  }

  const response = await fetch(
    `/api/themes/by-commander/${commanderId.value}`,
  )

  if (!response.ok) {
    throw new Error(
      'Failed to pull commander theme profiles.',
    )
  }

  const themes = await response.json()

  return Array.isArray(themes)
    ? themes.find(
        (theme) =>
          Number(theme.theme_id) ===
          themeId.value,
      ) ?? null
    : null
}

async function loadSourceMetadata(pool: SourcePool) {
  const response = await fetch(
    `/api/commander-builder-source/${sourceCollectionId.value}/${commanderId.value}?scope=${pool}`,
    { headers: { ...authHeaders.value } },
  )
  const data = await response.json().catch(() => ({}))
  if (response.status === 401) {
    authStore.logout()
    await router.replace({ name: 'login', query: { redirect: route.fullPath } })
    throw new Error('Authentication required.')
  }
  if (!response.ok || !data.success || !Array.isArray(data.sections)) {
    throw new Error(data.error || 'Unable to load source section profiles.')
  }
  const payload = data as SourceMetadataResponse
  sourceTabsByPool.value = {
    ...sourceTabsByPool.value,
    [pool]: payload.sections.map(makeSourceTab),
  }
}

function updateSourceTab(pool: SourcePool, tabKey: string, update: (tab: SourceTab) => SourceTab) {
  sourceTabsByPool.value = {
    ...sourceTabsByPool.value,
    [pool]: sourceTabsByPool.value[pool].map((tab) => tab.key === tabKey ? update(tab) : tab),
  }
}

async function loadSectionPage(pool: SourcePool, sectionKey: string) {
  const tab = sourceTabsByPool.value[pool].find((item) => item.key === sectionKey)
  if (!tab || tab.isLoading || (!tab.hasMore && tab.entries.length > 0)) return
  updateSourceTab(pool, sectionKey, (item) => ({ ...item, isLoading: true, loadError: '' }))
  try {
    const offset = tab.nextOffset
    const response = await fetch(
      `/api/commander-builder-source/${sourceCollectionId.value}/${commanderId.value}?scope=${pool}&section_key=${encodeURIComponent(sectionKey)}&offset=${offset}&limit=100`,
      { headers: { ...authHeaders.value } },
    )
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      authStore.logout()
      await router.replace({ name: 'login', query: { redirect: route.fullPath } })
      throw new Error('Authentication required.')
    }
    if (!response.ok || !data.success || !data.section || !Array.isArray(data.section.entries)) {
      throw new Error(data.error || 'Unable to load source cards.')
    }
    const page = data as SourcePageResponse
    updateSourceTab(pool, sectionKey, (item) => {
      const entries = [...item.entries, ...page.section.entries]
      const existingItemsByOracleId = new Map(item.items.map((sourceItem) => [sourceItem.oracle_id, sourceItem]))
      return {
        ...item,
        entries,
        items: entries.map((entry, index) => {
          const nextItem = overviewEntryToCollectionItem(sectionKey, entry, index)
          const existingItem = existingItemsByOracleId.get(entry.oracle_id)
          return existingItem?.gameplay_card
            ? { ...nextItem, ...buildItemMetadata(existingItem.gameplay_card) }
            : nextItem
        }),
        entryTotal: page.section.entry_total,
        nextOffset: page.section.next_offset,
        hasMore: page.section.has_more,
        isLoading: false,
        loadError: '',
      }
    })
  } catch (error) {
    updateSourceTab(pool, sectionKey, (item) => ({
      ...item,
      isLoading: false,
      loadError: error instanceof Error ? error.message : 'Unable to load source cards.',
    }))
  }
}

async function loadSpotlightMetadata(pool: SourcePool) {
  const response = await fetch(`/api/commander-builder-source/${sourceCollectionId.value}/${commanderId.value}/spotlight?scope=${pool}`, { headers: { ...authHeaders.value } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load commander spotlight.')
  spotlightTabsByPool.value = { ...spotlightTabsByPool.value, [pool]: (data.buckets ?? []).map(makeSourceTab) }
}

async function loadSpotlightPage(pool: SourcePool, bucketKey: string) {
  const tab = spotlightTabsByPool.value[pool].find((item) => item.key === bucketKey)
  if (!tab || tab.isLoading || (!tab.hasMore && tab.entries.length > 0)) return
  const offset = tab.nextOffset
  updateSpotlightTab(pool, bucketKey, (item) => ({ ...item, isLoading: true, loadError: '' }))
  try {
    const response = await fetch(`/api/commander-builder-source/${sourceCollectionId.value}/${commanderId.value}/spotlight?scope=${pool}&bucket=${encodeURIComponent(bucketKey)}&offset=${offset}&limit=100`, { headers: { ...authHeaders.value } })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.success || !data.bucket || !Array.isArray(data.bucket.entries)) throw new Error(data.error || 'Unable to load commander spotlight cards.')
    updateSpotlightTab(pool, bucketKey, (item) => {
      const entries = [...item.entries, ...data.bucket.entries]
      return { ...item, entries, items: entries.map((entry, index) => overviewEntryToCollectionItem(bucketKey, entry, index)), entryTotal: data.bucket.entry_total, nextOffset: data.bucket.next_offset, hasMore: data.bucket.has_more, isLoading: false, loadError: '' }
    })
  } catch (error) {
    updateSpotlightTab(pool, bucketKey, (item) => ({ ...item, isLoading: false, loadError: error instanceof Error ? error.message : 'Unable to load commander spotlight cards.' }))
  }
}

function updateSpotlightTab(pool: SourcePool, tabKey: string, update: (tab: SourceTab) => SourceTab) {
  spotlightTabsByPool.value = { ...spotlightTabsByPool.value, [pool]: spotlightTabsByPool.value[pool].map((tab) => tab.key === tabKey ? update(tab) : tab) }
}

async function loadSourcePage(pool: SourcePool, key: string) {
  if (sourceMode.value === 'spotlight') return loadSpotlightPage(pool, key)
  return loadSectionPage(pool, key)
}

async function selectSourceMode(mode: SourceMode) {
  if (sourceMode.value === mode) return
  sourceMode.value = mode
  if (mode === 'spotlight' && spotlightTabsByPool.value[selectedSourcePool.value].length === 0) await loadSpotlightMetadata(selectedSourcePool.value)
  const tab = sourceTabs.value.find((item) => item.key === activeSourceTabKey.value) ?? sourceTabs.value[0]
  activeSourceTabKey.value = tab?.key ?? 'ramp'
  if (tab) await loadSourcePage(selectedSourcePool.value, tab.key)
}

async function selectSourcePool(pool: SourcePool) {
  if (selectedSourcePool.value === pool) return
  sourcePoolError.value = ''
  if (pool === 'all') isLoadingAllSource.value = true
  try {
    if (sourceTabsByPool.value[pool].length === 0) await loadSourceMetadata(pool)
    if (sourceMode.value === 'spotlight' && spotlightTabsByPool.value[pool].length === 0) await loadSpotlightMetadata(pool)
    selectedSourcePool.value = pool
    const tab = sourceTabs.value.find((item) => item.key === activeSourceTabKey.value) ?? sourceTabs.value[0]
    activeSourceTabKey.value = tab?.key ?? 'ramp'
    if (tab) await loadSourcePage(pool, tab.key)
  } catch (error) {
    sourcePoolError.value = error instanceof Error ? error.message : 'Unable to load this source pool.'
  } finally {
    isLoadingAllSource.value = false
  }
}

async function loadBuilderScores(collection: CollectionRecord) {
  const oracleIds = Array.from(new Set(collection.items.map((item) => item.oracle_id).filter((id): id is string => Boolean(id))))
  if (oracleIds.length === 0) return
  try {
    const response = await fetch(
      `/api/commander-builder-source/${sourceCollectionId.value}/${commanderId.value}/scores`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders.value },
        body: JSON.stringify({ oracle_ids: oracleIds }),
      },
    )
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.success || !data.scores) return
    builderScoresByOracleId.value = data.scores as Record<string, SourceOverviewEntry>
  } catch {
    // Deck mutations must remain successful when optional score hydration is unavailable.
  }
}

async function loadBuilderPage() {
  if (
    !sourceCollectionId.value ||
    !builderCollectionId.value ||
    !commanderId.value ||
    themeId.value === null
  ) {
    errorMessage.value =
      'Missing source collection, builder collection, commander, or theme identifier.'

    isLoading.value = false
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const [
      rawSourceCollection,
      rawBuilderCollection,
      selectedTheme,
    ] = await Promise.all([
      fetchCollectionRecord(
        sourceCollectionId.value,
      ),

      fetchCollectionRecord(
        builderCollectionId.value,
      ),

      loadThemeProfile(),
    ])

    sourceCollection.value = rawSourceCollection

    builderCollection.value =
      await enrichCollectionWithGameplay(
        rawBuilderCollection,
      )

    activeTheme.value =
      selectedTheme

    await loadSourceMetadata('collection')
    activeSourceTabKey.value = sourceTabs.value[0]?.key ?? 'ramp'
    if (activeSourceTabKey.value) await loadSourcePage('collection', activeSourceTabKey.value)
    await loadBuilderScores(builderCollection.value)

    viewMode.value =
      builderCollection.value.deck_type.toLowerCase() ===
      'binder'
        ? 'list'
        : 'grid'

    organizationMode.value =
      'section'

    hoveredItem.value = null
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to load commander builder.'
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  if (
    sourceCollectionId.value &&
    commanderId.value &&
    themeId.value !== null
  ) {
    router.push({
      name: 'collection-selected-theme',

      params: {
        collectionId:
          sourceCollectionId.value,

        commanderId:
          commanderId.value,

        themeId:
          themeId.value,
      },
    })

    return
  }

  router.push({
    name: 'deck-dashboard',
  })
}

function handleHoverItem(
  item: CollectionItem | null,
) {
  hoveredItem.value = item
}

async function handleSourceHoverItem(item: CollectionItem | null) {
  hoveredSourceItem.value = item
  if (!item?.oracle_id || item.gameplay_card) return
  try {
    const response = await fetch(`/api/cards/id/${item.oracle_id}`)
    if (!response.ok) return
    const gameplayCard = await response.json() as GameplayCard
    for (const pool of ['collection', 'all'] as SourcePool[]) {
      sourceTabsByPool.value[pool].forEach((tab) => {
        tab.items.forEach((sourceItem) => {
          if (sourceItem.oracle_id === gameplayCard.oracle_id) {
            Object.assign(sourceItem, buildItemMetadata(gameplayCard))
          }
        })
      })
    }
    if (hoveredSourceItem.value?.oracle_id === gameplayCard.oracle_id) {
      hoveredSourceItem.value = {
        ...hoveredSourceItem.value,
        ...buildItemMetadata(gameplayCard),
      }
    }
  } catch {
    // A row remains usable even when its optional hover details cannot be fetched.
  }
}

function handleContextMenu(
  payload: CollectionCardContextMenuPayload,
) {
  contextMenuState.value = payload
}

function closeContextMenu() {
  contextMenuState.value = null
}

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
  )

  closeContextMenu()
}

function handleGlobalPointer() {
  closeContextMenu()
}

function handleGlobalEscape(
  event: KeyboardEvent,
) {
  if (event.key === 'Escape') {
    closeContextMenu()
  }
}

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

async function assignBuilderCollection(
  incomingCollection: CollectionRecord,
  currentCollection: CollectionRecord | null,
  focusedItemId?: string | number,
) {
  const mergedCollection =
    mergeCollectionMetadata(
      currentCollection,
      incomingCollection,
    )

  builderCollection.value =
    await enrichCollectionWithGameplay(
      mergedCollection,
      currentCollection,
    )
  await loadBuilderScores(builderCollection.value)

  if (focusedItemId !== undefined) {
    hoveredItem.value =
      scoredBuilderCollection.value?.items.find(
        (item) =>
          item.id === focusedItemId,
      ) ?? null
  }
}

async function mutateBuilderItemQuantity(
  item: CollectionItem,
  direction: 'increment' | 'decrement',
) {
  if (!builderCollection.value) {
    return
  }

  beginItemMutation(item.id)

  errorMessage.value = ''

  closeContextMenu()

  try {
    const response =
      direction === 'increment'
        ? await fetch(
            `/api/collections/${builderCollection.value.id}/items`,
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
            `/api/collections/${builderCollection.value.id}/items/${item.id}?amount=1`,
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
          redirect:
            route.fullPath,
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
          'Unable to update builder collection item.',
      )
    }

    await assignBuilderCollection(
      data.collection as CollectionRecord,
      builderCollection.value,
      item.id,
    )
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to update builder collection item.'
  } finally {
    endItemMutation(item.id)
  }
}

function dismissAddCardSuggestions() {
  addCardSuggestions.value = []
}

async function searchAddCardSuggestions(
  query: string,
  requestId: number,
) {
  isSearchingCards.value = true

  try {
    const response = await fetch(
      `/api/cards/search?q=${encodeURIComponent(query)}&limit=8`,
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
      latestAddCardSearchRequest
    ) {
      isSearchingCards.value = false
    }
  }
}

async function addSuggestedCard(
  suggestion: CollectionCardSearchResult,
) {
  if (
    !builderCollection.value ||
    isAddingDirectCard.value
  ) {
    return
  }

  isAddingDirectCard.value = true
  errorMessage.value = ''
  addCardQuery.value = ''

  dismissAddCardSuggestions()

  try {
    const response = await fetch(
      `/api/collections/${builderCollection.value.id}/items`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          ...authHeaders.value,
        },

        body: JSON.stringify({
          card_id:
            suggestion.card_id,

          zone: 'mainboard',
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
          redirect:
            route.fullPath,
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
          'Unable to add card to builder collection.',
      )
    }

    await assignBuilderCollection(
      data.collection as CollectionRecord,
      builderCollection.value,
    )
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to add card to builder collection.'
  } finally {
    isAddingDirectCard.value = false
  }
}

async function addSourceItemToBuilder(
  item: CollectionItem,
) {
  if (
    !builderCollection.value ||
    isAddingSourceCard.value
  ) {
    return
  }

  isAddingSourceCard.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(
      `/api/collections/${builderCollection.value.id}/items`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          ...authHeaders.value,
        },

        body: JSON.stringify({
          card_id: item.card_id,
          zone: 'mainboard',
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
          redirect:
            route.fullPath,
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
          'Unable to add source card to builder collection.',
      )
    }

    await assignBuilderCollection(
      data.collection as CollectionRecord,
      builderCollection.value,
    )
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to add source card to builder collection.'
  } finally {
    isAddingSourceCard.value = false
  }
}

function handleSectionCardClick(
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
  )
}

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
    'keydown',
    handleGlobalEscape,
  )

  void loadBuilderPage()
})

onBeforeUnmount(() => {
  if (
    addCardSearchTimeout !== null
  ) {
    window.clearTimeout(
      addCardSearchTimeout,
    )
  }

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
    'keydown',
    handleGlobalEscape,
  )
})

watch(addCardQuery, (value) => {
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
})

watch(viewMode, (mode) => {
  if (mode !== 'list') {
    hoveredItem.value = null
  }

  closeContextMenu()
})

watch(
  activeSourceTabKey,
  () => {
    hoveredSourceItem.value = null
  },
)

watch(filterText, () => {
  hoveredItem.value = null
  closeContextMenu()
})
</script>

<template>
  <div class="builder-page">
    <section class="builder-shell">
      <div class="nav-row">
        <button
          class="back-button"
          type="button"
          @click="goBack"
        >
          Back to Overview
        </button>
      </div>

      <div
        v-if="isLoading"
        class="loading-panel skeleton-pulse"
      >
        <div class="loading-copy">
          <h2>
            Loading commander builder...
          </h2>
        </div>
      </div>

      <div
        v-else-if="
          errorMessage &&
          (!sourceCollection ||
            !builderCollection)
        "
        class="state-panel error"
      >
        <h2>
          Unable to load commander builder
        </h2>

        <p>
          {{ errorMessage }}
        </p>
      </div>

      <template
        v-else-if="
          sourceCollection &&
          builderCollection
        "
      >
        <section
          class="builder-summary-card"
        >
          <div>
            <p class="eyebrow">
              Commander Builder
            </p>

            <h1>
              {{
                activeTheme?.name ||
                'Commander Construction'
              }}
            </h1>

            <p class="summary-copy">
              Compare the tagged source pool
              and deck workspace side by side.
              The source pane stays separated
              into the role buckets you
              defined, while the builder pane
              keeps the full collection
              workspace controls.
            </p>
          </div>

          <div class="summary-chip-row">
            <div class="summary-chip">
              <span class="summary-label">
                Source Collection
              </span>

              <strong>
                {{ sourceCollection.name }}
              </strong>
            </div>

            <div class="summary-chip">
              <span class="summary-label">
                Tagged Source Cards
              </span>

              <strong>
                {{
                  builderSummary.sourceCards
                }}
              </strong>
            </div>

            <div class="summary-chip">
              <span class="summary-label">
                Builder Deck
              </span>

              <strong>
                {{
                  builderSummary.builderCards
                }}
              </strong>
            </div>
          </div>
        </section>

        <div class="split-layout">
          <!-- SOURCE PANE -->
          <section class="pane-shell">
            <div class="pane-header">
              <div>
                <p class="eyebrow">
                  Source Pool
                </p>

                <h2>
                  {{
                    sourceCollection.name
                  }}
                </h2>

                <p class="pane-copy">
                  Cards are grouped and
                  ranked by shared section
                  profiles for the selected
                  commander color identity.
                </p>
              </div>

              <div class="card-pool-toggle" role="group" aria-label="Source pool">
                <button
                  class="card-pool-button"
                  :class="{ active: selectedSourcePool === 'collection' }"
                  type="button"
                  :aria-pressed="selectedSourcePool === 'collection'"
                  :disabled="isLoadingAllSource"
                  @click="selectSourcePool('collection')"
                >
                  My Collection
                </button>
                <button
                  class="card-pool-button"
                  :class="{ active: selectedSourcePool === 'all' }"
                  type="button"
                  :aria-pressed="selectedSourcePool === 'all'"
                  :disabled="isLoadingAllSource"
                  @click="selectSourcePool('all')"
                >
                  {{ isLoadingAllSource ? 'Loading All Cards…' : 'All Cards / Upgrades' }}
                </button>
              </div>
              <p v-if="sourcePoolError" class="source-pool-error">{{ sourcePoolError }}</p>
              <div class="source-mode-toggle" role="group" aria-label="Source view">
                <button class="card-pool-button" :class="{ active: sourceMode === 'sections' }" type="button" @click="selectSourceMode('sections')">Role Sections</button>
                <button class="card-pool-button" :class="{ active: sourceMode === 'spotlight' }" type="button" @click="selectSourceMode('spotlight')">Commander Spotlight</button>
              </div>

              <div class="tab-row">
                <button
                  v-for="tab in sourceTabs"
                  :key="tab.key"
                  type="button"
                  class="tab-button"
                  :class="{
                    active:
                      activeSourceTab?.key ===
                      tab.key,
                  }"
                  @click="
                    activeSourceTabKey = tab.key;
                    loadSourcePage(selectedSourcePool, tab.key)
                  "
                >
                  {{ tab.title }}

                  <span>
                    {{ tab.entryTotal }}
                  </span>
                </button>
              </div>
            </div>

            <div class="pane-content">
              <CommanderBuilderSourceList
                v-if="activeSourceTab"
                :title="activeSourceTab.title"
                :eyebrow="sourceMode === 'spotlight' ? 'Commander Support' : activeSourceTab.key"
                :description="activeSourceTab.description"
                :items="activeSourceTab.items"
                :total-items="activeSourceTab.entryTotal"
                :has-more="activeSourceTab.hasMore"
                :is-loading="activeSourceTab.isLoading"
                :load-error="activeSourceTab.loadError"
                :primary-action-disabled="isAddingSourceCard"
                @hover-item="handleSourceHoverItem"
                @card-click="handleSectionCardClick"
                @primary-action="addSourceItemToBuilder"
                @context-menu="handleContextMenu"
                @load-more="loadSourcePage(selectedSourcePool, activeSourceTab.key)"
              />
            </div>
          </section>

          <!-- BUILDER PANE -->
          <section class="pane-shell">
            <div class="pane-content">
              <CollectionHeader
                :collection="
                  builderCollection
                "
              />

              <CollectionToolbar
                v-model="viewMode"
                v-model:organization-mode="
                  organizationMode
                "
                v-model:filter-text="
                  filterText
                "
                v-model:add-card-query="
                  addCardQuery
                "
                :collection="
                  builderCollection
                "
                :add-card-suggestions="
                  addCardSuggestions
                "
                :add-card-loading="
                  isSearchingCards
                "
                :add-card-disabled="
                  isAddingDirectCard ||
                  isAddingSourceCard
                "
                @select-add-card-suggestion="
                  addSuggestedCard
                "
                @dismiss-add-card-suggestions="
                  dismissAddCardSuggestions
                "
              />

              <CollectionManaCurve
                :collection="
                  builderCollection
                "
              />

              <div
                v-if="errorMessage"
                class="inline-error-panel"
              >
                {{ errorMessage }}
              </div>

              <div
                v-if="
                  filteredBuilderCollection &&
                  filteredBuilderCollection
                    .items.length === 0
                "
                class="state-panel"
              >
                <h2>
                  No cards match this filter
                </h2>

                <p>
                  Try a different local filter
                  or clear the current search.
                </p>
              </div>

              <div
                v-else-if="
                  filteredBuilderCollection &&
                  viewMode === 'list'
                "
                class="builder-content-grid"
              >
                <CommanderWorkspace
                  :collection="
                    filteredBuilderCollection
                  "
                  :view-mode="
                    viewMode
                  "
                  :organization-mode="
                    organizationMode
                  "
                  :mutating-item-ids="
                    mutatingItemIds
                  "
                  :show-score="true"
                  @hover-item="
                    handleHoverItem
                  "
                  @context-menu="
                    handleContextMenu
                  "
                  @increment-item="
                    mutateBuilderItemQuantity(
                      $event,
                      'increment',
                    )
                  "
                  @decrement-item="
                    mutateBuilderItemQuantity(
                      $event,
                      'decrement',
                    )
                  "
                />

                <CommanderBuilderHoverPreview
                  :item="hoveredItem"
                />
              </div>

              <CommanderWorkspace
                v-else-if="
                  filteredBuilderCollection
                "
                :collection="
                  filteredBuilderCollection
                "
                :view-mode="
                  viewMode
                "
                :organization-mode="
                  organizationMode
                "
                :mutating-item-ids="
                  mutatingItemIds
                "
                :show-score="true"
                @context-menu="
                  handleContextMenu
                "
                @increment-item="
                  mutateBuilderItemQuantity(
                    $event,
                    'increment',
                  )
                "
                @decrement-item="
                  mutateBuilderItemQuantity(
                    $event,
                    'decrement',
                  )
                "
              />
            </div>
          </section>
        </div>

        <CommanderBuilderHoverPreview
          v-if="hoveredSourceItem"
          class="source-hover-preview"
          :item="hoveredSourceItem"
        />

        <div
          v-if="contextMenuState"
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
            :disabled="
              !contextMenuState.item
                .oracle_id
            "
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
.builder-page {
  padding: 24px;
}

.builder-shell {
  width: 100%;
  max-width: none;
  margin: 0;

  display: grid;
  gap: 18px;
}

/* ----------------------------------------
   Navigation
----------------------------------------- */

.nav-row {
  display: flex;
  justify-content: flex-start;
}

.back-button {
  padding: 12px 16px;

  border: 1px solid
    var(--surface-border-light);
  border-radius: 14px;

  background: transparent;

  color: var(--text-main);

  font-family: var(--font-sans);
  font-size: 0.94rem;
  font-weight: 700;

  cursor: pointer;
}

/* ----------------------------------------
   Shared panels
----------------------------------------- */

.loading-panel,
.state-panel,
.builder-summary-card {
  padding: 28px;

  border-radius: 24px;

  border: 1px solid
    var(--surface-border-light);

  background:
    linear-gradient(
      180deg,
      rgba(148, 163, 184, 0.04),
      rgba(15, 23, 42, 0.98)
    ),
    var(--surface-card);

  box-shadow: var(--shadow-md);
}

.loading-copy h2,
.state-panel h2,
.builder-summary-card h1,
.pane-header h2 {
  margin: 0;
  color: var(--text-light);
}

.builder-summary-card h1 {
  font-size: clamp(
    1.8rem,
    3vw,
    2.5rem
  );
}

.state-panel p,
.summary-copy,
.pane-copy {
  margin: 10px 0 0;

  color: var(--text-muted);

  line-height: 1.6;
}

.state-panel.error {
  border-color: var(--error-border);
}

.eyebrow {
  display: inline-block;

  margin-bottom: 10px;

  color: var(--accent-electric);

  font-size: 0.8rem;
  font-weight: 800;

  letter-spacing: 0.08em;

  text-transform: uppercase;
}

/* ----------------------------------------
   Builder summary
----------------------------------------- */

.summary-chip-row {
  display: flex;
  flex-wrap: wrap;

  gap: 10px;

  margin-top: 18px;
}

.summary-chip {
  min-width: 180px;

  padding: 12px 14px;

  border-radius: 14px;

  border: 1px solid
    var(--surface-border-light);

  background: rgba(
    15,
    23,
    42,
    0.72
  );
}

.summary-label {
  display: block;

  margin-bottom: 6px;

  color: var(--text-muted);

  font-size: 0.76rem;
  font-weight: 800;

  letter-spacing: 0.06em;

  text-transform: uppercase;
}

.summary-chip strong {
  color: var(--text-light);
}

/* ----------------------------------------
   Split layout

   Important:
   There is NO fixed viewport height here.
   The whole page is allowed to grow naturally.
----------------------------------------- */

.split-layout {
  width: 100%;

  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    minmax(0, 1fr);

  gap: 18px;

  /*
   * Critical:
   * don't stretch the shorter pane to match
   * the taller pane.
   */
  align-items: start;
}

/* ----------------------------------------
   Pane
----------------------------------------- */

.pane-shell {
  /*
   * Critical for CSS grid children:
   * prevents large content from forcing
   * the column wider than its allocated size.
   */
  min-width: 0;

  display: grid;

  /*
   * Natural content height rather than
   * a viewport-constrained scroll area.
   */
  grid-template-rows: auto auto;

  gap: 16px;

  padding: 18px;

  border-radius: 24px;

  border: 1px solid
    var(--surface-border-light);

  background:
    linear-gradient(
      180deg,
      rgba(148, 163, 184, 0.04),
      rgba(15, 23, 42, 0.98)
    ),
    var(--surface-card);
}

.pane-header {
  min-width: 0;

  display: grid;
  gap: 14px;
}

/*
 * This replaces the old pane-scroll.
 *
 * No overflow:auto here.
 * Content contributes directly to document
 * height so the browser page scrolls.
 */
.pane-content {
  min-width: 0;

  display: grid;
  align-content: start;

  gap: 18px;

  overflow: visible;
}

.source-mode-toggle { display: flex; flex-wrap: wrap; gap: 8px; }

.card-pool-toggle {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.card-pool-button {
  padding: 8px 10px;
  border: 1px solid var(--surface-border-light);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.76);
  color: var(--text-main);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
}

.card-pool-button.active {
  border-color: var(--accent-electric-border);
  background: var(--accent-electric-dim);
  color: var(--accent-electric);
}

.card-pool-button:disabled { cursor: wait; opacity: 0.7; }
.source-pool-error { margin: 0; color: var(--error-text); font-size: 0.84rem; }

/* ----------------------------------------
   Source tabs
----------------------------------------- */

.tab-row {
  min-width: 0;

  display: flex;
  flex-wrap: wrap;

  gap: 10px;
}

.tab-button {
  padding: 10px 12px;

  border-radius: 12px;

  border: 1px solid
    var(--surface-border-light);

  background: rgba(
    15,
    23,
    42,
    0.76
  );

  color: var(--text-main);

  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 700;

  cursor: pointer;
}

.tab-button span {
  margin-left: 8px;
  color: var(--text-muted);
}

.tab-button.active {
  border-color:
    var(--accent-electric-border);

  background:
    var(--accent-electric-dim);

  color: var(--accent-electric);
}

/* ----------------------------------------
   Builder list mode
----------------------------------------- */

.builder-content-grid {
  min-width: 0;

  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    320px;

  gap: 18px;

  align-items: start;
}

/* ----------------------------------------
   Errors
----------------------------------------- */

.inline-error-panel {
  padding: 14px 16px;

  border-radius: 14px;

  border: 1px solid
    var(--error-border);

  background: rgba(
    127,
    29,
    29,
    0.24
  );

  color: var(--text-main);
}

/* ----------------------------------------
   Hover preview
----------------------------------------- */

:deep(
    .source-hover-preview.commander-builder-preview-panel
  ) {
  position: fixed;

  top: 108px;
  left: 24px;

  z-index: 900;

  width: min(
    260px,
    calc(50vw - 48px)
  );

  pointer-events: none;
}

/* ----------------------------------------
   Context menu
----------------------------------------- */

.context-menu {
  position: fixed;

  z-index: 1000;

  min-width: 190px;

  padding: 8px;

  border-radius: 14px;

  border: 1px solid
    var(--surface-border-light);

  background: rgba(
    15,
    23,
    42,
    0.98
  );

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

.context-menu-action:hover:not(
    :disabled
  ) {
  background:
    var(--accent-electric-dim);

  color:
    var(--accent-electric);
}

.context-menu-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

/* ----------------------------------------
   Responsive
----------------------------------------- */

@media (max-width: 1100px) {
  .builder-content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .builder-page {
    padding: 18px;
  }

  .split-layout {
    grid-template-columns:
      minmax(0, 1fr);
  }

  :deep(
      .source-hover-preview.commander-builder-preview-panel
    ) {
    left: 24px;

    width: min(
      260px,
      calc(100vw - 48px)
    );
  }
}

@media (max-width: 600px) {
  .builder-page {
    padding: 12px;
  }

  .pane-shell {
    padding: 14px;
    border-radius: 18px;
  }

  .builder-summary-card,
  .loading-panel,
  .state-panel {
    padding: 20px;
    border-radius: 18px;
  }

  .summary-chip {
    min-width: 0;
    flex: 1 1 100%;
  }

  .tab-button {
    flex: 1 1 auto;
  }
}
</style>