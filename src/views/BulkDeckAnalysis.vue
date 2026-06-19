<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCollectionStore } from '../stores/collectionStore'
import DeckInput from '../components/DeckInput.vue'

const router = useRouter()
const store = useCollectionStore()

const deckText = ref('')
const loading = ref(false)
const error = ref('')

async function fetchDeckCards() {
  error.value = ''
  store.clearStore()

  if (!deckText.value.trim()) {
    error.value = 'Please paste a deck list.'
    return
  }

  loading.value = true

  try {
    const response = await fetch('/api/deck-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck_text: deckText.value })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch cards')
    }

    // This updates the store and saves to sessionStorage
    store.setCollection(data.cards)
    
    // Automatically navigate onward to the scoring grid view
    router.push('/tools/bulk-deck-builder/possible-commanders')

  } catch (err: any) {
    error.value = err.message || 'Something went wrong fetching cards'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container">
    <h1>Inspect Deck JSON Objects</h1>
    <p class="description">
      Paste your collection to rank viable Commanders. Once analyzed, you'll be moved into your workspace grid.
    </p>

    <DeckInput v-model="deckText" placeholder="Paste your collection deck list here..." />

    <button class="fetch-button" @click="fetchDeckCards" :disabled="loading">
      {{ loading ? 'Analyzing Collection...' : 'Analyze Collection' }}
    </button>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped src="./BulkDeckAnalysis.css"></style>