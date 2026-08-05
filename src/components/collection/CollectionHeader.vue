<script setup lang="ts">
import type { CollectionRecord } from './types'

interface Props {
  collection: CollectionRecord
  showCommanderBuilderAction?: boolean
}

withDefaults(defineProps<Props>(), {
  showCommanderBuilderAction: false,
})
defineEmits<{
  createCommanderDeck: []
}>()

function collectionSubtitle(collection: CollectionRecord) {
  const deckType = collection.deck_type.toLowerCase()

  if (deckType === 'commander') {
    return collection.commander_name
      ? `Commander: ${collection.commander_name}`
      : 'Commander deck'
  }

  if (deckType === 'standard') {
    return 'Standard deck'
  }

  return 'Binder collection'
}
</script>

<template>
  <header
    class="collection-header"
    :class="{
      'has-art': !!collection.commander_image_uri && collection.deck_type.toLowerCase() === 'commander',
    }"
  >
    <img
      v-if="collection.commander_image_uri && collection.deck_type.toLowerCase() === 'commander'"
      :src="collection.commander_image_uri"
      :alt="collection.commander_name || collection.name"
      class="header-art"
      loading="lazy"
    >

    <div class="header-overlay"></div>

    <div class="header-copy">
      <span class="eyebrow">{{ collection.deck_type }}</span>
      <h1>{{ collection.name }}</h1>
      <p class="subtitle">{{ collectionSubtitle(collection) }}</p>

      <div class="meta-row">
        <span class="meta-pill">{{ collection.item_count }} cards</span>
        <span v-if="collection.commander_name" class="meta-pill commander-pill">{{ collection.commander_name }}</span>
      </div>

      <div v-if="showCommanderBuilderAction" class="action-row">
        <button class="primary-action" type="button" @click="$emit('createCommanderDeck')">
          Create commander deck from collection
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.collection-header {
  position: relative;
  overflow: hidden;
  padding: 28px;
  border-radius: 28px;
  border: 1px solid var(--surface-border-light);
  background:
    linear-gradient(135deg, rgba(56, 189, 248, 0.16), rgba(15, 23, 42, 0.96)),
    var(--surface-card);
  box-shadow: var(--shadow-lg);
  min-height: 210px;
}

.header-art {
  position: absolute;
  inset: -5%;
  width: 110%;
  height: 110%;
  object-fit: cover;
  filter: blur(22px) saturate(0.9);
  opacity: 0.34;
  transform: scale(1.08);
}

.header-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(9, 13, 22, 0.34), rgba(9, 13, 22, 0.88)),
    linear-gradient(90deg, rgba(9, 13, 22, 0.96), rgba(9, 13, 22, 0.54));
}

.header-copy {
  position: relative;
  z-index: 1;
  max-width: 720px;
}

.eyebrow {
  display: inline-block;
  margin-bottom: 10px;
  color: var(--accent-electric);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: var(--text-light);
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.04;
}

.subtitle {
  margin: 10px 0 0;
  color: var(--text-main);
  font-size: 1rem;
  line-height: 1.5;
}

.meta-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.action-row {
  margin-top: 18px;
}

.meta-pill {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.72);
  color: var(--text-main);
  font-size: 0.88rem;
  font-weight: 700;
}

.commander-pill {
  border-color: var(--accent-electric-border);
  color: var(--accent-electric);
}

.primary-action {
  padding: 12px 16px;
  border: none;
  border-radius: 14px;
  background: var(--accent-electric);
  color: #07121a;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
}
</style>
