<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FavouriteButton from '@/components/cards/FavouriteButton.vue'
import CardFaceViewer from '@/components/cards/CardFaceViewer.vue'
import type { GameplayCard } from '@/types/gameplayCard'
import { storeStatusLabel, formatDracoTime, type DracoPriceResponse } from '@/types/dracoPrice'

function cleanCardNameForSearch(name: string): string {
  if (!name) return ''
  return name.split('//')[0].trim()
}

interface PriceInfo {
  price: string
  currency: string
}

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref<string | null>(null)
const card = ref<GameplayCard | null>(null)

const priceLoading = ref(true)
const priceError = ref(false)
const priceData = ref<PriceInfo | null>(null)
const priceResult = ref<DracoPriceResponse | null>(null)
const vaultLoading = ref(true)
const vaultResult = ref<DracoPriceResponse | null>(null)

const oracleId = computed(() => route.params.id as string)

async function loadCardDetails() {
  loading.value = true
  error.value = null
  
  try {
    const response = await fetch(`/api/cards/id/${oracleId.value}`)
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error || `HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    card.value = data as GameplayCard
    
    fetchLocalPrice(data.name)
    fetchVaultPrice(data.name)
  }
  catch (err: any) {
    console.error('Fetch card details failed:', err)
    error.value = err.message || 'Failed to connect to the card database server.'
  }
  finally {
    loading.value = false
  }
}

async function fetchLocalPrice(cardName: string) {
  priceLoading.value = true
  priceError.value = false
  priceData.value = null
  priceResult.value = null
  
  try {
    const params = new URLSearchParams({ name: cardName, oracle_id: oracleId.value })
    const response = await fetch(`/api/scrape-price?${params.toString()}`)
    
    if (!response.ok) {
      throw new Error(`Scraper responded with status code: ${response.status}`)
    }
    
    const data: DracoPriceResponse = await response.json()
    priceResult.value = data
    
    if (data.success && data.price != null) {
      priceData.value = {
        price: data.price,
        currency: data.currency || 'COP'
      }
    } else {
      priceError.value = true
    }
  } catch (err) {
    console.warn(`Could not scrap price details for: "${cardName}"`, err)
    priceError.value = true
  } finally {
    priceLoading.value = false
  }
}

async function fetchVaultPrice(cardName: string) {
  vaultLoading.value = true
  try {
    const response = await fetch(`/api/store-prices/vault/${oracleId.value}?${new URLSearchParams({ name: cardName })}`)
    if (!response.ok) throw new Error('Vault price lookup failed')
    vaultResult.value = await response.json() as DracoPriceResponse
  } catch (err) { console.warn('Could not check The Vault price', err) }
  finally { vaultLoading.value = false }
}

const dracoStoreUrl = computed(() => {
  if (!card.value?.name) return '#'
  const cleanedName = cleanCardNameForSearch(card.value.name)
  return `https://dracostore.co/catalogo?q=${encodeURIComponent(cleanedName)}&sort=price_asc`
})

function parseSymbols(text: string | null | undefined) {
  if (!text) return ''
  return text.replace(/{([^}]+)}/g, '<span class="sym symbol-$1">$1</span>')
}

const hasClassificationMetadata = computed(() =>
  !!card.value && (card.value.categories.length > 0 || card.value.archetypes.length > 0)
)

const hasMarkerMetadata = computed(() => !!card.value?.markers?.length)

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

onMounted(() => {
  if (oracleId.value) {
    loadCardDetails()
  } else {
    error.value = 'Invalid or missing card identification parameter.'
    loading.value = false
  }
})
</script>

<template>
  <div class="page-wrapper">
    <nav class="nav-bar">
      <button class="back-btn" @click="goBack">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/></svg>
        Back
      </button>
    </nav>

    <div v-if="loading" class="details-grid skeleton-view">
      <section class="visual-pane">
        <div class="card-frame skeleton-pulse"></div>
        <div class="price-widget-card skeleton-pulse-light"></div>
      </section>
      <section class="data-pane">
        <div class="skeleton-line headline skeleton-pulse"></div>
        <div class="skeleton-line subline skeleton-pulse"></div>
        <div class="skeleton-box text-block skeleton-pulse-light"></div>
      </section>
    </div>

    <div v-else-if="error" class="error-state">
      <div class="error-card">
        <h3>Unable to Load Card</h3>
        <p>{{ error }}</p>
        <button class="btn btn-secondary" @click="loadCardDetails">Try Again</button>
      </div>
    </div>

    <main v-else-if="card" class="details-grid">
      <section class="visual-pane">
        <div class="image-sticky-wrapper">
          <div class="card-frame">
            <CardFaceViewer
              :card="card"
              image-size="large"
              :show-flip-control="true"
              :interactive="true"
              :lazy="false"
            />
          </div>

          <div class="price-widget-card" :class="{ 'has-error': priceError }">
            <div class="widget-header">
              <span class="widget-title">DracoStore Market</span>
              <span class="live-indicator" :class="{ 'loading-active': priceLoading }">
                <span class="pulse-dot"></span> {{ priceLoading ? 'Checking…' : priceResult ? storeStatusLabel(priceResult.cache_status) : 'Price unavailable' }}
              </span>
            </div>
            
            <div class="widget-body">
              <div v-if="priceLoading" class="price-skeleton-block">
                <div class="skeleton-line price-row-mock skeleton-pulse"></div>
                <p class="placeholder-note">Checking saved prices and refreshing only when eligible…</p>
              </div>

              <div v-else-if="priceError || !priceData" class="price-fallback-view">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="fallback-msg">Price not available</span>
              </div>

              <a 
                v-else 
                :href="dracoStoreUrl" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="price-active-view price-redirect-link"
              >
                <div class="price-row">
                  <span class="store-identity">DracoStore Co.</span>
                  <span class="scraped-price">
                    <span class="currency-symbol">$</span>{{ priceData.price }}
                    <span class="currency-badge">{{ priceData.currency }}</span>
                  </span>
                </div>
                <div class="redirect-hint">View on Store →</div>
              </a>
              <p v-if="priceResult?.last_updated" class="placeholder-note">Last updated: {{ formatDracoTime(priceResult.last_updated) }}</p>
              <p v-if="priceResult?.next_refresh_at" class="placeholder-note">Next Draco lookup eligible: {{ formatDracoTime(priceResult.next_refresh_at) }}</p>
            </div>
          </div>

          <div class="price-widget-card" :class="{ 'has-error': !vaultLoading && !vaultResult?.success }">
            <div class="widget-header"><span class="widget-title">The Vault Market</span><span class="live-indicator" :class="{ 'loading-active': vaultLoading }"><span class="pulse-dot"></span> {{ vaultLoading ? 'Checking…' : vaultResult ? storeStatusLabel(vaultResult.cache_status) : 'Price unavailable' }}</span></div>
            <div class="widget-body"><div v-if="vaultLoading" class="price-skeleton-block"><div class="skeleton-line price-row-mock skeleton-pulse"></div></div><div v-else-if="!vaultResult?.success" class="price-fallback-view"><span class="fallback-msg">Price not available</span></div><a v-else :href="vaultResult.product_url || '#'" target="_blank" rel="noopener noreferrer" class="price-active-view price-redirect-link"><div class="price-row"><span class="store-identity">The Vault</span><span class="scraped-price"><span class="currency-symbol">$</span>{{ vaultResult.price }}<span class="currency-badge">COP</span></span></div><div class="redirect-hint">View on Store →</div></a><p v-if="vaultResult?.last_updated" class="placeholder-note">Last updated: {{ formatDracoTime(vaultResult.last_updated) }}</p></div>
          </div>

          <FavouriteButton :oracle-id="card.oracle_id" :card-name="card.name" />

          <div class="legality-box">
            <h3>Format Legality</h3>
            <div class="legality-grid">
              <div class="legality-row" :class="{ legal: card.commander_legal }">
                <span class="format-badge">Commander</span>
                <span class="status-badge">{{ card.commander_legal ? 'Legal' : 'Not Legal' }}</span>
              </div>
              <div class="legality-row" :class="{ legal: card.standard_legal }">
                <span class="format-badge">Standard</span>
                <span class="status-badge">{{ card.standard_legal ? 'Legal' : 'Not Legal' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="data-pane">
        <div v-for="(face, idx) in card.faces" :key="idx" class="card-face-block">
          <header class="card-title-area">
            <div>
              <h1 class="card-name">{{ face.name }}</h1>
              <div class="type-line">
                <span v-if="face.supertypes?.length" class="super-type">
                  {{ face.supertypes.join(' ') }}
                </span>
                {{ face.card_types.join(' ') }} 
                <span v-if="face.subtypes?.length">— {{ face.subtypes.join(' ') }}</span>
              </div>
            </div>
            <div class="mana-cost-display" v-html="parseSymbols(face.mana_cost)"></div>
          </header>

          <div v-if="card.keywords?.length" class="keywords-wrap">
            <router-link 
              v-for="kw in card.keywords" 
              :key="kw.label" 
              :to="{ name: 'search-results', query: { oracle_text: kw.label } }"
              class="keyword-pill"
            >
              {{ kw.label }}
            </router-link>
          </div>

          <div class="oracle-text-box">
            <p v-for="(paragraph, pIdx) in (face.oracle_text || '').split('\n')" 
               :key="pIdx" 
               v-html="parseSymbols(paragraph)">
            </p>
          </div>
        </div>

        <div class="metadata-section">
          <h2>Data Engine Tags</h2>

          <div v-if="hasMarkerMetadata" class="tag-group">
            <h3>Markers</h3>
            <div class="tags-flex">
              <router-link
                v-for="marker in card.markers"
                :key="marker.id"
                :to="{ name: 'search-results', query: { markers: marker.name } }"
                class="tag-pill direct"
                :title="marker.description || 'No detailed description'"
              >
                {{ marker.name }}
              </router-link>
            </div>
          </div>
          
          <div v-if="card.tags?.direct?.length" class="tag-group">
            <h3>Direct Attributes</h3>
            <div class="tags-flex">
              <router-link 
                v-for="tag in card.tags.direct" 
                :key="tag.slug" 
                :to="{ name: 'search-results', query: { tags: tag.slug } }"
                class="tag-pill direct"
                :title="tag.description || 'No detailed description'"
              >
                {{ tag.slug }}
              </router-link>
            </div>
          </div>

          <div v-if="card.tags?.inherited?.length" class="tag-group">
            <h3>Inherited Attributes</h3>
            <div class="tags-flex">
              <router-link 
                v-for="tag in card.tags.inherited" 
                :key="tag.slug" 
                :to="{ name: 'search-results', query: { tags: tag.slug } }"
                class="tag-pill inherited"
                :title="tag.description || 'No detailed description'"
              >
                {{ tag.slug }}
              </router-link>
            </div>
          </div>
        </div>

        <div v-if="hasClassificationMetadata" class="metadata-section">
          <h2>Classification Data</h2>

          <div v-if="card.categories.length" class="tag-group">
            <h3>Categories</h3>
            <div class="tags-flex">
              <span
                v-for="category in card.categories"
                :key="category.name"
                class="tag-pill category"
              >
                {{ category.name }}
              </span>
            </div>
          </div>

          <div v-if="card.archetypes.length" class="tag-group">
            <h3>Archetypes</h3>
            <div class="tags-flex">
              <span
                v-for="archetype in card.archetypes"
                :key="archetype.name"
                class="tag-pill archetype"
              >
                {{ archetype.name }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="card.themes?.length" class="metadata-section">
          <h2>Community Archetypes & Themes</h2>
          <div class="themes-grid">
            <router-link 
              v-for="theme in card.themes" 
              :key="theme.theme_id" 
              :to="{ name: 'search-results', query: { tags: theme.name } }"
              class="theme-card"
            >
              <span class="theme-name">#{{ theme.name }}</span>
              <span class="theme-score" title="Relevance Score">{{ theme.score }}</span>
            </router-link>
          </div>
        </div>

      </section>
    </main>
  </div>
</template>

<style scoped src="./CardDetail.css"></style>
