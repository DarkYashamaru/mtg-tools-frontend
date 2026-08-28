<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CollectionCardContextMenuPayload, CollectionItem } from './types'

interface Props {
  title: string
  eyebrow?: string
  description?: string
  items: CollectionItem[]
  totalItems: number
  hasMore: boolean
  isLoading?: boolean
  loadError?: string
  primaryActionDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  eyebrow: '',
  description: '',
  isLoading: false,
  loadError: '',
  primaryActionDisabled: false,
})
const emit = defineEmits<{
  hoverItem: [item: CollectionItem | null]
  contextMenu: [payload: CollectionCardContextMenuPayload]
  cardClick: [item: CollectionItem]
  primaryAction: [item: CollectionItem]
  loadMore: []
}>()

const ROW_HEIGHT = 50
const OVERSCAN = 10
const listBody = ref<HTMLElement | null>(null)
const startIndex = ref(0)
const endIndex = ref(0)
const loadedCardCount = computed(() => props.items.length)
const visibleItems = computed(() => props.items.slice(startIndex.value, endIndex.value))
const virtualHeight = computed(() => `${props.items.length * ROW_HEIGHT}px`)

function formatScore(item: CollectionItem) {
  return item.commander_support_score ?? '—'
}

function openContextMenu(event: MouseEvent, item: CollectionItem) {
  emit('contextMenu', { item, x: event.clientX, y: event.clientY })
}

function updateVisibleRows() {
  const body = listBody.value
  if (!body) return
  const rect = body.getBoundingClientRect()
  const first = Math.max(0, Math.floor(Math.max(0, -rect.top) / ROW_HEIGHT) - OVERSCAN)
  const visibleCount = Math.ceil(window.innerHeight / ROW_HEIGHT) + (OVERSCAN * 2)
  startIndex.value = first
  endIndex.value = Math.min(props.items.length, first + visibleCount)
  if (props.hasMore && !props.isLoading && rect.bottom < window.innerHeight + 520) emit('loadMore')
}

function rowStyle(index: number) {
  return { transform: `translateY(${(startIndex.value + index) * ROW_HEIGHT}px)` }
}

onMounted(() => {
  window.addEventListener('scroll', updateVisibleRows, { passive: true })
  window.addEventListener('resize', updateVisibleRows)
  void nextTick(updateVisibleRows)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateVisibleRows)
  window.removeEventListener('resize', updateVisibleRows)
})
watch(() => [props.items.length, props.hasMore, props.isLoading], () => void nextTick(updateVisibleRows))
</script>

<template>
  <section class="source-list-shell">
    <header class="source-list-header">
      <p v-if="eyebrow" class="source-list-eyebrow">{{ eyebrow }}</p>
      <h2>{{ title }}</h2>
      <p>{{ loadedCardCount }} of {{ totalItems }} cards<span v-if="description"> · {{ description }}</span></p>
    </header>

    <div v-if="items.length === 0 && !isLoading && !loadError" class="empty-list">No cards in this section.</div>

    <div v-else class="table-wrap" @mouseleave="emit('hoverItem', null)">
      <div class="table-head">
        <span>Score</span>
        <span>Card</span>
        <span>Add</span>
      </div>
      <div ref="listBody" class="table-body" :style="{ height: virtualHeight }">
        <div
          v-for="(item, index) in visibleItems"
          :key="item.id"
          class="table-row"
          :style="rowStyle(index)"
          tabindex="0"
          @mouseenter="emit('hoverItem', item)"
          @focus="emit('hoverItem', item)"
          @blur="emit('hoverItem', null)"
          @click="emit('cardClick', item)"
          @contextmenu.prevent="openContextMenu($event, item)"
        >
          <strong class="score-value">{{ formatScore(item) }}</strong>
          <strong class="card-name">{{ item.name || 'Unknown Card' }}</strong>
          <button class="add-button" type="button" :disabled="primaryActionDisabled" @click.stop="emit('primaryAction', item)">
            Add to Deck
          </button>
        </div>
      </div>
    </div>

    <p v-if="isLoading" class="load-status">Loading more cards…</p>
    <button v-else-if="loadError" class="retry-button" type="button" @click="emit('loadMore')">Retry loading cards</button>
    <p v-else-if="!hasMore && items.length" class="load-status">All {{ totalItems }} cards loaded.</p>
  </section>
</template>

<style scoped>
.source-list-shell { display: grid; gap: 16px; padding: 22px; border-radius: 24px; border: 1px solid var(--surface-border-light); background: linear-gradient(180deg, rgba(148, 163, 184, 0.04), rgba(15, 23, 42, 0.98)), var(--surface-card); }
.source-list-header h2 { margin: 0; color: var(--text-light); font-size: 1.25rem; }
.source-list-header p { margin: 4px 0 0; color: var(--text-muted); }
.source-list-eyebrow { margin: 0 0 6px !important; color: var(--accent-electric) !important; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
.empty-list { padding: 18px; border: 1px dashed var(--surface-border-light); border-radius: 16px; color: var(--text-muted); }
.table-wrap { overflow: hidden; border: 1px solid var(--surface-border-light); border-radius: 18px; }
.table-head, .table-row { display: grid; grid-template-columns: 80px minmax(0, 1fr) 120px; gap: 12px; align-items: center; padding: 0 14px; }
.table-head { height: 44px; background: rgba(15, 23, 42, 0.92); color: var(--text-muted); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.table-body { position: relative; min-height: 50px; }
.table-row { position: absolute; inset-inline: 0; height: 50px; border-top: 1px solid rgba(148, 163, 184, 0.08); background: rgba(17, 24, 39, 0.84); cursor: pointer; will-change: transform; }
.table-row:hover, .table-row:focus-visible { background: var(--surface-hover); outline: none; }
.score-value { color: var(--accent-electric); }
.card-name { overflow: hidden; color: var(--text-light); text-overflow: ellipsis; white-space: nowrap; }
.add-button, .retry-button { padding: 8px 10px; border: 1px solid var(--accent-electric-border); border-radius: 8px; background: var(--accent-electric-dim); color: var(--accent-electric); font: inherit; font-size: 0.8rem; font-weight: 800; cursor: pointer; }
.add-button:hover:not(:disabled), .retry-button:hover { background: rgba(56, 189, 248, 0.18); }
.add-button:disabled { cursor: not-allowed; opacity: 0.55; }
.load-status { margin: 0; color: var(--text-muted); font-size: 0.84rem; }
.retry-button { justify-self: start; }
@media (max-width: 640px) { .table-head, .table-row { grid-template-columns: 64px minmax(0, 1fr) 106px; } }
</style>
