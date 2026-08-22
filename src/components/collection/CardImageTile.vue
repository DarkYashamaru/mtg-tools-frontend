<script setup lang="ts">
import type { CollectionCardContextMenuPayload, CollectionItem } from './types'
import CardFaceViewer from '@/components/cards/CardFaceViewer.vue'

interface Props {
  item: CollectionItem
  hideSingletonAmount?: boolean
  isMutating?: boolean
  showQuantityActions?: boolean
  primaryActionLabel?: string
  primaryActionDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hideSingletonAmount: false,
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
        :preview-image-url="props.item.image_uri"
        :fallback-name="props.item.name"
        image-size="normal"
        :compact-fallback="true"
      />

      <span v-if="shouldShowQuantity()" class="quantity-chip">{{ props.item.amount }}x</span>
    </div>

    <div class="card-copy">
      <strong>{{ props.item.name || 'Unknown Card' }}</strong>
      <p>{{ props.item.set_code }} · {{ props.item.collector_number }}</p>
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

.card-media :deep(img),
.card-media :deep(.face-fallback) {
  display: block;
  width: 100%;
  aspect-ratio: 0.71 / 1;
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
