<script setup lang="ts">
import CardFaceViewer from './CardFaceViewer.vue'
import CardPriceBadges from './CardPriceBadges.vue'
import FavouriteButton from './FavouriteButton.vue'
import type { GameplayCard } from '@/types/gameplayCard'
defineProps<{ cards: GameplayCard[]; confirmRemoval?: boolean }>()
defineEmits<{ changed: [oracleId: string] }>()
function ownershipCollections(card: GameplayCard) {
  const namesById = new Map<number, string>()

  for (const source of card.ownership_sources ?? []) {
    if (source.collection_name) {
      namesById.set(source.collection_id, source.collection_name)
    }
  }

  return Array.from(namesById, ([id, name]) => ({ id, name })).sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

</script>
<template>
    <div class="card-grid">
      <article
        v-for="card in cards"
        :key="card.oracle_id"
        class="card"
      >
        <div class="card-img-wrapper">
          <router-link class="art-link" :to="{ name: 'card-detail', params: { id: card.oracle_id } }" :aria-label="`View ${card.name} details`" />
          <CardFaceViewer
            :card="card"
            image-size="large"
            :show-flip-control="true"
            :interactive="true"
          />
        </div>

        <div class="card-info">
          <h3>{{ card.name }}</h3>
          <div class="card-price-badges">
            <span class="cmc-badge">CMC {{ card.cmc }}</span>
            <CardPriceBadges
              :usd-price="card.lowest_price_usd"
              :draco-price="card.dracostore_price_cop"
              :vault-price="card.vaultstore_price_cop"
            />
          </div>
          <FavouriteButton :oracle-id="card.oracle_id" :card-name="card.name" :confirm-removal="confirmRemoval" @changed="$emit('changed', card.oracle_id)" />
          <slot name="card-extra" :card="card" />
          <div v-if="card.owned_amount" class="ownership-pills">
            <span class="metadata-pill ownership">Owned {{ card.owned_amount }}x</span>
            <span
              v-for="collection in ownershipCollections(card)"
              :key="`collection-${card.oracle_id}-${collection.id}`"
              class="metadata-pill ownership"
            >
              {{ collection.name }}
            </span>
          </div>
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
      </article>
    </div>
</template>
<style scoped>
/* Card Catalog Grid */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;
}

.card {
  text-decoration: none;
  color: inherit;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-lg);
  border-color: var(--surface-border-light);
}

.card-img-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 0.714 / 1;
  background: #090d16;
  overflow: hidden;
}

.card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.img-missing {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 0.85rem;
  color: var(--text-dark);
}

.card-info {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-grow: 1;
}

.card-info h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-light);
  line-height: 1.3;
}

.cmc-badge {
  align-self: flex-start;
  background: var(--surface-border);
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid var(--surface-border-light);
}

.card-price-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.price-badge {
  align-self: flex-start;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid var(--surface-border-light);
}

.scryfall-price {
  color: #b9e6ff;
  background: rgba(56, 189, 248, 0.12);
  border-color: var(--accent-electric-border);
}

.draco-price {
  color: #f7d28d;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.35);
}


.ownership-pills,
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

.metadata-pill.ownership {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.28);
}

.art-link { position: absolute; inset: 0; z-index: 1; }
.art-link:focus-visible { outline: 3px solid var(--accent-electric); outline-offset: -3px; }
.card-img-wrapper :deep(.flip-button) { z-index: 2; }
.card-img-wrapper :deep(.face-image) { object-fit: contain; }
</style>
