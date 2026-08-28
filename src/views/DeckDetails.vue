<script setup lang="ts">
import { ref } from 'vue'
import DeckInput from '../components/DeckInput.vue' 

const deckText = ref('')
const resultText = ref('')
const loading = ref(false)
const error = ref('')
const warnings = ref<string[]>([])

async function analyzeDeck() {
  error.value = ''
  resultText.value = ''
  warnings.value = []

  if (!deckText.value.trim()) {
    error.value = 'Please paste a deck list.'
    return
  }

  loading.value = true

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deck_text: deckText.value
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Request failed')
    }

    resultText.value = data.result
    warnings.value = Array.isArray(data.warnings) ? data.warnings : []

  } catch (err: any) {
    error.value = err.message || 'Something went wrong'
  } finally {
    loading.value = false
  }
}

function downloadResult() {
  const blob = new Blob(
    [resultText.value],
    { type: 'text/plain;charset=utf-8' }
  )

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'deck_details.txt'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="container">
    <h1>Deck Analyzer (LLM Context)</h1>

    <p class="description">
      Paste an exported deck list from Archidekt or similar sites to generate a detailed
      deck document using Scryfall data. 
      This will return a .txt file with the details of all the cards, you can use
      this data in ChatGPT or similar tools so that the LLM has full card compilation contexts.
    </p>

    <DeckInput v-model="deckText" />

    <button
      class="analyze-button"
      @click="analyzeDeck"
      :disabled="loading"
    >
      {{ loading ? 'Processing...' : 'Get Card Details' }}
    </button>

    <p
      v-if="error"
      class="error"
    >
      {{ error }}
    </p>

    <div
      v-if="warnings.length"
      class="warnings"
      role="status"
    >
      <p>Some entries were adjusted or skipped:</p>
      <ul>
        <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
      </ul>
    </div>

    <div
      v-if="resultText"
      class="result-section"
    >
      <div class="result-header">
        <h2>Generated Result</h2>

        <button
          class="download-button"
          @click="downloadResult"
        >
          Download TXT
        </button>
      </div>

      <textarea
        class="result-output"
        :value="resultText"
        readonly
      />
    </div>
  </div>
</template>

<style scoped src="./DeckDetails.css"></style>
