<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { LocationQueryValue } from 'vue-router'
import CardFaceViewer from '@/components/cards/CardFaceViewer.vue'
import CardPriceBadges from '@/components/cards/CardPriceBadges.vue'
import { useAuthStore } from '@/stores/authStore'
import type { GameplayCard } from '@/types/gameplayCard'
import { formatSearchResultsExport } from '@/utils/searchResultsExport'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { authHeaders } = storeToRefs(authStore)
const loading = ref(false)
const error = ref<string | null>(null)
const results = ref<GameplayCard[]>([])
const exportMessage = ref('')
const exportText = computed(() => formatSearchResultsExport(results.value))


function ownershipCollections(card: GameplayCard) {
  const namesById = new Map<number, string>()

  for (const source of card.ownership_sources ?? []) {
    if (source.collection_name) {
      namesById.set(source.collection_id, source.collection_name)
    }
  }

  return Array.from(namesById, ([id, name]) => ({ id, name })).sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

function appendValue(
  params: URLSearchParams,
  key: string,
  value: LocationQueryValue | LocationQueryValue[] | undefined
) {
  if (value == null) return

  if (Array.isArray(value)) {
    value.forEach(item => {
      if (item == null) return

      const trimmed = item.trim()

      if (trimmed) {
        params.append(key, trimmed)
      }
    })

    return
  }

  const trimmed = value.trim()

  if (trimmed) {
    params.append(key, trimmed)
  }
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
  link.download = 'advanced-search-export.txt'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

async function executeSearchFetch() {
  loading.value = true
  error.value = null
  exportMessage.value = ''

  try {
    const params = new URLSearchParams()
    const q = route.query

    if (q.name) params.append('name', String(q.name).trim())
    if (q.card_type) params.append('card_type', String(q.card_type).trim())
    appendValue(params, 'cmc_min', q.cmc_min)
    appendValue(params, 'cmc_max', q.cmc_max)

    // Do not split by commas here.
    appendValue(params, 'oracle_text', q.oracle_text)
    appendValue(params, 'exclude_oracle_text', q.exclude_oracle_text)
    appendValue(params, 'tags', q.tags)
    appendValue(params, 'exclude_tags', q.exclude_tags)
    appendValue(params, 'markers', q.markers)
    appendValue(params, 'exclude_markers', q.exclude_markers)

    if (q.exact_colors === 'true') params.append('exact_colors', 'true')
    if (q.colorless === 'true') params.append('colorless', 'true')

    appendValue(params, 'colors', q.colors)
    const isMasterScope = q.scope === 'master'
    const endpoint = isMasterScope
      ? `/api/collections/master/search?${params.toString()}`
      : `/api/advanced?${params.toString()}`
    const response = await fetch(endpoint, {
      headers: isMasterScope ? { ...authHeaders.value } : undefined,
    })

    if (response.status === 401 && isMasterScope) {
      authStore.logout()
      router.replace({
        name: 'login',
        query: { redirect: route.fullPath },
      })
      return
    }

    const payload = await response.json()
    if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`)

    results.value = isMasterScope ? payload.results ?? [] : payload
  } catch (err: any) {
    console.error('SEARCH ERROR:', err)
    error.value = 'Failed to load card results matching current parameter configuration.'
    results.value = []
  } finally {
    loading.value = false
  }
}

// Watcher monitors route queries to catch manual URL modifications instantly
watch(
  () => route.query,
  () => {
    executeSearchFetch()
  },
  { immediate: true }
)
</script>

<template>
  <div class="results-container">
    <header class="results-header">
      <div class="nav-context">
        <router-link :to="{ name: 'advanced-search', query: route.query.scope === 'master' ? { scope: 'master' } : {} }" class="back-link">
        ← Adjust Search Fields
        </router-link>
        <h1>Engine Search Results</h1>
      </div>
      <div v-if="!loading" class="results-meta">
        Found <strong>{{ results.length }}</strong> matching cards
      </div>
    </header>

    <section class="export-panel" aria-labelledby="search-export-title">
      <div>
        <span id="search-export-title" class="export-title">Export search results</span>
        <span class="export-count">{{ results.length }} cards</span>
      </div>
      <p class="export-description">
        Archidekt-style card list compatible with Deck Details.
      </p>
      <div class="export-actions">
        <button type="button" :disabled="loading || !exportText" @click="copyExport">
          Copy export
        </button>
        <button type="button" :disabled="loading || !exportText" @click="downloadExport">
          Download TXT
        </button>
        <span v-if="exportMessage" class="export-message" role="status" aria-live="polite">
          {{ exportMessage }}
        </span>
      </div>
    </section>

    <div v-if="error" class="error-msg-box">
      <p>{{ error }}</p>
    </div>

    <div v-if="loading" class="card-grid placeholders">
      <div v-for="n in 8" :key="n" class="card skeleton">
        <div class="skeleton-img"></div>
        <div class="skeleton-info">
          <div class="line title"></div>
          <div class="line text"></div>
        </div>
      </div>
    </div>

    <div v-else-if="results.length === 0" class="empty-state">
      <p>No cards discovered matching this query parameter scheme. Try adjusting your parameters.</p>
    </div>

    <div v-else class="card-grid">
      <router-link
        v-for="card in results"
        :key="card.oracle_id"
        :to="{ name: 'card-detail', params: { id: card.oracle_id } }"
        class="card"
      >
        <div class="card-img-wrapper">
          <CardFaceViewer
            :card="card"
            image-size="large"
            :show-flip-control="true"
            :interactive="true"
          />
        </div>

        <div class="card-info">
          <h3>{{ card.name }}</h3>
          <div class="card-price-badges">
            <span class="cmc-badge">CMC {{ card.cmc }}</span>
            <CardPriceBadges
              :usd-price="card.lowest_price_usd"
              :draco-price="card.dracostore_price_cop"
            />
          </div>
          <div v-if="card.owned_amount" class="ownership-pills">
            <span class="metadata-pill ownership">Owned {{ card.owned_amount }}x</span>
            <span
              v-for="collection in ownershipCollections(card)"
              :key="`collection-${card.oracle_id}-${collection.id}`"
              class="metadata-pill ownership"
            >
              {{ collection.name }}
            </span>
          </div>
          <div v-if="card.categories.length || card.archetypes.length" class="metadata-pills">
            <span
              v-for="category in card.categories"
              :key="`category-${card.oracle_id}-${category.name}`"
              class="metadata-pill category"
            >
              {{ category.name }}
            </span>
            <span
              v-for="archetype in card.archetypes"
              :key="`archetype-${card.oracle_id}-${archetype.name}`"
              class="metadata-pill archetype"
            >
              {{ archetype.name }}
            </span>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>

<style scoped src="./SearchResults.css"></style>
<style scoped>
.ownership-pills,
.metadata-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.metadata-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--surface-border-light);
  color: var(--text-main);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.metadata-pill.category {
  background: rgba(56, 189, 248, 0.12);
  border-color: var(--accent-electric-border);
}

.metadata-pill.archetype {
  background: rgba(148, 163, 184, 0.12);
}

.metadata-pill.ownership {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.28);
}
</style>
