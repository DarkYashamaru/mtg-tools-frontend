<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { LocationQueryValue } from 'vue-router'
import CardFaceViewer from '@/components/cards/CardFaceViewer.vue'
import type { GameplayCard } from '@/types/gameplayCard'

const route = useRoute()
const loading = ref(false)
const error = ref<string | null>(null)
const results = ref<GameplayCard[]>([])

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

async function executeSearchFetch() {
  loading.value = true
  error.value = null

  try {
    const params = new URLSearchParams()
    const q = route.query

    if (q.name) params.append('name', String(q.name).trim())
    if (q.card_type) params.append('card_type', String(q.card_type).trim())

    // Do not split by commas here.
    appendValue(params, 'oracle_text', q.oracle_text)
    appendValue(params, 'exclude_oracle_text', q.exclude_oracle_text)
    appendValue(params, 'tags', q.tags)
    appendValue(params, 'exclude_tags', q.exclude_tags)

    if (q.exact_colors === 'true') params.append('exact_colors', 'true')

    appendValue(params, 'colors', q.colors)

    const response = await fetch(`/api/advanced?${params.toString()}`)
    if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`)

    results.value = await response.json()
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
        <router-link :to="{ name: 'advanced-search' }" class="back-link">
        ← Adjust Search Fields
        </router-link>
        <h1>Engine Search Results</h1>
      </div>
      <div v-if="!loading" class="results-meta">
        Found <strong>{{ results.length }}</strong> matching cards
      </div>
    </header>

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
          <span class="cmc-badge">CMC {{ card.cmc }}</span>
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
</style>
