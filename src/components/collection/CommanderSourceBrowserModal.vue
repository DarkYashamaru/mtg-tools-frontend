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
type SourceMode = 'sections' | 'spotlight'

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
const sourceMode = ref<SourceMode>('sections')
const tabsByPool = ref<Record<SourcePool, SourceTab[]>>({ collection: [], all: [] })
const spotlightTabsByPool = ref<Record<SourcePool, SourceTab[]>>({ collection: [], all: [] })
const activeTabKey = ref('ramp')
const isInitializing = ref(false)
const isLoadingAll = ref(false)
const errorMessage = ref('')
const hoveredItem = ref<CollectionItem | null>(null)
const gameplayCache = new Map<string, GameplayCard>()
let hoverClearTimeout: ReturnType<typeof window.setTimeout> | null = null

const tabs = computed(() => (
  sourceMode.value === 'spotlight' ? spotlightTabsByPool.value : tabsByPool.value
)[selectedPool.value])
const activeTab = computed(() => tabs.value.find((tab) => tab.key === activeTabKey.value) ?? tabs.value[0])
const themeLabel = computed(() => themeName.value || (props.themeId === -1 ? 'Custom Theme' : `Theme ${props.themeId}`))
const displayedError = computed(() => errorMessage.value || props.actionError || '')

function tabsFor(pool: SourcePool, mode: SourceMode) {
  return (mode === 'spotlight' ? spotlightTabsByPool.value : tabsByPool.value)[pool]
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
  return mode === 'spotlight' ? `${base}/spotlight?scope=${pool}` : `${base}?scope=${pool}`
}

async function loadMetadata(pool: SourcePool, mode: SourceMode) {
  const data = await parseResponse(
    await fetch(metadataEndpoint(pool, mode), { headers: { ...authHeaders.value } }),
    'Unable to load source cards.',
  )
  if (data.source_collection) sourceSummary.value = data.source_collection as SourceSummary
  const sections = (mode === 'spotlight' ? data.buckets : data.sections) as MetadataSection[] | undefined
  if (!Array.isArray(sections)) throw new Error('The source card response was incomplete.')
  if (mode === 'spotlight') {
    spotlightTabsByPool.value = { ...spotlightTabsByPool.value, [pool]: sections.map(makeTab) }
  } else {
    tabsByPool.value = { ...tabsByPool.value, [pool]: sections.map(makeTab) }
  }
}

function updateTab(pool: SourcePool, mode: SourceMode, key: string, update: (tab: SourceTab) => SourceTab) {
  const target = mode === 'spotlight' ? spotlightTabsByPool : tabsByPool
  target.value = {
    ...target.value,
    [pool]: target.value[pool].map((tab) => tab.key === key ? update(tab) : tab),
  }
}

async function loadPage(pool: SourcePool, key: string) {
  const mode = sourceMode.value
  const targetTabs = (mode === 'spotlight' ? spotlightTabsByPool.value : tabsByPool.value)[pool]
  const tab = targetTabs.find((candidate) => candidate.key === key)
  if (!tab || tab.isLoading || (!tab.hasMore && tab.entries.length > 0)) return
  updateTab(pool, mode, key, (current) => ({ ...current, isLoading: true, loadError: '' }))
  try {
    const base = `/api/commander-builder-source/${effectiveSourceId.value}/${props.commanderOracleId}`
    const selector = mode === 'spotlight'
      ? `bucket=${encodeURIComponent(key)}`
      : `section_key=${encodeURIComponent(key)}`
    const data = await parseResponse(
      await fetch(`${base}${mode === 'spotlight' ? '/spotlight' : ''}?scope=${pool}&${selector}&offset=${tab.nextOffset}&limit=100`, {
        headers: { ...authHeaders.value },
      }),
      'Unable to load source cards.',
    )
    const page = mode === 'spotlight' ? data.bucket : data.section
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
  clearHoveredItem()
  errorMessage.value = ''
  sourceNotice.value = ''
  selectedPool.value = 'collection'
  sourceMode.value = 'sections'
  tabsByPool.value = { collection: [], all: [] }
  spotlightTabsByPool.value = { collection: [], all: [] }
  sourceSummary.value = null
  effectiveSourceId.value = props.sourceCollectionId || 'master'
  await loadThemeName()
  try {
    try {
      await loadMetadata('collection', 'sections')
    } catch (error) {
      if (effectiveSourceId.value === 'master') throw error
      effectiveSourceId.value = 'master'
      sourceNotice.value = 'The saved source collection is unavailable. Using Master Collection instead.'
      await loadMetadata('collection', 'sections')
    }
    activeTabKey.value = tabsByPool.value.collection[0]?.key ?? 'ramp'
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
  clearHoveredItem()
  isLoadingAll.value = pool === 'all'
  errorMessage.value = ''
  try {
    if (tabsFor(pool, sourceMode.value).length === 0) await loadMetadata(pool, sourceMode.value)
    selectedPool.value = pool
    activeTabKey.value = tabsFor(pool, sourceMode.value)[0]?.key ?? 'ramp'
    if (activeTabKey.value) await loadPage(pool, activeTabKey.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load this card pool.'
  } finally {
    isLoadingAll.value = false
  }
}

async function selectMode(mode: SourceMode) {
  if (sourceMode.value === mode) return
  clearHoveredItem()
  errorMessage.value = ''
  try {
    if (tabsFor(selectedPool.value, mode).length === 0) await loadMetadata(selectedPool.value, mode)
    sourceMode.value = mode
    activeTabKey.value = tabsFor(selectedPool.value, mode)[0]?.key ?? 'ramp'
    if (activeTabKey.value) await loadPage(selectedPool.value, activeTabKey.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load this source view.'
  }
}

async function selectTab(key: string) {
  clearHoveredItem()
  activeTabKey.value = key
  await loadPage(selectedPool.value, key)
}

function cancelHoverClear() {
  if (hoverClearTimeout === null) return
  window.clearTimeout(hoverClearTimeout)
  hoverClearTimeout = null
}

function clearHoveredItem() {
  cancelHoverClear()
  hoveredItem.value = null
}

function scheduleHoveredItemClear() {
  cancelHoverClear()
  hoverClearTimeout = window.setTimeout(() => {
    hoveredItem.value = null
    hoverClearTimeout = null
  }, 180)
}

async function hoverItem(item: CollectionItem | null) {
  if (!item) {
    scheduleHoveredItemClear()
    return
  }
  cancelHoverClear()
  hoveredItem.value = item
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
  else clearHoveredItem()
}, { immediate: true })
watch(() => [props.sourceCollectionId, props.commanderOracleId, props.themeId], () => {
  tabsByPool.value = { collection: [], all: [] }
  spotlightTabsByPool.value = { collection: [], all: [] }
  selectedPool.value = 'collection'
  sourceMode.value = 'sections'
  sourceSummary.value = null
  themeName.value = ''
  clearHoveredItem()
  if (props.open) void initialize()
})

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  cancelHoverClear()
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
            <button :class="{ active: sourceMode === 'sections' }" type="button" @click="selectMode('sections')">Role Sections</button>
            <button :class="{ active: sourceMode === 'spotlight' }" type="button" @click="selectMode('spotlight')">Commander Spotlight</button>
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
              :eyebrow="sourceMode === 'spotlight' ? 'Commander Support' : activeTab.key"
              :description="activeTab.description"
              :items="activeTab.items"
              :total-items="activeTab.entryTotal"
              :has-more="activeTab.hasMore"
              :is-loading="activeTab.isLoading"
              :load-error="activeTab.loadError"
              :existing-oracle-ids="deckOracleIds"
              :primary-action-disabled="addingCard"
              @hover-item="hoverItem"
              @card-click="emit('openCard', $event)"
              @primary-action="emit('addCard', $event)"
              @load-more="loadPage(selectedPool, activeTab.key)"
            />
          </div>

          <aside class="preview-area">
            <CommanderBuilderHoverPreview :item="hoveredItem" variant="card" />
          </aside>
        </div>
        <div
          v-if="hoveredItem"
          class="score-hover-window"
          tabindex="0"
          :aria-label="`Score details for ${hoveredItem.name || 'hovered card'}`"
          @mouseenter="cancelHoverClear"
          @mouseleave="scheduleHoveredItemClear"
          @focusin="cancelHoverClear"
          @focusout="scheduleHoveredItemClear"
        >
          <CommanderBuilderHoverPreview :item="hoveredItem" variant="score" />
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
  /*
   * This is the only part of the modal that should consume the
   * remaining available height.
   */
  flex: 1 1 auto;

  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    clamp(300px, 21vw, 380px);

  align-items: start;

  gap: 20px;

  min-width: 0;
  min-height: 0;

  /*
   * Header, controls and tabs remain outside the scrolling area.
   */
  overflow-x: hidden;
  overflow-y: auto;

  padding: 0 24px 24px;

  overscroll-behavior: contain;
}


/*
 * This wrapper is important.
 *
 * Grid children have min-width:auto by default, which means that
 * sufficiently wide content inside CommanderBuilderSourceList can
 * force the grid wider and overlap the preview column.
 */
.source-list-area {
  min-width: 0;
  width: 100%;
}


/*
 * Keep the card preview visible while scrolling through a large
 * collection.
 */
.preview-area {
  position: sticky;
  top: 0;

  align-self: start;

  min-width: 0;
  width: 100%;
}


/* Prevent child components from escaping their grid columns. */

.modal-content :deep(.source-list-shell) {
  width: 100%;
  min-width: 0;
  max-width: 100%;

  box-sizing: border-box;
}

.preview-area :deep(.commander-builder-preview-panel) {
  width: 100%;
  min-width: 0;
  max-width: 100%;

  box-sizing: border-box;
}


/*
 * If the preview component previously used position:absolute/fixed,
 * make the modal's preview wrapper responsible for positioning it.
 */
.preview-area :deep(.commander-builder-preview-panel) {
  position: relative;
  inset: auto;
}


.score-hover-window {
  position: absolute;
  z-index: 1510;

  top: 50%;
  left: 32px;

  width: clamp(300px, 22vw, 390px);
  max-height: calc(100% - 64px);

  overflow-x: hidden;
  overflow-y: auto;

  transform: translateY(-50%);
  overscroll-behavior: contain;
  scrollbar-width: thin;
  outline: none;
}

.score-hover-window:focus-visible {
  outline: 2px solid var(--accent-electric);
  outline-offset: 3px;
}

.score-hover-window :deep(.commander-builder-preview-panel) {
  position: static;
  inset: auto;
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

/* ------------------------------------------------------------------
 * Medium screens
 *
 * At this point keeping a 300px+ preview column makes the actual
 * card list unnecessarily cramped. Hide hover preview before that
 * becomes a problem.
 * ------------------------------------------------------------------ */

@media (max-width: 1100px) {
  .modal-content {
    grid-template-columns: minmax(0, 1fr);
  }

  .preview-area {
    display: none;
  }

  .score-hover-window {
    top: auto;
    right: clamp(144px, 18vw, 180px);
    bottom: 24px;
    left: 24px;

    width: auto;
    max-height: min(42dvh, 420px);
    transform: none;
  }
}


/* ------------------------------------------------------------------
 * Mobile / small tablet
 * ------------------------------------------------------------------ */

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
    gap: 0;

    padding-right: 16px;
    padding-bottom: 16px;
    padding-left: 16px;
  }

  .score-hover-window {
    bottom: 16px;
    left: 16px;
  }
}


/* Very narrow devices */

@media (max-width: 480px) {
  .segmented {
    grid-template-columns: 1fr;
  }

  .score-hover-window {
    right: 124px;
  }
}
</style>
