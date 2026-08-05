<script setup lang="ts">
import { ref } from 'vue'
import type { CollectionItem } from './types'

interface Props {
  item: CollectionItem
}

defineProps<Props>()

const imageFailed = ref(false)
</script>

<template>
  <article class="card-tile">
    <div class="card-media">
      <img
        v-if="item.image_uri && !imageFailed"
        :src="item.image_uri"
        :alt="item.name || 'Card image'"
        class="card-image"
        loading="lazy"
        @error="imageFailed = true"
      >
      <div v-else class="card-fallback">
        <span>{{ item.name || 'Unknown Card' }}</span>
      </div>

      <span class="quantity-chip">{{ item.amount }}x</span>
    </div>

    <div class="card-copy">
      <strong>{{ item.name || 'Unknown Card' }}</strong>
      <p>{{ item.set_code }} · {{ item.collector_number }}</p>
    </div>
  </article>
</template>

<style scoped>
.card-tile {
  display: grid;
  gap: 12px;
}

.card-media {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.72);
  box-shadow: var(--shadow-md);
}

.card-image,
.card-fallback {
  display: block;
  width: 100%;
  aspect-ratio: 0.71 / 1;
}

.card-image {
  object-fit: cover;
}

.card-fallback {
  display: grid;
  place-items: center;
  padding: 18px;
  color: var(--text-main);
  text-align: center;
  line-height: 1.5;
}

.quantity-chip {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--accent-electric-border);
  background: rgba(9, 13, 22, 0.88);
  color: var(--accent-electric);
  font-size: 0.82rem;
  font-weight: 800;
}

.card-copy strong {
  color: var(--text-light);
  font-size: 0.96rem;
}

.card-copy p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 0.84rem;
}
</style>
