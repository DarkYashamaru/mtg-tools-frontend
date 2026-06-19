<script setup lang="ts">
import { ref } from 'vue'

interface SearchCard {
  oracle_id: string
  name: string
  cmc: number
  faces?: {
    small_image?: string
    medium_image?: string
    large_image?: string
  }[]
}

const loading = ref(false)
const hasSearched = ref(false)
const results = ref<SearchCard[]>([])

const name = ref('')
const cardType = ref('')
const oracleText = ref('')
const excludeOracleText = ref('')
const tags = ref('')
const excludeTags = ref('')
const exactColors = ref(false)
const selectedColors = ref<string[]>([])

// Refactored values to match the clean aesthetic on dynamic selection
const colorOptions = [
  { symbol: 'W', label: 'White', hex: '#fef3c7', text: '#78350f' },
  { symbol: 'U', label: 'Blue', hex: '#1d4ed8', text: '#ffffff' },
  { symbol: 'B', label: 'Black', hex: '#1f2937', text: '#ffffff' },
  { symbol: 'R', label: 'Red', hex: '#b91c1c', text: '#ffffff' },
  { symbol: 'G', label: 'Green', hex: '#047857', text: '#ffffff' },
]

function toggleColor(color: string) {
  const index = selectedColors.value.indexOf(color)
  if (index >= 0) {
    selectedColors.value.splice(index, 1)
  } else {
    selectedColors.value.push(color)
  }
}

function clearFilters() {
  name.value = ''
  cardType.value = ''
  oracleText.value = ''
  excludeOracleText.value = ''
  tags.value = ''
  excludeTags.value = ''
  exactColors.value = false
  selectedColors.value = []
  results.value = []
  hasSearched.value = false
}

function appendCommaSeparatedValues(
  params: URLSearchParams,
  key: string,
  value: string,
) {
  if (!value.trim()) return
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .forEach(item => params.append(key, item))
}

async function runSearch() {
  loading.value = true
  hasSearched.value = true

  try {
    const params = new URLSearchParams()

    if (name.value.trim()) params.append('name', name.value.trim())
    if (cardType.value.trim()) params.append('card_type', cardType.value.trim())

    appendCommaSeparatedValues(params, 'oracle_text', oracleText.value)
    appendCommaSeparatedValues(params, 'exclude_oracle_text', excludeOracleText.value)
    appendCommaSeparatedValues(params, 'tags', tags.value)
    appendCommaSeparatedValues(params, 'exclude_tags', excludeTags.value)

    if (exactColors.value) params.append('exact_colors', 'true')
    selectedColors.value.forEach(color => params.append('colors', color))

    const url = `/api/advanced?${params.toString()}`
    const response = await fetch(url)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const text = await response.text()
    results.value = JSON.parse(text)
  }
  catch (error) {
    console.error('FETCH ERROR:', error)
    results.value = []
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="search-container">
    <header class="search-header">
      <h1>Advanced Card Search</h1>
      <p class="description">
        Find cards instantly using specific mechanics, colors, tags, and text parameters.
      </p>
    </header>

    <form @submit.prevent="runSearch" class="search-panel">
      <div class="form-grid">
        <div class="field">
          <label for="card-name">Card Name</label>
          <input id="card-name" v-model="name" placeholder="e.g., Sol Ring">
        </div>

        <div class="field">
          <label for="card-type">Card Type</label>
          <input id="card-type" v-model="cardType" placeholder="e.g., Creature, Artifact">
        </div>

        <div class="field">
          <label for="oracle-inc">Oracle Text Includes</label>
          <input id="oracle-inc" v-model="oracleText" placeholder="draw, counter, copy">
        </div>

        <div class="field">
          <label for="oracle-exc">Oracle Text Excludes</label>
          <input id="oracle-exc" v-model="excludeOracleText" placeholder="sacrifice, discard">
        </div>

        <div class="field">
          <label for="tags-inc">Tags Includes</label>
          <input id="tags-inc" v-model="tags" placeholder="removal, card-draw">
        </div>

        <div class="field">
          <label for="tags-exc">Tags Excludes</label>
          <input id="tags-exc" v-model="excludeTags" placeholder="stax, combo-piece">
        </div>
      </div>

      <div class="colors-section">
        <span class="section-label">Color Identity</span>
        <div class="colors-wrapper">
          <div class="color-buttons">
            <button
              v-for="color in colorOptions"
              :key="color.symbol"
              type="button"
              class="color-btn"
              :class="{ active: selectedColors.includes(color.symbol) }"
              :style="{ 
                '--color-theme': color.hex,
                '--color-text': color.text 
              }"
              :title="color.label"
              @click="toggleColor(color.symbol)"
            >
              {{ color.symbol }}
            </button>
          </div>

          <label class="checkbox-row">
            <input v-model="exactColors" type="checkbox">
            <span>Match exact color scheme</span>
          </label>
        </div>
      </div>

      <div class="actions-row">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Searching...' : 'Search Cards' }}
        </button>
        <button type="button" class="btn btn-secondary" @click="clearFilters">
          Reset Filters
        </button>
      </div>
    </form>

    <div v-if="hasSearched && !loading" class="results-meta">
      <strong>{{ results.length }}</strong> cards match your criteria
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

    <div v-else-if="hasSearched && results.length === 0" class="empty-state">
      <p>No cards found matching those criteria. Try expanding your parameters.</p>
    </div>

    <div v-else class="card-grid">
      <a
        v-for="card in results"
        :key="card.oracle_id"
        :href="`/card/${card.oracle_id}`"
        class="card"
      >
        <div class="card-img-wrapper">
          <img
            v-if="card.faces?.[0]?.large_image"
            :src="card.faces[0].large_image"
            :alt="card.name"
            loading="lazy"
          >
          <div v-else class="img-missing">No Image Available</div>
        </div>

        <div class="card-info">
          <h3>{{ card.name }}</h3>
          <span class="cmc-badge">CMC {{ card.cmc }}</span>
        </div>
      </a>
    </div>
  </div>
</template>

<style scoped src="./AdvancedSearch.css"></style>