<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

function cleanCardNameForSearch(name: string): string {
  if (!name) return ''
  
  return name
    // Extract the first face if it's a split/double-faced card
    .split('//')[0]
    .trim()
}

// Define interfaces matching your Flask backend JSON structure
interface ColorIdentity {
  symbol: string
}

interface CardFace {
  card_types: string[]
  large_image: string
  normal_image: string
  small_image: string
  mana_cost: string
  name: string
  oracle_text: string
  subtypes: string[]
  supertypes: string[]
}

interface TagItem {
  slug: string
  description: string | null
}

interface CardTags {
  direct: TagItem[]
  inherited: TagItem[]
}

interface CardTheme {
  theme_id: number
  name: string
  score: number
  curated: boolean
}

interface CardData {
  oracle_id: string
  name: string
  cmc: number
  layout: string
  standard_legal: boolean
  commander_legal: boolean
  color_identity: ColorIdentity[]
  faces: CardFace[]
  keywords: { label: string }[]
  tags: CardTags
  themes: CardTheme[]
}

// Pricing response data contract
interface PriceInfo {
  price: string
  currency: string
}

const route = useRoute()
const router = useRouter()

// Main Layout States
const loading = ref(true)
const error = ref<string | null>(null)
const card = ref<CardData | null>(null)

// Lazy Price Scraping States
const priceLoading = ref(true)
const priceError = ref(false)
const priceData = ref<PriceInfo | null>(null)

// Grab the ID from the route params (/card/:id)
const oracleId = computed(() => route.params.id as string)

// Fetch card by oracle_id from backend
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
    card.value = data
    
    // Lazy-load local prices immediately after successful card fetch
    fetchLocalPrice(data.name)
  }
  catch (err: any) {
    console.error('Fetch card details failed:', err)
    error.value = err.message || 'Failed to connect to the card database server.'
  }
  finally {
    loading.value = false
  }
}

// Asynchronously query the web scraper route
async function fetchLocalPrice(cardName: string) {
  priceLoading.value = true
  priceError.value = false
  priceData.value = null
  
  try {
    const response = await fetch(`/api/scrape-price?name=${encodeURIComponent(cardName)}`)
    
    if (!response.ok) {
      throw new Error(`Scraper responded with status code: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.success) {
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

// Computes the final target marketplace link
const dracoStoreUrl = computed(() => {
  if (!card.value?.name) return '#'
  const cleanedName = cleanCardNameForSearch(card.value.name)
  return `https://dracostore.co/catalogo?q=${encodeURIComponent(cleanedName)}`
})

// Format raw text bracket symbols like {3}{G} or {E} into neat UI badges
function parseSymbols(text: string) {
  if (!text) return ''
  return text.replace(/{([^}]+)}/g, '<span class="sym symbol-$1">$1</span>')
}

const mainImage = computed(() => card.value?.faces?.[0]?.large_image || '')

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
            <img :src="mainImage" :alt="card.name" class="card-large-img" />
          </div>

          <div class="price-widget-card" :class="{ 'has-error': priceError }">
            <div class="widget-header">
              <span class="widget-title">DracoStore Market</span>
              <span class="live-indicator" :class="{ 'loading-active': priceLoading }">
                <span class="pulse-dot"></span> {{ priceLoading ? 'Scraping...' : 'Live Engine' }}
              </span>
            </div>
            
            <div class="widget-body">
              <div v-if="priceLoading" class="price-skeleton-block">
                <div class="skeleton-line price-row-mock skeleton-pulse"></div>
                <p class="placeholder-note">Crawling live local inventories...</p>
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
            </div>
          </div>

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
            <span v-for="kw in card.keywords" :key="kw.label" class="keyword-pill">
              {{ kw.label }}
            </span>
          </div>

          <div class="oracle-text-box">
            <p v-for="(paragraph, pIdx) in face.oracle_text.split('\n')" 
               :key="pIdx" 
               v-html="parseSymbols(paragraph)">
            </p>
          </div>
        </div>

        <div class="metadata-section">
          <h2>Data Engine Tags</h2>
          
          <div v-if="card.tags?.direct?.length" class="tag-group">
            <h3>Direct Attributes</h3>
            <div class="tags-flex">
              <span v-for="tag in card.tags.direct" 
                    :key="tag.slug" 
                    class="tag-pill direct"
                    :title="tag.description || 'No detailed description'">
                {{ tag.slug }}
              </span>
            </div>
          </div>

          <div v-if="card.tags?.inherited?.length" class="tag-group">
            <h3>Inherited Attributes</h3>
            <div class="tags-flex">
              <span v-for="tag in card.tags.inherited" 
                    :key="tag.slug" 
                    class="tag-pill inherited"
                    :title="tag.description || 'No detailed description'">
                {{ tag.slug }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="card.themes?.length" class="metadata-section">
          <h2>Community Archetypes & Themes</h2>
          <div class="themes-grid">
            <div v-for="theme in card.themes" :key="theme.theme_id" class="theme-card">
              <span class="theme-name">#{{ theme.name }}</span>
              <span class="theme-score" title="Relevance Score">{{ theme.score }}</span>
            </div>
          </div>
        </div>

      </section>
    </main>
  </div>
</template>

<style scoped src="./CardDetail.css"></style>