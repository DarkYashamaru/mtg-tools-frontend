<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GameplayCardGrid from '@/components/cards/GameplayCardGrid.vue'
import FavouriteButton from '@/components/cards/FavouriteButton.vue'
import CollectionToolbarFilters from '@/components/collection/CollectionToolbarFilters.vue'
import type { CardColorMatchMode } from '@/components/collection/CardColorFilter.vue'
import { matchesCardColors } from '@/components/collection/filtering'
import { useAuthStore } from '@/stores/authStore'
import { useFavouritesStore } from '@/stores/favouritesStore'
import type { GameplayCard } from '@/types/gameplayCard'
import { storeStatusLabel, formatDracoTime, type DracoPriceResponse } from '@/types/dracoPrice'

type SavedCard = { oracle_id: string; name: string; created_at: string; card: GameplayCard | null }
const auth = useAuthStore()
const favourites = useFavouritesStore()
const route = useRoute()
const router = useRouter()
const entries = ref<SavedCard[]>([])
const loading = ref(true)
const error = ref('')
const refreshing = ref(false)
const completed = ref(0)
const total = ref(0)
const succeeded = ref(0)
const cached = ref(0)
const pendingPrices = ref(0)
const unavailablePrices = ref(0)
const priceResults = ref<Record<string, Record<string, DracoPriceResponse>>>({})
const failures = ref<Record<string, string>>({})
const filterText = ref('')
const colorFilters = ref<string[]>([])
const cardColors = ref<string[]>([])
const cardColorMode = ref<CardColorMatchMode>('exact')
const supertypeFilters = ref<string[]>([])
const cardTypeFilters = ref<string[]>([])
const subtypeFilters = ref<string[]>([])
const exportMessage = ref('')
let active = true
let controller: AbortController | null = null

const visible = computed(() => entries.value.filter(entry => favourites.ids.has(entry.oracle_id)))
const availableCards = computed(() => visible.value.flatMap(entry => entry.card ? [entry.card] : []))
const facetOptions = computed(() => {
  const valuesFor = (key: 'supertypes' | 'card_types' | 'subtypes') => Array.from(new Set(
    availableCards.value.flatMap(card => card.faces.flatMap(face => face[key].map(value => value.trim()).filter(Boolean))),
  )).sort((left, right) => left.localeCompare(right))
  return { supertypes: valuesFor('supertypes'), cardTypes: valuesFor('card_types'), subtypes: valuesFor('subtypes') }
})
const hasFacetFilters = computed(() => colorFilters.value.length + cardColors.value.length + supertypeFilters.value.length + cardTypeFilters.value.length + subtypeFilters.value.length > 0)
const filteredVisible = computed(() => {
  const query = filterText.value.trim().toLowerCase()
  const matchesAny = (values: string[], selected: string[]) => selected.length === 0 || selected.some(value => values.includes(value))
  return visible.value.filter((entry) => {
    const name = (entry.card?.name ?? entry.name).toLowerCase()
    if (!name.includes(query)) return false
    if (!entry.card) return !hasFacetFilters.value
    const colors = entry.card.color_identity.map(color => color.symbol.toUpperCase())
    const selectedColors = colorFilters.value.filter(color => color !== 'colorless')
    const colorMatches = colorFilters.value.length === 0 || (selectedColors.length === 0 ? colors.length === 0 : colors.every(color => selectedColors.includes(color)))
    const faceValues = (key: 'supertypes' | 'card_types' | 'subtypes') => entry.card!.faces.flatMap(face => face[key].map(value => value.trim()).filter(Boolean))
    return colorMatches
      && matchesCardColors(colors, cardColors.value, cardColorMode.value)
      && matchesAny(faceValues('supertypes'), supertypeFilters.value)
      && matchesAny(faceValues('card_types'), cardTypeFilters.value)
      && matchesAny(faceValues('subtypes'), subtypeFilters.value)
  })
})
const displayedCards = computed(() => filteredVisible.value.flatMap(entry => entry.card ? [entry.card] : []))
const unavailable = computed(() => filteredVisible.value.filter(entry => !entry.card))
const exportText = computed(() => displayedCards.value.map(card => `1 ${card.name}`).join('\n'))

function stopRefresh() {
  controller?.abort()
  controller = null
  refreshing.value = false
}
watch(() => auth.accessToken, () => {
  stopRefresh()
  entries.value = []
  if (!auth.isAuthenticated) void router.replace({ name: 'login', query: { redirect: route.fullPath } })
})
onBeforeUnmount(() => { active = false; stopRefresh() })

async function load() {
  const token = auth.accessToken
  loading.value = true
  error.value = ''
  try {
    await favourites.load()
    if (!favourites.loaded) throw new Error(favourites.error || 'Unable to load favorites.')
    const response = await favourites.request('/api/favourites')
    const data = await response.json()
    if (!active || token !== auth.accessToken) return
    entries.value = data.favourites
    favourites.ids = new Set(entries.value.map(entry => entry.oracle_id))
  } catch (err) {
    if (active && token === auth.accessToken) error.value = (err as Error).message
  } finally {
    if (active) loading.value = false
  }
}

async function refreshPrices() {
  if (refreshing.value) return
  const run = new AbortController()
  controller = run
  const token = auth.accessToken
  const queue = availableCards.value.flatMap(card => ['draco', 'vault'].map(store => ({ card, store })))
  total.value = queue.length
  completed.value = 0
  succeeded.value = 0
  cached.value = 0
  pendingPrices.value = 0
  unavailablePrices.value = 0
  priceResults.value = {}
  failures.value = {}
  refreshing.value = true
  const current = () => active && !run.signal.aborted && token === auth.accessToken
  async function worker() {
    while (queue.length && current()) {
      const task = queue.shift()!
      const { card, store } = task
      if (!favourites.ids.has(card.oracle_id)) { completed.value++; continue }
      try {
        const params = new URLSearchParams({ name: card.name, oracle_id: card.oracle_id })
        const response = await fetch(`/api/store-prices/${store}/${encodeURIComponent(card.oracle_id)}?${params}`, { signal: run.signal })
        if (!response.ok) throw new Error('Price check failed')
        const data: DracoPriceResponse = await response.json()
        if (current() && favourites.ids.has(card.oracle_id)) {
          priceResults.value[card.oracle_id] ??= {}
          priceResults.value[card.oracle_id]![store] = data
          if (typeof data.price_cop === 'number') { if (store === 'draco') card.dracostore_price_cop = data.price_cop; else card.vaultstore_price_cop = data.price_cop }
          if (store === 'draco') { card.dracostore_last_updated = data.last_updated; card.dracostore_next_refresh_at = data.next_refresh_at; card.dracostore_price_stale = data.stale } else { card.vaultstore_last_updated = data.last_updated; card.vaultstore_next_refresh_at = data.next_refresh_at; card.vaultstore_price_stale = data.stale }
          if (data.cache_status === 'refreshed') succeeded.value++
          else if (data.cache_status === 'cached') cached.value++
          else if (data.cache_status === 'in_progress') pendingPrices.value++
          else unavailablePrices.value++
        }
      } catch {
        if (current() && favourites.ids.has(card.oracle_id)) failures.value[card.oracle_id] = 'Refresh failed. Showing the last saved price, if available.'
      } finally {
        if (current()) completed.value++
      }
    }
  }
  await Promise.all([worker(), worker()])
  if (current()) { refreshing.value = false; controller = null }
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
  link.download = 'favourite-cards-export.txt'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
  exportMessage.value = 'Export downloaded.'
}
onMounted(load)
</script>

<template>
  <div class="results-container">
    <header class="results-header">
      <h1>Favorite Cards</h1>
      <span>{{ filteredVisible.length }} of {{ visible.length }} saved cards</span>
    </header>
    <section class="refresh-panel">
      <button type="button" :disabled="loading || refreshing || !availableCards.length" @click="refreshPrices">{{ refreshing ? 'Refreshing store prices…' : 'Refresh store prices' }}</button>
      <p v-if="total" role="status" aria-live="polite">{{ completed }}/{{ total }} processed · {{ succeeded }} updated · {{ cached }} cached · {{ unavailablePrices }} unavailable or stale · {{ pendingPrices }} in progress · {{ Object.keys(failures).length }} failed</p>
      <p>Store lookups are shared across users and checked at most once every 12 hours per card, including unsuccessful attempts. Fresh prices are reused automatically.</p>
    </section>
    <div v-if="error" class="error-msg-box" role="alert">{{ error }} <button type="button" @click="load">Retry</button></div>
    <p v-else-if="loading" role="status">Loading favorites…</p>
    <div v-else-if="!visible.length" class="empty-state">No favorites yet. Use the heart on a card to save it. <router-link :to="{ name: 'advanced-search' }">Find cards</router-link></div>
    <template v-else>
      <section class="favourites-tools">
        <CollectionToolbarFilters v-model="filterText" v-model:color-filters="colorFilters" v-model:card-colors="cardColors" v-model:card-color-mode="cardColorMode" v-model:supertype-filters="supertypeFilters" v-model:card-type-filters="cardTypeFilters" v-model:subtype-filters="subtypeFilters" label="Filter favorites" placeholder="Search saved favorites..." :supertype-options="facetOptions.supertypes" :card-type-options="facetOptions.cardTypes" :subtype-options="facetOptions.subtypes" />
        <div class="export-panel">
          <span>Export displayed cards · {{ displayedCards.length }} available</span>
          <span v-if="exportMessage" class="export-message" role="status">{{ exportMessage }}</span>
          <div class="export-actions"><button type="button" :disabled="!exportText" @click="copyExport">Copy</button><button type="button" :disabled="!exportText" @click="downloadExport">Download TXT</button></div>
        </div>
      </section>
      <div v-if="!filteredVisible.length" class="empty-state">No favorites match this filter. Try a different search or clear the selected facets.</div>
      <template v-else>
        <GameplayCardGrid :cards="displayedCards" :confirm-removal="true">
          <template #card-extra="{ card }">
            <p v-if="card.lowest_price_usd == null" class="price-note">Lowest USD price unavailable</p>
            <p v-if="card.dracostore_price_cop == null" class="price-note">Draco price unavailable</p>
            <p v-for="(result, store) in priceResults[card.oracle_id]" :key="store" class="price-note">{{ store === 'vault' ? 'The Vault: ' : 'Draco: ' }}{{ storeStatusLabel(result.cache_status) }}</p>
            <p v-if="card.vaultstore_price_cop == null" class="price-note">The Vault price unavailable</p>
            <p v-else-if="card.dracostore_price_stale && card.dracostore_price_cop != null" class="price-note">Stale Draco price</p>
            <p v-if="card.dracostore_last_updated" class="price-note">Last updated: {{ formatDracoTime(card.dracostore_last_updated) }}</p>
            <p v-if="card.dracostore_next_refresh_at" class="price-note">Next Draco lookup eligible: {{ formatDracoTime(card.dracostore_next_refresh_at) }}</p>
            <p v-if="failures[card.oracle_id]" class="price-note" role="status">{{ failures[card.oracle_id] }}</p>
          </template>
        </GameplayCardGrid>
        <article v-for="entry in unavailable" :key="entry.oracle_id" class="unavailable-card"><h3>{{ entry.name }}</h3><p>Card details are currently unavailable.</p><FavouriteButton :oracle-id="entry.oracle_id" :card-name="entry.name" :confirm-removal="true" /></article>
      </template>
    </template>
  </div>
</template>

<style scoped src="./SearchResults.css"></style>
<style scoped>
.refresh-panel { margin-bottom: 24px; color: var(--text-muted); }
.refresh-panel button, .error-msg-box button, .export-actions button { padding: 10px 14px; background: var(--surface-card); color: var(--text-main); border: 1px solid var(--surface-border-light); border-radius: 10px; cursor: pointer; font: inherit; }
.favourites-tools { display: grid; gap: 16px; margin-bottom: 24px; padding: 16px; border: 1px solid var(--surface-border-light); border-radius: 14px; background: var(--surface-card); }
.export-panel { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: var(--text-muted); font-size: .88rem; }
.export-message { color: var(--accent-electric); }
.export-actions { display: flex; gap: 8px; margin-left: auto; }
.export-actions button:hover:not(:disabled) { border-color: var(--accent-electric); color: var(--accent-electric); }
button:disabled { opacity: .5; cursor: default; }
.price-note { color: var(--text-muted); font-size: .8rem; margin: 0; }
.unavailable-card { margin-top: 20px; padding: 16px; border: 1px solid var(--surface-border-light); border-radius: 12px; }
a { color: var(--accent-electric); }
@media (max-width: 560px) { .export-actions { width: 100%; margin-left: 0; } }
</style>
