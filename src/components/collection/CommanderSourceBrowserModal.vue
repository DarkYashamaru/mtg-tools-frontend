<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CommanderBuilderHoverPreview from './CommanderBuilderHoverPreview.vue'
import CommanderBuilderSourceList from './CommanderBuilderSourceList.vue'
import type { CollectionItem } from './types'
import { useAuthStore } from '@/stores/authStore'
import type { GameplayCard } from '@/types/gameplayCard'

type SourcePool = 'collection' | 'all'
type SourceMode = 'categories' | 'types'

type SourceEntry = {
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

const dialog = ref<HTMLElement | null>(null)
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
const selectedPreviewItem = ref<CollectionItem | null>(null)
const gameplayCache = new Map<string, GameplayCard>()

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
    gameplay_card: gameplayCache.get(entry.oracle_id),
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
  clearPreviewItem()
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
    await nextTick(() => dialog.value?.focus())
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to open the source collection.'
  } finally {
    isInitializing.value = false
  }
}

async function selectPool(pool: SourcePool) {
  if (selectedPool.value === pool) return
  clearPreviewItem()
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
  clearPreviewItem()
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
  clearPreviewItem()
  activeTabKey.value = key
  await loadPage(selectedPool.value, key)
}

function clearPreviewItem() {
  selectedPreviewItem.value = null
}

async function selectPreviewItem(item: CollectionItem | null) {
  // Keep the latest row selected when the pointer or focus leaves the list.
  if (!item) return
  selectedPreviewItem.value = item
  if (!item.oracle_id || item.gameplay_card) return
  const cached = gameplayCache.get(item.oracle_id)
  if (cached) {
    item.gameplay_card = cached
    return
  }
  try {
    const response = await fetch(`/api/cards/id/${item.oracle_id}`)
    if (!response.ok) return
    const card = await response.json() as GameplayCard
    gameplayCache.set(card.oracle_id, card)
    item.gameplay_card = card
  } catch {
    // The scored row remains usable when optional preview hydration fails.
  }
}

async function openSelectedCard(item: CollectionItem) {
  await selectPreviewItem(item)
  emit('openCard', item)
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') emit('close')
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'))
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.open, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) void initialize()
  else clearPreviewItem()
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
  clearPreviewItem()
  if (props.open) void initialize()
})

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" role="presentation" @mousedown.self="emit('close')">
      <section ref="dialog" class="source-modal" role="dialog" aria-modal="true" aria-labelledby="source-modal-title" tabindex="-1">
        <header class="modal-header">
          <div>
            <p class="eyebrow">Commander Card Pool</p>
            <h2 id="source-modal-title">{{ sourceSummary?.name || 'Source Collection' }}</h2>
            <p>{{ themeLabel }} · {{ sourceSummary?.item_count ?? 0 }} source cards</p>
          </div>
          <button class="close-button" type="button" aria-label="Close card pool" @click="emit('close')">×</button>
        </header>

        <p v-if="sourceNotice" class="notice">{{ sourceNotice }}</p>
        <p v-if="actionMessage" class="action-message" aria-live="polite">{{ actionMessage }}</p>
        <div class="modal-controls">
          <div class="segmented" role="group" aria-label="Card pool">
            <button :class="{ active: selectedPool === 'collection' }" type="button" @click="selectPool('collection')">{{ sourceSummary?.is_virtual ? 'Master Collection' : 'Source Collection' }}</button>
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
        <div v-else-if="activeTab" class="modal-content">
          <div class="source-list-area">
            <CommanderBuilderSourceList
              :title="activeTab.title"
              :eyebrow="sourceMode === 'categories' ? 'Category' : 'Card Type'"
              :description="activeTab.description"
              :items="activeTab.items"
              :total-items="activeTab.entryTotal"
              :has-more="activeTab.hasMore"
              :is-loading="activeTab.isLoading"
              :load-error="activeTab.loadError"
              :existing-oracle-ids="deckOracleIds"
              :primary-action-disabled="addingCard"
              @hover-item="selectPreviewItem"
              @card-click="openSelectedCard"
              @primary-action="emit('addCard', $event)"
              @load-more="loadPage(selectedPool, activeTab.key)"
            />
          </div>

          <aside class="preview-area">
            <CommanderBuilderHoverPreview :item="selectedPreviewItem" variant="card" />
          </aside>

          <aside class="score-area" aria-live="polite">
            <CommanderBuilderHoverPreview :item="selectedPreviewItem" variant="score" />
          </aside>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1500;

  display: grid;
  place-items: center;

  padding: 16px;

  background: rgba(2, 6, 23, 0.78);
  backdrop-filter: blur(8px);
}

/*
 * Use essentially the entire viewport while still leaving enough
 * room around the modal to visually distinguish it from a full page.
 */
.source-modal {
  position: relative;
  display: flex;
  flex-direction: column;

  width: calc(100vw - 32px);
  height: calc(100dvh - 32px);

  /*
   * Prevent the modal from becoming absurdly wide on ultra-wide
   * monitors, while still being substantially larger than before.
   */
  max-width: 1800px;

  min-width: 0;
  min-height: 0;

  overflow: hidden;

  border: 1px solid var(--surface-border-light);
  border-radius: 22px;

  background: var(--surface-card);
  box-shadow: var(--shadow-lg);

  outline: none;
}


/* ------------------------------------------------------------------
 * Header
 * ------------------------------------------------------------------ */

.modal-header {
  display: flex;
  flex: 0 0 auto;

  align-items: flex-start;
  justify-content: space-between;

  gap: 20px;

  min-width: 0;

  padding: 20px 24px 14px;
}

.modal-header > div {
  min-width: 0;
}

.modal-header h2 {
  margin: 0;

  color: var(--text-light);

  /*
   * Prevent a very long collection name from pushing the close
   * button outside the modal.
   */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-header p {
  margin: 5px 0 0;

  color: var(--text-muted);
}

.eyebrow {
  margin: 0 0 6px !important;

  color: var(--accent-electric) !important;

  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.close-button {
  flex: 0 0 42px;

  width: 42px;
  height: 42px;

  border: 1px solid var(--surface-border-light);
  border-radius: 50%;

  background: var(--surface-hover);
  color: var(--text-light);

  font-size: 1.7rem;
  line-height: 1;

  cursor: pointer;
}

.close-button:hover {
  border-color: var(--accent-electric-border);
  background: var(--accent-electric-dim);
  color: var(--accent-electric);
}


/* ------------------------------------------------------------------
 * Messages
 * ------------------------------------------------------------------ */

.notice,
.action-message,
.error-message {
  flex: 0 0 auto;

  margin: 0 24px 12px;
  padding: 10px 12px;

  border-radius: 10px;

  color: var(--text-main);
  background: var(--accent-electric-dim);
}

.action-message {
  border: 1px solid var(--accent-electric-border);
}

.error-message {
  border: 1px solid var(--error-border);

  background: rgba(127, 29, 29, 0.18);
  color: var(--error-text);
}


/* ------------------------------------------------------------------
 * Controls
 * ------------------------------------------------------------------ */

.modal-controls {
  display: flex;
  flex: 0 0 auto;

  align-items: center;
  justify-content: space-between;

  gap: 12px;

  min-width: 0;

  padding: 0 24px 14px;
}

.segmented {
  display: flex;
  flex-wrap: wrap;

  gap: 8px;

  min-width: 0;
}

.segmented button,
.tab-row button {
  padding: 9px 12px;

  border: 1px solid var(--surface-border-light);
  border-radius: 10px;

  background: var(--surface-hover);
  color: var(--text-main);

  font: inherit;
  font-weight: 700;

  cursor: pointer;
}

.segmented button:hover:not(:disabled),
.tab-row button:hover {
  border-color: var(--accent-electric-border);
}

.segmented button.active,
.tab-row button.active {
  border-color: var(--accent-electric-border);

  background: var(--accent-electric-dim);
  color: var(--accent-electric);
}

.segmented button:disabled {
  opacity: 0.55;
  cursor: wait;
}


/* ------------------------------------------------------------------
 * Tabs
 * ------------------------------------------------------------------ */

.tab-row {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;

  gap: 8px;

  min-width: 0;

  padding: 0 24px 14px;

  overflow-x: auto;
  overflow-y: hidden;

  /*
   * Don't let horizontal tab scrolling accidentally scroll
   * the rest of the page/modal.
   */
  overscroll-behavior-x: contain;

  scrollbar-width: thin;
}

.tab-row button {
  flex: 0 0 auto;

  white-space: nowrap;
}

.tab-row span {
  margin-left: 6px;

  color: var(--text-muted);
}


/* ------------------------------------------------------------------
 * Loading
 * ------------------------------------------------------------------ */

.loading-state {
  flex: 1;

  padding: 36px 24px;

  color: var(--text-muted);
}


/* ------------------------------------------------------------------
 * Main content
 * ------------------------------------------------------------------ */

.modal-content {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(250px, 19vw, 340px) clamp(270px, 20vw, 360px);
  align-items: start;
  gap: 16px;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 24px 24px;
  overscroll-behavior: contain;
}

.source-list-area,
.preview-area,
.score-area {
  min-width: 0;
  width: 100%;
}

.preview-area,
.score-area {
  position: sticky;
  top: 0;
  align-self: start;
}

.modal-content :deep(.source-list-shell),
.preview-area :deep(.commander-builder-preview-panel),
.score-area :deep(.commander-builder-preview-panel) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.preview-area :deep(.commander-builder-preview-panel),
.score-area :deep(.commander-builder-preview-panel) {
  position: relative;
  inset: auto;
}

@media (max-width: 1320px) {
  .modal-content {
    grid-template-columns: minmax(0, 1fr) minmax(250px, 330px);
  }

  .preview-area,
  .score-area {
    position: static;
  }

  .preview-area {
    grid-column: 1;
  }

  .score-area {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
}
@media (max-width: 700px) {
  .modal-backdrop {
    padding: 0;
  }

  .source-modal {
    width: 100vw;
    height: 100dvh;

    max-width: none;

    border: 0;
    border-radius: 0;
  }

  .modal-header {
    padding: 16px 16px 12px;
  }

  .modal-header h2 {
    font-size: 1.25rem;
  }

  .modal-header p:not(.eyebrow) {
    font-size: 0.86rem;
  }

  .close-button {
    flex-basis: 38px;

    width: 38px;
    height: 38px;
  }

  .notice,
  .action-message,
  .error-message {
    margin-right: 16px;
    margin-left: 16px;
  }

  .modal-controls {
    align-items: stretch;
    flex-direction: column;

    padding-right: 16px;
    padding-left: 16px;
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));

    width: 100%;
  }

  .segmented button {
    min-width: 0;
  }

  .tab-row {
    padding-right: 16px;
    padding-left: 16px;
  }

  .modal-content {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;

    padding-right: 16px;
    padding-bottom: 16px;
    padding-left: 16px;
  }

  .preview-area,
  .score-area {
    grid-column: auto;
    grid-row: auto;
  }
}


/* Very narrow devices */

@media (max-width: 480px) {
  .segmented {
    grid-template-columns: 1fr;
  }
}
</style>
