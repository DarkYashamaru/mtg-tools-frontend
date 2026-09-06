<script setup lang="ts">
import type { CollectionCardContextMenuPayload, CollectionItem } from './types'
import CardPriceBadges from '@/components/cards/CardPriceBadges.vue'
import CardFaceViewer from '@/components/cards/CardFaceViewer.vue'

interface Props {
  item: CollectionItem
  hideSingletonAmount?: boolean
  enforceSingletonQuantities?: boolean
  isMutating?: boolean
  showQuantityActions?: boolean
  primaryActionLabel?: string
  primaryActionDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hideSingletonAmount: false,
  enforceSingletonQuantities: false,
  isMutating: false,
  showQuantityActions: true,
  primaryActionLabel: '',
  primaryActionDisabled: false,
})
const emit = defineEmits<{
  contextMenu: [payload: CollectionCardContextMenuPayload]
  incrementItem: [item: CollectionItem]
  decrementItem: [item: CollectionItem]
  cardClick: [item: CollectionItem]
  primaryAction: [item: CollectionItem]
}>()

function shouldShowQuantity() {
  return !(props.hideSingletonAmount && props.item.amount === 1)
}

function isBasicLand() {
  return props.item.gameplay_card?.faces.some((face) => (
    face.supertypes.includes("Basic") && face.card_types.includes("Land")
  )) ?? false
}

function hasSingletonViolation() {
  return props.enforceSingletonQuantities && props.item.amount > 1 && !isBasicLand()
}

function openContextMenu(event: MouseEvent) {
  emit('contextMenu', {
    item: props.item,
    x: event.clientX,
    y: event.clientY,
  })
}

function incrementItem() {
  emit('incrementItem', props.item)
}

function decrementItem() {
  emit('decrementItem', props.item)
}

function handleCardClick() {
  emit('cardClick', props.item)
}

function triggerPrimaryAction() {
  emit('primaryAction', props.item)
}
</script>

<template>
  <article class="card-tile" @click="handleCardClick" @contextmenu.prevent="openContextMenu">
    <div class="card-media">
      <CardFaceViewer
        :card="props.item.gameplay_card"
        :preview-image-url="props.item.gameplay_card ? null : props.item.image_uri"
        :fallback-name="props.item.name"
        image-size="normal"
        :show-flip-control="true"
        :interactive="true"
        :compact-fallback="true"
      />

    </div>

    <div class="card-copy">
      <strong>{{ props.item.name || 'Unknown Card' }}</strong>
      <p class="printing-meta">
        <span>{{ props.item.set_code || "—" }} · {{ props.item.collector_number || "—" }}</span>
        <span v-if="shouldShowQuantity()" class="quantity-inline" :class="{ violation: hasSingletonViolation() }">{{ props.item.amount }}x</span>
      </p>
      <CardPriceBadges
        :usd-price="props.item.gameplay_card?.lowest_price_usd"
        :draco-price="props.item.gameplay_card?.dracostore_price_cop"
        :vault-price="props.item.gameplay_card?.vaultstore_price_cop"
      />
      <dl v-if="props.item.card_insights?.length" class="card-insights">
        <div v-for="insight in props.item.card_insights" :key="insight.label" class="card-insight">
          <dt>{{ insight.label }}</dt>
          <dd>{{ insight.value }}</dd>
        </div>
      </dl>
      <div
        v-if="props.item.commander_support_score !== undefined || (props.item.commander_support_reasons?.length ?? 0) > 0 || (props.item.score_breakdown?.length ?? 0) > 0"
        class="commander-support-box"
      >
        <div v-if="props.item.commander_support_score !== undefined" class="commander-support-score">
          {{ props.item.score_breakdown?.length ? "Total Score" : "Commander Score" }}: <strong>{{ props.item.commander_support_score }}</strong>
        </div>
        <template v-if="props.item.score_breakdown?.length">
          <div v-for="layer in props.item.score_breakdown" :key="layer.key" class="score-breakdown-layer">
            <strong>{{ layer.label }}: {{ layer.score > 0 ? '+' : '' }}{{ layer.score }}</strong>
            <p v-if="layer.reasons.length" class="commander-support-reasons">
              {{ layer.reasons.map((reason) => `${reason.label} (${reason.points > 0 ? '+' : ''}${reason.points})`).join(' · ') }}
            </p>
          </div>
        </template>
        <p v-else-if="props.item.commander_support_reasons?.length" class="commander-support-reasons">
          {{ props.item.commander_support_reasons.map((reason) => `${reason.label} (${reason.points > 0 ? '+' : ''}${reason.points})`).join(' · ') }}
        </p>
      </div>
      <div v-if="props.showQuantityActions" class="quantity-actions">
        <button
          class="quantity-button"
          type="button"
          :disabled="props.isMutating"
          @click.stop="decrementItem"
        >
          -
        </button>
        <button
          class="quantity-button"
          type="button"
          :disabled="props.isMutating"
          @click.stop="incrementItem"
        >
          +
        </button>
      </div>

      <button
        v-if="props.primaryActionLabel"
        class="primary-action-button"
        type="button"
        :disabled="props.primaryActionDisabled"
        @click.stop="triggerPrimaryAction"
      >
        {{ props.primaryActionLabel }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.card-tile {
  display: grid;
  grid-template-rows: auto min-content;
  align-self: start;
  align-content: start;
  gap: 12px;
}

.card-media {
  position: relative;
  width: 100%;
  aspect-ratio: 0.71 / 1;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.72);
  box-shadow: var(--shadow-md);
}

.card-media :deep(.face-viewer),
.card-media :deep(.face-image),
.card-media :deep(.face-fallback) {
  display: block;
  width: 100%;
  height: 100%;
}

.card-media :deep(.face-image) {
  object-fit: contain !important;
}

.printing-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.quantity-inline {
  color: var(--accent-electric);
  font-weight: 800;
}

.quantity-inline.violation {
  color: var(--error-text, #fb7185);
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

.card-insights {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--surface-border-light);
  border-radius: 12px;
  background: rgba(8, 12, 20, 0.76);
}

.card-insight {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.card-insight dt {
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

.card-insight dd {
  margin: 0;
  color: var(--accent-electric);
  font-size: 0.95rem;
  font-weight: 800;
  white-space: nowrap;
}

.commander-support-box {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(125, 211, 252, 0.18);
  background: rgba(8, 12, 20, 0.76);
}

.commander-support-score {
  color: var(--text-main);
  font-size: 0.82rem;
  font-weight: 700;
}

.commander-support-score strong {
  color: var(--accent-electric);
}

.score-breakdown-layer {
  margin-top: 6px;
  font-size: 0.78rem;
}

.score-breakdown-layer strong {
  color: var(--text-main);
}

.commander-support-reasons {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}

.quantity-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.quantity-button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--surface-border-light);
  border-radius: 10px;
  background: var(--surface-hover);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
}

.quantity-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-action-button {
  width: 100%;
  margin-top: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: var(--accent-electric);
  color: #07121a;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
}

.primary-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
