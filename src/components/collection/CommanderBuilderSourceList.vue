<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import type {
  CollectionCardContextMenuPayload,
  CollectionItem,
} from './types'

interface Props {
  title: string
  eyebrow?: string
  description?: string
  items: CollectionItem[]
  totalItems: number
  hasMore: boolean
  isLoading?: boolean
  loadError?: string
  existingOracleIds?: string[]
  primaryActionDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  eyebrow: '',
  description: '',
  isLoading: false,
  loadError: '',
  existingOracleIds: () => [],
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
const LOAD_MORE_THRESHOLD = 520

const listBody = ref<HTMLElement | null>(null)

const startIndex = ref(0)
const endIndex = ref(0)

const loadedCardCount = computed(
  () => props.items.length,
)

const existingOracleIdSet = computed(
  () => new Set(props.existingOracleIds),
)

const visibleItems = computed(
  () =>
    props.items.slice(
      startIndex.value,
      endIndex.value,
    ),
)

const virtualHeight = computed(
  () =>
    `${props.items.length * ROW_HEIGHT}px`,
)

/* -------------------------------------------------------------------------- */
/* Scroll anchoring                                                           */
/* -------------------------------------------------------------------------- */

interface ScrollAnchor {
  rowKey: string
  viewportTop: number
  fallbackScrollY: number
}

let pendingScrollAnchor: ScrollAnchor | null = null
let restoreRequest = 0

function itemKey(item: CollectionItem) {
  return String(item.id)
}

/**
 * Find a currently rendered virtual row without relying on CSS escaping
 * for arbitrary IDs.
 */
function findRenderedRow(
  rowKey: string,
): HTMLElement | null {
  const body = listBody.value

  if (!body) {
    return null
  }

  const rows =
    body.querySelectorAll<HTMLElement>(
      '.table-row',
    )

  for (const row of rows) {
    if (row.dataset.rowKey === rowKey) {
      return row
    }
  }

  return null
}

/**
 * Before an action that may modify the source list or page geometry,
 * remember the position of a stable visible row.
 *
 * Prefer a row other than the one being modified, because the acted-on
 * card may disappear from the source results.
 */
function captureScrollAnchor(
  actedOnItem: CollectionItem,
) {
  const body = listBody.value

  if (!body) {
    pendingScrollAnchor = {
      rowKey: itemKey(actedOnItem),
      viewportTop: 0,
      fallbackScrollY: window.scrollY,
    }

    return
  }

  const actedOnKey = itemKey(actedOnItem)

  const renderedRows = Array.from(
    body.querySelectorAll<HTMLElement>(
      '.table-row',
    ),
  )

  const visibleRows = renderedRows
    .map((row) => ({
      row,
      rect: row.getBoundingClientRect(),
    }))
    .filter(
      ({ rect }) =>
        rect.bottom > 0 &&
        rect.top < window.innerHeight,
    )
    .sort(
      (a, b) =>
        a.rect.top - b.rect.top,
    )

  /**
   * Prefer the first visible row that isn't the card being changed.
   * This gives us a stable reference even if the clicked card is removed
   * from the list by the parent.
   */
  const anchor =
    visibleRows.find(
      ({ row }) =>
        row.dataset.rowKey !== actedOnKey,
    ) ??
    visibleRows[0]

  if (!anchor) {
    pendingScrollAnchor = {
      rowKey: actedOnKey,
      viewportTop: 0,
      fallbackScrollY: window.scrollY,
    }

    return
  }

  pendingScrollAnchor = {
    rowKey:
      anchor.row.dataset.rowKey ??
      actedOnKey,

    viewportTop:
      anchor.rect.top,

    fallbackScrollY:
      window.scrollY,
  }
}

async function restoreScrollAnchor() {
  if (!pendingScrollAnchor) {
    return
  }

  const requestId = ++restoreRequest
  const anchor = pendingScrollAnchor

  /**
   * Let Vue apply the parent updates first.
   */
  await nextTick()

  if (requestId !== restoreRequest) {
    return
  }

  updateVisibleRows()

  /**
   * updateVisibleRows can alter the virtual slice, so wait for those
   * rows to actually render as well.
   */
  await nextTick()

  if (requestId !== restoreRequest) {
    return
  }

  const row =
    findRenderedRow(anchor.rowKey)

  if (row) {
    const newTop =
      row.getBoundingClientRect().top

    const delta =
      newTop - anchor.viewportTop

    if (Math.abs(delta) > 0.5) {
      window.scrollBy({
        top: delta,
        left: 0,
        behavior: 'auto',
      })
    }
  } else {
    /**
     * The anchor itself disappeared.
     *
     * Falling back to the previous document position is still less
     * disorienting than allowing an arbitrary layout jump.
     */
    window.scrollTo({
      top: anchor.fallbackScrollY,
      left: 0,
      behavior: 'auto',
    })
  }

  pendingScrollAnchor = null

  await nextTick()

  updateVisibleRows()
}

/* -------------------------------------------------------------------------- */
/* Card state                                                                 */
/* -------------------------------------------------------------------------- */

function formatScore(
  item: CollectionItem,
) {
  return (
    item.commander_support_score ??
    '—'
  )
}

function isAlreadyInDeck(
  item: CollectionItem,
) {
  return Boolean(
    item.oracle_id &&
      existingOracleIdSet.value.has(
        item.oracle_id,
      ),
  )
}

function isPrimaryActionDisabled(
  item: CollectionItem,
) {
  return (
    props.primaryActionDisabled ||
    isAlreadyInDeck(item)
  )
}

function primaryActionLabel(
  item: CollectionItem,
) {
  return isAlreadyInDeck(item)
    ? 'In Deck'
    : 'Add to Deck'
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

function handlePrimaryAction(
  item: CollectionItem,
) {
  if (isPrimaryActionDisabled(item)) {
    return
  }

  /**
   * Capture BEFORE emitting because the parent may immediately start
   * updating deck/source state.
   */
  captureScrollAnchor(item)

  emit('primaryAction', item)
}

function openContextMenu(
  event: MouseEvent,
  item: CollectionItem,
) {
  emit('contextMenu', {
    item,
    x: event.clientX,
    y: event.clientY,
  })
}

/* -------------------------------------------------------------------------- */
/* Virtualization                                                             */
/* -------------------------------------------------------------------------- */

function updateVisibleRows() {
  const body = listBody.value

  if (!body) {
    return
  }

  const rect =
    body.getBoundingClientRect()

  const scrolledPastTop =
    Math.max(0, -rect.top)

  const first = Math.max(
    0,
    Math.floor(
      scrolledPastTop / ROW_HEIGHT,
    ) - OVERSCAN,
  )

  const visibleCount =
    Math.ceil(
      window.innerHeight /
        ROW_HEIGHT,
    ) +
    OVERSCAN * 2

  startIndex.value = first

  endIndex.value = Math.min(
    props.items.length,
    first + visibleCount,
  )

  if (
    props.hasMore &&
    !props.isLoading &&
    rect.bottom <
      window.innerHeight +
        LOAD_MORE_THRESHOLD
  ) {
    emit('loadMore')
  }
}

function rowStyle(
  index: number,
) {
  return {
    transform:
      `translateY(${(startIndex.value + index) * ROW_HEIGHT}px)`,
  }
}

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

onMounted(() => {
  window.addEventListener(
    'scroll',
    updateVisibleRows,
    {
      passive: true,
      capture: true,
    },
  )

  window.addEventListener(
    'resize',
    updateVisibleRows,
  )

  void nextTick(
    updateVisibleRows,
  )
})

onBeforeUnmount(() => {
  restoreRequest += 1

  window.removeEventListener(
    'scroll',
    updateVisibleRows,
    true,
  )

  window.removeEventListener(
    'resize',
    updateVisibleRows,
  )
})

/* -------------------------------------------------------------------------- */
/* Watchers                                                                   */
/* -------------------------------------------------------------------------- */

watch(
  () => [
    props.items.length,
    props.hasMore,
    props.isLoading,
  ],
  () => {
    void nextTick(
      updateVisibleRows,
    )
  },
)

/**
 * Either of these can change after Add to Deck:
 *
 * - the item remains visible but becomes "In Deck"
 * - the parent removes that card from the source result entirely
 *
 * Restore the visual anchor in either case.
 */
watch(
  [
    () => props.items,
    () => props.existingOracleIds,
  ],
  () => {
    if (pendingScrollAnchor) {
      void restoreScrollAnchor()
    }
  },
  {
    flush: 'post',
  },
)
</script>

<template>
  <section class="source-list-shell">
    <header class="source-list-header">
      <p
        v-if="eyebrow"
        class="source-list-eyebrow"
      >
        {{ eyebrow }}
      </p>

      <h2>
        {{ title }}
      </h2>

      <p>
        {{ loadedCardCount }}
        of
        {{ totalItems }}
        cards

        <span v-if="description">
          · {{ description }}
        </span>
      </p>
    </header>

    <div
      v-if="
        items.length === 0 &&
        !isLoading &&
        !loadError
      "
      class="empty-list"
    >
      No cards in this section.
    </div>

    <div
      v-else
      class="table-wrap"
      @mouseleave="
        emit('hoverItem', null)
      "
    >
      <div class="table-head">
        <span>Score</span>
        <span>Card</span>
        <span class="action-heading">
          Add
        </span>
      </div>

      <div
        ref="listBody"
        class="table-body"
        :style="{
          height: virtualHeight,
        }"
      >
        <div
          v-for="(item, index) in visibleItems"
          :key="item.id"
          class="table-row"
          :data-row-key="itemKey(item)"
          :style="rowStyle(index)"
          tabindex="0"
          @mouseenter="
            emit('hoverItem', item)
          "
          @focus="
            emit('hoverItem', item)
          "
          @blur="
            emit('hoverItem', null)
          "
          @click="
            emit('cardClick', item)
          "
          @contextmenu.prevent="
            openContextMenu(
              $event,
              item,
            )
          "
        >
          <strong class="score-value">
            {{ formatScore(item) }}
          </strong>

          <strong
            class="card-name"
            :title="
              item.name ||
              'Unknown Card'
            "
          >
            {{
              item.name ||
              'Unknown Card'
            }}
          </strong>

          <button
            class="add-button"
            :class="{
              'is-in-deck':
                isAlreadyInDeck(item),
            }"
            type="button"
            :disabled="
              isPrimaryActionDisabled(
                item,
              )
            "
            @click.stop="
              handlePrimaryAction(item)
            "
          >
            {{
              primaryActionLabel(item)
            }}
          </button>
        </div>
      </div>
    </div>

    <p
      v-if="isLoading"
      class="load-status"
    >
      Loading more cards…
    </p>

    <button
      v-else-if="loadError"
      class="retry-button"
      type="button"
      @click="emit('loadMore')"
    >
      Retry loading cards
    </button>

    <p
      v-else-if="
        !hasMore &&
        items.length
      "
      class="load-status"
    >
      All {{ totalItems }} cards loaded.
    </p>
  </section>
</template>

<style scoped>
.source-list-shell {
  min-width: 0;

  display: grid;
  gap: 16px;

  padding: 22px;

  border: 1px solid var(--surface-border-light);
  border-radius: 24px;

  background:
    linear-gradient(
      180deg,
      rgba(148, 163, 184, 0.04),
      rgba(15, 23, 42, 0.98)
    ),
    var(--surface-card);

  box-sizing: border-box;
}

.source-list-header {
  min-width: 0;
}

.source-list-header h2 {
  margin: 0;

  color: var(--text-light);

  font-size: 1.25rem;
}

.source-list-header p {
  margin: 4px 0 0;

  color: var(--text-muted);
}

.source-list-eyebrow {
  margin: 0 0 6px !important;

  color: var(--accent-electric) !important;

  font-size: 0.72rem;
  font-weight: 800;

  letter-spacing: 0.12em;

  text-transform: uppercase;
}

.empty-list {
  padding: 18px;

  border: 1px dashed var(--surface-border-light);
  border-radius: 16px;

  color: var(--text-muted);
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

.table-wrap {
  min-width: 0;

  overflow: hidden;

  border: 1px solid var(--surface-border-light);
  border-radius: 18px;
}

.table-head,
.table-row {
  width: 100%;
  min-width: 0;

  display: grid;

  /*
   * The action column NEVER changes size based on its label.
   */
  grid-template-columns:
    80px
    minmax(0, 1fr)
    120px;

  gap: 12px;

  align-items: center;

  padding-inline: 14px;

  box-sizing: border-box;
}

.table-head {
  height: 44px;

  background: rgba(15, 23, 42, 0.92);

  color: var(--text-muted);

  font-size: 0.78rem;
  font-weight: 800;

  letter-spacing: 0.06em;

  text-transform: uppercase;
}

.action-heading {
  text-align: center;
}

.table-body {
  position: relative;

  min-width: 0;
  min-height: 50px;

  /*
   * We handle anchoring ourselves because this is a virtualized list.
   * Browser scroll anchoring can otherwise fight the transforms.
   */
  overflow-anchor: none;
}

.table-row {
  position: absolute;

  inset-inline: 0;

  /*
   * This MUST match ROW_HEIGHT exactly.
   *
   * border-box guarantees that the top border is included in the 50px
   * rather than turning every virtual row into 51px.
   */
  height: 50px;

  border-top:
    1px solid
    rgba(148, 163, 184, 0.08);

  background:
    rgba(17, 24, 39, 0.84);

  cursor: pointer;

  will-change: transform;
}

.table-row:hover,
.table-row:focus-visible {
  background: var(--surface-hover);

  outline: none;
}

.score-value {
  color: var(--accent-electric);

  font-variant-numeric:
    tabular-nums;
}

.card-name {
  min-width: 0;

  overflow: hidden;

  color: var(--text-light);

  text-overflow: ellipsis;
  white-space: nowrap;
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

.add-button,
.retry-button {
  padding: 8px 10px;

  border: 1px solid var(--accent-electric-border);
  border-radius: 8px;

  background: var(--accent-electric-dim);

  color: var(--accent-electric);

  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;

  cursor: pointer;

  box-sizing: border-box;
}

.add-button {
  /*
   * Stable dimensions are important in a virtualized list.
   *
   * "Add to Deck" and "In Deck" occupy exactly the same physical area.
   */
  width: 100%;
  min-width: 0;
  height: 34px;

  display: flex;
  align-items: center;
  justify-content: center;

  padding-inline: 8px;

  white-space: nowrap;
}

.add-button:hover:not(:disabled),
.retry-button:hover {
  background:
    rgba(56, 189, 248, 0.18);
}

.add-button:disabled {
  cursor: not-allowed;

  opacity: 0.55;
}

.add-button.is-in-deck {
  /*
   * Keep dimensions/borders identical.
   * Only visual emphasis changes.
   */
  background:
    rgba(148, 163, 184, 0.08);

  border-color:
    var(--surface-border-light);

  color: var(--text-muted);

  opacity: 1;
}

.load-status {
  margin: 0;

  color: var(--text-muted);

  font-size: 0.84rem;
}

.retry-button {
  justify-self: start;
}

/* -------------------------------------------------------------------------- */
/* Responsive                                                                 */
/* -------------------------------------------------------------------------- */

@media (max-width: 640px) {
  .source-list-shell {
    padding: 16px;
  }

  .table-head,
  .table-row {
    grid-template-columns:
      56px
      minmax(0, 1fr)
      100px;

    gap: 8px;

    padding-inline: 10px;
  }

  .add-button {
    padding-inline: 5px;

    font-size: 0.76rem;
  }
}
</style>