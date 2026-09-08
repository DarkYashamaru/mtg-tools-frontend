<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CardImageTile from './CardImageTile.vue'
import type { CollectionItem } from './types'
import { useAuthStore } from '@/stores/authStore'

type SourcePool = 'collection' | 'all'
type SourceMode = 'categories' | 'types'

type SourceEntry = {
  oracle_id: string
  name: string
  score: number
  reasons: NonNullable<CollectionItem['commander_support_reasons']>
  score_breakdown?: NonNullable<CollectionItem['score_breakdown']>
  lowest_price_usd?: number | null
  dracostore_price_cop?: number | null
  vaultstore_price_cop?: number | null
  source_item: Pick<CollectionItem, 'card_id' | 'image_uri' | 'printing_faces' | 'amount' | 'zone' | 'owned_amount' | 'reserved_amount' | 'available_amount' | 'reservations'>
}

type SourceTab = {
  key: string
  title: string
  description: string
  entries: SourceEntry[]
  items: CollectionItem[]
  entryTotal: number
  nextOffset: number
  hasMore: boolean
  isLoading: boolean
  loadError: string
}

type MetadataSection = {
  key: string
  title: string
  description: string
  entry_total: number
}

type SourceSummary = {
  id: string | number
  name: string | null
  item_count: number
  is_virtual?: boolean
}

interface Props {
  open: boolean
  sourceCollectionId: string
  commanderOracleId: string
  themeId: number
  deckOracleIds?: string[]
  addingCard?: boolean
  actionError?: string
  actionMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  deckOracleIds: () => [],
  addingCard: false,
})
const emit = defineEmits<{
  close: []
  addCard: [item: CollectionItem]
  openCard: [item: CollectionItem]
}>()

const authStore = useAuthStore()
const { authHeaders } = storeToRefs(authStore)
const route = useRoute()
const router = useRouter()

const effectiveSourceId = ref(props.sourceCollectionId)
const sourceSummary = ref<SourceSummary | null>(null)
const sourceNotice = ref('')
const themeName = ref('')
const selectedPool = ref<SourcePool>('collection')
const sourceMode = ref<SourceMode>('categories')
const tabsByMode = ref<Record<SourceMode, Record<SourcePool, SourceTab[]>>>({
  categories: { collection: [], all: [] },
  types: { collection: [], all: [] },
})
const activeTabKey = ref('ramp')
const isInitializing = ref(false)
const isLoadingAll = ref(false)
const errorMessage = ref('')
const poolScrollArea = ref<HTMLElement | null>(null)

const tabs = computed(() => tabsByMode.value[sourceMode.value][selectedPool.value])
const activeTab = computed(() => tabs.value.find((tab) => tab.key === activeTabKey.value) ?? tabs.value[0])
const themeLabel = computed(() => themeName.value || (props.themeId === -1 ? 'Custom Theme' : `Theme ${props.themeId}`))
const displayedError = computed(() => errorMessage.value || props.actionError || '')

function tabsFor(pool: SourcePool, mode: SourceMode) {
  return tabsByMode.value[mode][pool]
}

function firstTabKey(pool: SourcePool, mode: SourceMode) {
  return tabsFor(pool, mode)[0]?.key ?? (mode === 'types' ? 'lands' : 'ramp')
}

function makeTab(section: MetadataSection): SourceTab {
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

function toCollectionItem(sectionKey: string, entry: SourceEntry, index: number): CollectionItem {
  return {
    id: `${selectedPool.value}-${sourceMode.value}-${sectionKey}-${entry.oracle_id}-${index}`,
    card_id: entry.source_item.card_id,
    oracle_id: entry.oracle_id,
    name: entry.name,
    commander_support_score: entry.score,
    commander_support_reasons: entry.reasons ?? [],
    score_breakdown: entry.score_breakdown,
    lowest_price_usd: entry.lowest_price_usd,
    dracostore_price_cop: entry.dracostore_price_cop,
    vaultstore_price_cop: entry.vaultstore_price_cop,
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
    printing_faces: entry.source_item.printing_faces,
    amount: entry.source_item.amount,
    zone: entry.source_item.zone,
    owned_amount: entry.source_item.owned_amount,
    reserved_amount: entry.source_item.reserved_amount,
    available_amount: entry.source_item.available_amount,
    reservations: entry.source_item.reservations,
  }
}

async function parseResponse(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}))
  if (response.status === 401) {
    authStore.logout()
    await router.replace({ name: 'login', query: { redirect: route.fullPath } })
    throw new Error('Authentication required.')
  }
  if (!response.ok || !data.success) throw new Error(data.error || fallback)
  return data
}

function metadataEndpoint(pool: SourcePool, mode: SourceMode) {
  const base = `/api/commander-builder-source/${effectiveSourceId.value}/${props.commanderOracleId}`
  return `${base}?scope=${pool}&profile_group=${mode}&theme_id=${props.themeId}`
}

async function loadMetadata(pool: SourcePool, mode: SourceMode) {
  const data = await parseResponse(
    await fetch(metadataEndpoint(pool, mode), { headers: { ...authHeaders.value } }),
    'Unable to load source cards.',
  )
  if (data.source_collection) sourceSummary.value = data.source_collection as SourceSummary
  const sections = data.sections as MetadataSection[] | undefined
  if (!Array.isArray(sections)) throw new Error('The source card response was incomplete.')
  tabsByMode.value = {
    ...tabsByMode.value,
    [mode]: { ...tabsByMode.value[mode], [pool]: sections.map(makeTab) },
  }
}

function updateTab(pool: SourcePool, mode: SourceMode, key: string, update: (tab: SourceTab) => SourceTab) {
  tabsByMode.value = {
    ...tabsByMode.value,
    [mode]: {
      ...tabsByMode.value[mode],
      [pool]: tabsByMode.value[mode][pool].map((tab) => tab.key === key ? update(tab) : tab),
    },
  }
}

async function loadPage(pool: SourcePool, key: string) {
  const mode = sourceMode.value
  const targetTabs = tabsByMode.value[mode][pool]
  const tab = targetTabs.find((candidate) => candidate.key === key)
  if (!tab || tab.isLoading || (!tab.hasMore && tab.entries.length > 0)) return
  updateTab(pool, mode, key, (current) => ({ ...current, isLoading: true, loadError: '' }))
  try {
    const base = `/api/commander-builder-source/${effectiveSourceId.value}/${props.commanderOracleId}`
    const data = await parseResponse(
      await fetch(`${base}?scope=${pool}&profile_group=${mode}&theme_id=${props.themeId}&section_key=${encodeURIComponent(key)}&offset=${tab.nextOffset}&limit=100`, {
        headers: { ...authHeaders.value },
      }),
      'Unable to load source cards.',
    )
    const page = data.section
    if (!page || !Array.isArray(page.entries)) throw new Error('The source page was incomplete.')
    updateTab(pool, mode, key, (current) => {
      const entries = [...current.entries, ...(page.entries as SourceEntry[])]
      return {
        ...current,
        entries,
        items: entries.map((entry, index) => toCollectionItem(key, entry, index)),
        entryTotal: page.entry_total,
        nextOffset: page.next_offset,
        hasMore: page.has_more,
        isLoading: false,
        loadError: '',
      }
    })
  } catch (error) {
    updateTab(pool, mode, key, (current) => ({
      ...current,
      isLoading: false,
      loadError: error instanceof Error ? error.message : 'Unable to load source cards.',
    }))
  }
}

async function loadThemeName() {
  themeName.value = ''
  if (props.themeId === -1) {
    themeName.value = 'Custom Theme'
    return
  }
  try {
    const response = await fetch(`/api/themes/by-commander/${props.commanderOracleId}`)
    if (!response.ok) return
    const themes = await response.json()
    const theme = Array.isArray(themes) ? themes.find((candidate) => Number(candidate.theme_id) === props.themeId) : null
    themeName.value = typeof theme?.name === 'string' ? theme.name : ''
  } catch {
    // The numeric theme label remains available if the optional name lookup fails.
  }
}

async function initialize() {
  if (!props.open || !props.commanderOracleId || isInitializing.value) return
  isInitializing.value = true
  errorMessage.value = ''
  sourceNotice.value = ''
  selectedPool.value = 'collection'
  sourceMode.value = 'categories'
  tabsByMode.value = {
    categories: { collection: [], all: [] },
    types: { collection: [], all: [] },
  }
  sourceSummary.value = null
  effectiveSourceId.value = props.sourceCollectionId || 'master'
  await loadThemeName()
  try {
    try {
      await loadMetadata('collection', 'categories')
    } catch (error) {
      if (effectiveSourceId.value === 'master') throw error
      effectiveSourceId.value = 'master'
      sourceNotice.value = 'The saved source collection is unavailable. Using Master Collection instead.'
      await loadMetadata('collection', 'categories')
    }
    activeTabKey.value = firstTabKey('collection', 'categories')
    if (activeTabKey.value) await loadPage('collection', activeTabKey.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to open the source collection.'
  } finally {
    isInitializing.value = false
  }
}

async function selectPool(pool: SourcePool) {
  if (selectedPool.value === pool) return
  isLoadingAll.value = pool === 'all'
  errorMessage.value = ''
  try {
    if (tabsFor(pool, sourceMode.value).length === 0) await loadMetadata(pool, sourceMode.value)
    selectedPool.value = pool
    activeTabKey.value = firstTabKey(pool, sourceMode.value)
    if (activeTabKey.value) await loadPage(pool, activeTabKey.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load this card pool.'
  } finally {
    isLoadingAll.value = false
  }
}

async function selectMode(mode: SourceMode) {
  if (sourceMode.value === mode) return
  errorMessage.value = ''
  try {
    if (tabsFor(selectedPool.value, mode).length === 0) await loadMetadata(selectedPool.value, mode)
    sourceMode.value = mode
    activeTabKey.value = firstTabKey(selectedPool.value, mode)
    if (activeTabKey.value) await loadPage(selectedPool.value, activeTabKey.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load this source view.'
  }
}

async function selectTab(key: string) {
  activeTabKey.value = key
  poolScrollArea.value?.scrollTo({ top: 0 })
  await loadPage(selectedPool.value, key)
}

const existingDeckOracleIds = computed(() => new Set(props.deckOracleIds))

function isAlreadyInDeck(item: CollectionItem) {
  return Boolean(item.oracle_id && existingDeckOracleIds.value.has(item.oracle_id))
}

function isUnavailableInMaster(item: CollectionItem) {
  if (selectedPool.value !== 'collection') return false
  return (item.available_amount ?? item.amount) <= 0
}

function primaryActionLabel(item: CollectionItem) {
  if (isAlreadyInDeck(item)) return 'In Deck'
  if (isUnavailableInMaster(item)) return 'Unavailable'
  return 'Add to Deck'
}

function handleSourceScroll(event: Event) {
  const element = event.currentTarget as HTMLElement
  const tab = activeTab.value
  if (!tab || tab.isLoading || !tab.hasMore) return
  if (element.scrollHeight - element.scrollTop - element.clientHeight > 640) return
  void loadPage(selectedPool.value, tab.key)
}

watch(() => props.open, (open) => {
  if (open) void initialize()
}, { immediate: true })
watch(() => [props.sourceCollectionId, props.commanderOracleId, props.themeId], () => {
  tabsByMode.value = {
    categories: { collection: [], all: [] },
    types: { collection: [], all: [] },
  }
  selectedPool.value = 'collection'
  sourceMode.value = 'categories'
  sourceSummary.value = null
  themeName.value = ''
  if (props.open) void initialize()
})
</script>

<template>
  <section v-if="open" class="source-browser-panel" aria-labelledby="source-browser-title">
    <header class="source-browser-header">
      <div>
        <p class="eyebrow">Commander Card Pool</p>
        <h2 id="source-browser-title">{{ sourceSummary?.name || 'Source Collection' }}</h2>
        <p>{{ themeLabel }} · {{ sourceSummary?.item_count ?? 0 }} source cards</p>
      </div>
      <button class="close-button" type="button" aria-label="Hide card pool" @click="emit('close')">×</button>
    </header>

    <p v-if="sourceNotice" class="notice">{{ sourceNotice }}</p>
    <p v-if="actionMessage" class="action-message" aria-live="polite">{{ actionMessage }}</p>

    <div class="modal-controls">
      <div class="segmented" role="group" aria-label="Card pool">
        <button :class="{ active: selectedPool === 'collection' }" type="button" @click="selectPool('collection')">
          {{ sourceSummary?.is_virtual ? 'Master Collection' : 'Source Collection' }}
        </button>
        <button :class="{ active: selectedPool === 'all' }" type="button" :disabled="isLoadingAll" @click="selectPool('all')">
          {{ isLoadingAll ? 'Loading…' : 'All Cards / Upgrades' }}
        </button>
      </div>
      <div class="segmented" role="group" aria-label="Source view">
        <button :class="{ active: sourceMode === 'categories' }" type="button" @click="selectMode('categories')">Categories</button>
        <button :class="{ active: sourceMode === 'types' }" type="button" @click="selectMode('types')">Types</button>
      </div>
    </div>

    <div v-if="tabs.length" class="tab-row">
      <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: activeTab?.key === tab.key }" @click="selectTab(tab.key)">
        {{ tab.title }} <span>{{ tab.entryTotal }}</span>
      </button>
    </div>

    <p v-if="displayedError" class="error-message">{{ displayedError }}</p>
    <div v-if="isInitializing" class="loading-state">Loading scored source cards…</div>

    <div
      v-else-if="activeTab"
      ref="poolScrollArea"
      class="source-grid-scroll"
      @scroll.passive="handleSourceScroll"
    >
      <section class="source-grid-shell">
        <header class="source-grid-header">
          <p>{{ sourceMode === 'categories' ? 'Category' : 'Card Type' }}</p>
          <h3>{{ activeTab.title }}</h3>
          <span>{{ activeTab.items.length }} of {{ activeTab.entryTotal }} cards</span>
          <p v-if="activeTab.description">{{ activeTab.description }}</p>
        </header>

        <p v-if="activeTab.items.length === 0 && !activeTab.isLoading && !activeTab.loadError" class="empty-grid">
          No cards in this section.
        </p>

        <div v-else class="source-card-grid">
          <CardImageTile
            v-for="item in activeTab.items"
            :key="item.id"
            :item="item"
            :hide-singleton-amount="true"
            :show-quantity-actions="false"
            :primary-action-label="primaryActionLabel(item)"
            :primary-action-disabled="addingCard || isAlreadyInDeck(item) || isUnavailableInMaster(item)"
            @card-click="emit('openCard', item)"
            @primary-action="emit('addCard', item)"
          />
        </div>

        <p v-if="activeTab.isLoading" class="load-status">Loading more cards…</p>
        <button v-else-if="activeTab.loadError" class="retry-button" type="button" @click="loadPage(selectedPool, activeTab.key)">
          Retry loading cards
        </button>
        <p v-else-if="!activeTab.hasMore && activeTab.items.length" class="load-status">All cards in this section are loaded.</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.source-browser-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--surface-border-light);
  border-radius: 20px;
  background: var(--surface-card);
  box-shadow: var(--shadow-md);
}

.source-browser-header,
.modal-controls,
.tab-row,
.notice,
.action-message,
.error-message {
  flex: 0 0 auto;
}

.source-browser-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px 12px;
}

.source-browser-header h2,
.source-browser-header p,
.source-grid-header h3,
.source-grid-header p {
  margin: 0;
}

.source-browser-header h2,
.source-grid-header h3 {
  color: var(--text-light);
}

.source-browser-header > div { min-width: 0; }
.source-browser-header h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1.2rem; }
.source-browser-header p { margin-top: 5px; color: var(--text-muted); }
.eyebrow { margin: 0 0 6px !important; color: var(--accent-electric) !important; font-size: 0.74rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }

.close-button {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border: 1px solid var(--surface-border-light);
  border-radius: 50%;
  background: var(--surface-hover);
  color: var(--text-light);
  font-size: 1.4rem;
  cursor: pointer;
}

.close-button:hover,
.segmented button:hover:not(:disabled),
.tab-row button:hover { border-color: var(--accent-electric-border); color: var(--accent-electric); }

.notice,
.action-message,
.error-message { margin: 0 18px 10px; padding: 9px 10px; border-radius: 10px; color: var(--text-main); background: var(--accent-electric-dim); }
.action-message { border: 1px solid var(--accent-electric-border); }
.error-message { border: 1px solid var(--error-border); background: rgba(127, 29, 29, 0.18); color: var(--error-text); }

.modal-controls { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 18px 12px; }
.segmented { display: flex; flex-wrap: wrap; gap: 7px; }
.segmented button,
.tab-row button { padding: 8px 10px; border: 1px solid var(--surface-border-light); border-radius: 9px; background: var(--surface-hover); color: var(--text-main); font: inherit; font-size: 0.84rem; font-weight: 700; cursor: pointer; }
.segmented button.active,
.tab-row button.active { border-color: var(--accent-electric-border); background: var(--accent-electric-dim); color: var(--accent-electric); }
.segmented button:disabled { opacity: 0.55; cursor: wait; }

.tab-row { display: flex; gap: 7px; min-width: 0; padding: 0 18px 12px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: thin; }
.tab-row button { flex: 0 0 auto; white-space: nowrap; }
.tab-row span { margin-left: 4px; color: var(--text-muted); }

.loading-state { padding: 28px 18px; color: var(--text-muted); }
.source-grid-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.source-grid-shell { display: grid; gap: 14px; padding: 0 18px 18px; }
.source-grid-header { display: grid; gap: 3px; }
.source-grid-header > p:first-child { color: var(--accent-electric); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
.source-grid-header > span,
.source-grid-header > p:last-child { color: var(--text-muted); font-size: 0.84rem; }
.source-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.empty-grid { padding: 18px; border: 1px dashed var(--surface-border-light); border-radius: 14px; color: var(--text-muted); }
.load-status { margin: 0; padding: 4px 0; color: var(--text-muted); text-align: center; }
.retry-button { justify-self: center; padding: 9px 12px; border: 1px solid var(--accent-electric-border); border-radius: 10px; background: var(--accent-electric-dim); color: var(--accent-electric); font: inherit; font-weight: 800; cursor: pointer; }

@media (max-width: 620px) {
  .modal-controls { align-items: stretch; flex-direction: column; }
  .source-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .source-browser-header,
  .modal-controls,
  .tab-row { padding-right: 14px; padding-left: 14px; }
  .source-grid-shell { padding-right: 14px; padding-left: 14px; }
}
</style>
