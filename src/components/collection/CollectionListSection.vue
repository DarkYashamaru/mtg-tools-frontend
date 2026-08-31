<script setup lang="ts">
import { computed } from 'vue'
import CardPriceBadges from '@/components/cards/CardPriceBadges.vue'
import type { CollectionCardContextMenuPayload, CollectionItem } from './types'

interface Props {
  title: string
  emptyMessage?: string
  items: CollectionItem[]
  hideSingletonAmount?: boolean
  mutatingItemIds?: Array<string | number>
  eyebrow?: string
  description?: string
  showCardCount?: boolean
  showQuantityActions?: boolean
  primaryActionLabel?: string
  primaryActionDisabled?: boolean
  showScore?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  emptyMessage: 'No cards in this section.',
  hideSingletonAmount: false,
  mutatingItemIds: () => [],
  eyebrow: '',
  description: '',
  showCardCount: true,
  showQuantityActions: true,
  primaryActionLabel: '',
  primaryActionDisabled: false,
  showScore: false,
})
const emit = defineEmits<{
  hoverItem: [item: CollectionItem | null]
  contextMenu: [payload: CollectionCardContextMenuPayload]
  incrementItem: [item: CollectionItem]
  decrementItem: [item: CollectionItem]
  cardClick: [item: CollectionItem]
  primaryAction: [item: CollectionItem]
}>()
const totalCards = computed(() => props.items.reduce((sum, item) => sum + item.amount, 0))

function handleItemEnter(item: CollectionItem) {
  emit('hoverItem', item)
}

function clearHover() {
  emit('hoverItem', null)
}

function showQuantity(item: CollectionItem) {
  return !(props.hideSingletonAmount && item.amount === 1)
}

function openContextMenu(event: MouseEvent, item: CollectionItem) {
  emit('contextMenu', {
    item,
    x: event.clientX,
    y: event.clientY,
  })
}

function isMutating(item: CollectionItem) {
  return props.mutatingItemIds.includes(item.id)
}
</script>

<template>
  <section class="list-section-shell">
    <header class="section-header">
      <div>
        <p v-if="eyebrow" class="section-eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
        <p v-if="showCardCount || description">
          <template v-if="showCardCount">{{ totalCards }} cards</template>
          <template v-if="showCardCount && description"> · </template>
          <template v-if="description">{{ description }}</template>
        </p>
      </div>
    </header>

    <div v-if="items.length === 0" class="empty-section">
      {{ emptyMessage }}
    </div>

    <div v-else class="list-layout">
      <div class="table-wrap" @mouseleave="clearHover()">
        <div class="table-head" :class="{ 'has-score': showScore }">
          <span>Qty</span>
          <span v-if="showScore">Score</span>
          <span>Card</span>
          <span>Set</span>
          <span>No.</span>
          <span>Lang</span>
          <span>Price</span>
          <span>{{ primaryActionLabel || (showQuantityActions ? 'Adjust' : 'Status') }}</span>
        </div>

        <div class="table-body">
          <div
            v-for="item in items"
            :key="item.id"
            class="table-row"
            :class="{ 'has-score': showScore }"
            tabindex="0"
            @mouseenter="handleItemEnter(item)"
            @focus="handleItemEnter(item)"
            @blur="clearHover()"
            @click="emit('cardClick', item)"
            @contextmenu.prevent="openContextMenu($event, item)"
          >
            <span class="qty">{{ showQuantity(item) ? `${item.amount}x` : '' }}</span>
            <strong v-if="showScore" class="score-value">{{ item.commander_support_score ?? '—' }}</strong>
            <strong class="name-text">{{ item.name || 'Unknown Card' }}</strong>
            <span>{{ item.set_code || '—' }}</span>
            <span>{{ item.collector_number || '—' }}</span>
            <span>{{ item.lang || '—' }}</span>
            <CardPriceBadges
              :usd-price="item.gameplay_card?.lowest_price_usd"
              :draco-price="item.gameplay_card?.dracostore_price_cop"
            />
            <div class="row-actions">
              <button
                v-if="primaryActionLabel"
                class="primary-action-button"
                type="button"
                :disabled="primaryActionDisabled"
                @click.stop="emit('primaryAction', item)"
              >
                {{ primaryActionLabel }}
              </button>
              <button
                v-if="showQuantityActions"
                class="quantity-button"
                type="button"
                :disabled="isMutating(item)"
                @click.stop="emit('decrementItem', item)"
              >
                -
              </button>
              <button
                v-if="showQuantityActions"
                class="quantity-button"
                type="button"
                :disabled="isMutating(item)"
                @click.stop="emit('incrementItem', item)"
              >
                +
              </button>
              <span v-if="!showQuantityActions && !primaryActionLabel" class="read-only-label">Read-only</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.list-section-shell {
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid var(--surface-border-light);
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.04), rgba(15, 23, 42, 0.98)),
    var(--surface-card);
}

.section-header h2 {
  margin: 0;
  color: var(--text-light);
  font-size: 1.25rem;
}

.section-eyebrow {
  margin: 0 0 6px;
  color: var(--accent-electric);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.section-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.empty-section {
  padding: 18px;
  border-radius: 16px;
  border: 1px dashed var(--surface-border-light);
  color: var(--text-muted);
}

.table-wrap {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--surface-border-light);
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: 66px minmax(0, 1.5fr) 90px 76px 64px minmax(130px, 1fr) 88px;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
}

.table-head.has-score,
.table-row.has-score {
  grid-template-columns: 58px 64px minmax(0, 1.5fr) 90px 76px 64px minmax(130px, 1fr) 88px;
}

.table-head {
  background: rgba(15, 23, 42, 0.92);
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.table-body {
  display: grid;
}

.table-row {
  border-top: 1px solid rgba(148, 163, 184, 0.08);
  background: rgba(17, 24, 39, 0.84);
  color: var(--text-main);
  cursor: pointer;
}

.table-row:hover,
.table-row:focus-visible {
  background: var(--surface-hover);
  outline: none;
}

.qty,
.score-value {
  color: var(--accent-electric);
  font-weight: 800;
}

.name-text {
  color: var(--text-light);
  font-weight: 700;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
}

.read-only-label {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.primary-action-button,
.quantity-button {
  border: 1px solid var(--surface-border-light);
  border-radius: 8px;
  background: var(--surface-hover);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-weight: 800;
  cursor: pointer;
}

.primary-action-button {
  padding: 7px 10px;
  font-size: 0.78rem;
}

.primary-action-button:hover:not(:disabled) {
  border-color: var(--accent-electric-border);
  background: var(--accent-electric-dim);
  color: var(--accent-electric);
}

.primary-action-button:disabled,
.quantity-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.quantity-button {
  width: 28px;
  height: 28px;
  font-size: 0.95rem;
}

.table-row:hover .name-text,
.table-row:focus-visible .name-text {
  color: var(--accent-electric);
}

@media (max-width: 760px) {
  .table-head,
  .table-row {
    grid-template-columns: 58px minmax(0, 1fr) minmax(120px, 1fr) 76px;
  }

  .table-head.has-score,
  .table-row.has-score {
    grid-template-columns: 50px 54px minmax(0, 1fr) minmax(120px, 1fr) 76px;
  }

  .table-head span:nth-child(4),
  .table-head span:nth-child(5),
  .table-head span:nth-child(6),
  .table-row span:nth-child(4),
  .table-row span:nth-child(5) {
    display: none;
  }
}
</style>
