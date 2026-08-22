<script setup lang="ts">
import { computed, watchEffect, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)

const name = ref('')
const cardType = ref('')
const oracleText = ref('')
const excludeOracleText = ref('')
const tags = ref('')
const excludeTags = ref('')
const markers = ref('')
const excludeMarkers = ref('')
const exactColors = ref(false)
const selectedColors = ref<string[]>([])
const colorlessOnly = ref(false)
const searchMasterOnly = ref(false)
const canSearchMasterCollection = computed(() => isAuthenticated.value)

const colorOptions = [
  { symbol: 'W', label: 'White', hex: '#fef3c7', text: '#78350f' },
  { symbol: 'U', label: 'Blue', hex: '#1d4ed8', text: '#ffffff' },
  { symbol: 'B', label: 'Black', hex: '#1f2937', text: '#ffffff' },
  { symbol: 'R', label: 'Red', hex: '#b91c1c', text: '#ffffff' },
  { symbol: 'G', label: 'Green', hex: '#047857', text: '#ffffff' },
]

function toggleColor(color: string) {
  colorlessOnly.value = false
  const index = selectedColors.value.indexOf(color)
  if (index >= 0) {
    selectedColors.value.splice(index, 1)
  } else {
    selectedColors.value.push(color)
  }
}

function toggleColorlessOnly() {
  colorlessOnly.value = !colorlessOnly.value
  if (colorlessOnly.value) {
    selectedColors.value = []
    exactColors.value = false
  }
}

function clearFilters() {
  name.value = ''
  cardType.value = ''
  oracleText.value = ''
  excludeOracleText.value = ''
  tags.value = ''
  excludeTags.value = ''
  markers.value = ''
  excludeMarkers.value = ''
  exactColors.value = false
  selectedColors.value = []
  colorlessOnly.value = false
  searchMasterOnly.value = false
}

function runSearch() {
  const queryPayload: Record<string, any> = {}

  if (name.value.trim()) queryPayload.name = name.value.trim()
  if (cardType.value.trim()) queryPayload.card_type = cardType.value.trim()
  if (oracleText.value.trim()) queryPayload.oracle_text = oracleText.value.trim()
  if (excludeOracleText.value.trim()) queryPayload.exclude_oracle_text = excludeOracleText.value.trim()
  if (tags.value.trim()) queryPayload.tags = tags.value.trim()
  if (excludeTags.value.trim()) queryPayload.exclude_tags = excludeTags.value.trim()
  if (markers.value.trim()) queryPayload.markers = markers.value.trim()
  if (excludeMarkers.value.trim()) queryPayload.exclude_markers = excludeMarkers.value.trim()
  if (exactColors.value) queryPayload.exact_colors = 'true'
  if (selectedColors.value.length) queryPayload.colors = selectedColors.value
  if (colorlessOnly.value) queryPayload.colorless = 'true'
  if (searchMasterOnly.value && canSearchMasterCollection.value) queryPayload.scope = 'master'

  // Hand off execution cleanly to the specialized query route
  router.push({ name: 'search-results', query: queryPayload })
}

watchEffect(() => {
  searchMasterOnly.value = route.query.scope === 'master' && canSearchMasterCollection.value
  colorlessOnly.value = route.query.colorless === 'true'
})
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

        <div class="field">
          <label for="markers-inc">Markers Includes</label>
          <input id="markers-inc" v-model="markers" placeholder="cheap-spell">
        </div>

        <div class="field">
          <label for="markers-exc">Markers Excludes</label>
          <input id="markers-exc" v-model="excludeMarkers" placeholder="cheap-spell">
        </div>
      </div>

      <div class="colors-section">
        <span class="section-label">Color And Mana Filters</span>
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
            <button
              type="button"
              class="color-btn colorless-btn"
              :class="{ active: colorlessOnly }"
              title="Only colorless mana in mana cost"
              @click="toggleColorlessOnly"
            >
              C
            </button>
          </div>

          <label class="checkbox-row">
            <input v-model="exactColors" type="checkbox" :disabled="colorlessOnly">
            <span>Match exact color scheme</span>
          </label>

          <label class="checkbox-row">
            <input v-model="searchMasterOnly" type="checkbox" :disabled="!canSearchMasterCollection">
            <span>Search only my master collection</span>
          </label>
        </div>
        <p class="filter-note">
          `C` searches cards whose mana cost uses only generic or colorless mana symbols, such as `Sol Ring` or `Hero's Blade`.
        </p>
      </div>

      <p v-if="!canSearchMasterCollection" class="auth-note">
        Log in to search only within your master collection.
      </p>

      <div class="actions-row">
        <button type="submit" class="btn btn-primary">Search Cards</button>
        <button type="button" class="btn btn-secondary" @click="clearFilters">
          Reset Filters
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped src="./AdvancedSearch.css"></style>
