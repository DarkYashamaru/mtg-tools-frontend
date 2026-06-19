<script setup lang="ts">
// No extra state setup is required right now since router-link handles the navigation!
</script>

<template>
  <div class="landing-container">
    <header class="hero-section">
      <h1>MTG Deck Toolkit</h1>
      <p class="subtitle">
        Select a tool below to analyze your Magic: The Gathering deck lists or extract structured card data.
      </p>
    </header>

    <main class="tools-grid">
      <router-link to="/tools/deck-details" class="tool-card">
        <div class="card-content">
          <h2>Deck Analyzer (LLM Context)</h2>
          <p>
            Paste your deck list to cross-reference Scryfall data and compile a dense text file perfect for chatgpt prompt engineering.
          </p>
          <span class="action-text">Launch Tool &rarr;</span>
        </div>
      </router-link>

      <router-link to="/tools/bulk-deck-builder" class="tool-card alternative-theme">
        <div class="card-content">
          <h2>Bulk Deck Builder (Experimental)</h2>
          <p>
            Paste your full mtg collection and get insights into what commander decks could be created from it.
          </p>
          <span class="action-text">Launch Extractor &rarr;</span>
        </div>
      </router-link>

      <router-link to="/tools/advanced-search" class="tool-card">
        <div class="card-content">
          <h2>Advanced Search</h2>
          <p>
            Find cards instantly using specific mechanics, color identities, tags, and custom text parameters.
          </p>
          <span class="action-text">Launch Search &rarr;</span>
        </div>
      </router-link>
    </main>
  </div>
</template>

<style scoped src="./Landing.css"></style>