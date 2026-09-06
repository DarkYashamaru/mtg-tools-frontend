<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CollectionRecord } from './types'
import { activeDeckItems, calculateManaColorMetrics } from './manaMetrics'

interface Props {
  collection: CollectionRecord
  collapsible?: boolean
  initiallyCollapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsible: false,
  initiallyCollapsed: false,
})
const isCollapsed = ref(props.collapsible && props.initiallyCollapsed)

type ManaBucket = {
  label: string
  count: number
}

type CategoryBucket = {
  name: string
  count: number
}

const deckItems = computed(() => activeDeckItems(props.collection.items))
const nonLandItems = computed(() => deckItems.value.filter((item) => {
  const cardTypes = item.card_types ?? []
  return !cardTypes.some((type) => type.toLowerCase() === 'land')
}))

const manaBuckets = computed<ManaBucket[]>(() => {
  const buckets = new Map<string, number>([
    ['0', 0],
    ['1', 0],
    ['2', 0],
    ['3', 0],
    ['4', 0],
    ['5', 0],
    ['6', 0],
    ['7', 0],
    ['8+', 0],
  ])

  for (const item of nonLandItems.value) {
    const cmc = typeof item.cmc === 'number' && Number.isFinite(item.cmc) ? item.cmc : 0
    const bucketLabel = cmc >= 8 ? '8+' : String(Math.max(0, Math.floor(cmc)))
    buckets.set(bucketLabel, (buckets.get(bucketLabel) ?? 0) + item.amount)
  }

  return Array.from(buckets, ([label, count]) => ({ label, count }))
})

const totalCards = computed(() => nonLandItems.value.reduce((sum, item) => sum + item.amount, 0))
const totalManaValue = computed(() => nonLandItems.value.reduce((sum, item) => {
  const cmc = typeof item.cmc === 'number' && Number.isFinite(item.cmc) ? item.cmc : 0
  return sum + (cmc * item.amount)
}, 0))
const averageManaValue = computed(() => (
  totalCards.value > 0 ? totalManaValue.value / totalCards.value : 0
))
const maxBucketCount = computed(() => Math.max(1, ...manaBuckets.value.map((bucket) => bucket.count)))
const categoryBuckets = computed<CategoryBucket[]>(() => {
  const counts = new Map<string, number>()

  for (const item of deckItems.value) {
    if (!item.categories || item.categories.length === 0) {
      counts.set('Uncategorized', (counts.get('Uncategorized') ?? 0) + item.amount)
      continue
    }

    for (const category of item.categories) {
      const name = category.name?.trim() || 'Uncategorized'
      counts.set(name, (counts.get(name) ?? 0) + item.amount)
    }
  }

  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
})
const maxCategoryCount = computed(() => Math.max(1, ...categoryBuckets.value.map((bucket) => bucket.count)))
const manaColorMetrics = computed(() => calculateManaColorMetrics(props.collection.items))
const maxManaColorCount = computed(() => Math.max(
  1,
  ...manaColorMetrics.value.flatMap((metric) => [metric.manaCost, metric.sources]),
))

function barWidth(count: number) {
  return `${Math.max((count / maxBucketCount.value) * 100, count > 0 ? 6 : 0)}%`
}

function categoryBarWidth(count: number) {
  return `${Math.max((count / maxCategoryCount.value) * 100, count > 0 ? 6 : 0)}%`
}

function manaColorBarWidth(count: number) {
  return `${Math.max((count / maxManaColorCount.value) * 100, count > 0 ? 4 : 0)}%`
}

function formatManaValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}
</script>

<template>
  <section class="curve-card">
    <header class="curve-header">
      <div>
        <span class="eyebrow">Deck Metrics</span>
        <h2>Deck Breakdown</h2>
      </div>

      <div class="header-actions">
        <div class="summary-grid">
        <div class="summary-pill">
          <span class="summary-label">Avg Mana Value</span>
          <strong>{{ averageManaValue.toFixed(2) }}</strong>
        </div>
        <div class="summary-pill">
          <span class="summary-label">Total Mana Value</span>
          <strong>{{ formatManaValue(totalManaValue) }}</strong>
        </div>
        <div class="summary-pill">
          <span class="summary-label">Nonland Cards</span>
          <strong>{{ totalCards }}</strong>
        </div>
      </div>
        <button
          v-if="collapsible"
          class="curve-toggle"
          type="button"
          :aria-expanded="!isCollapsed"
          aria-controls="deck-breakdown-charts"
          @click="isCollapsed = !isCollapsed"
        >
          {{ isCollapsed ? 'Show charts' : 'Hide charts' }}
        </button>
      </div>
    </header>

    <div v-if="!isCollapsed" id="deck-breakdown-charts" class="chart-grid">
      <section class="chart-panel">
        <header class="panel-header">
          <h3>Mana Curve</h3>
          <p>Mainboard + Commander · lands excluded</p>
        </header>

        <div class="chart-stack">
          <div
            v-for="bucket in manaBuckets"
            :key="bucket.label"
            class="curve-row"
          >
            <span class="bucket-label">{{ bucket.label }}</span>
            <div class="bar-track">
              <div class="bar-fill mana-fill" :style="{ width: barWidth(bucket.count) }"></div>
            </div>
            <span class="count-label">{{ bucket.count }}</span>
          </div>
        </div>
      </section>

      <section class="chart-panel">
        <header class="panel-header">
          <h3>Cards by Category</h3>
          <p>Mainboard + Commander · all assigned categories</p>
        </header>

        <div class="chart-stack">
          <div
            v-for="bucket in categoryBuckets"
            :key="bucket.name"
            class="category-row"
          >
            <span class="category-label">{{ bucket.name }}</span>
            <div class="bar-track">
              <div class="bar-fill category-fill" :style="{ width: categoryBarWidth(bucket.count) }"></div>
            </div>
            <span class="count-label">{{ bucket.count }}</span>
          </div>
        </div>
      </section>

      <section class="chart-panel mana-balance-panel">
        <header class="panel-header">
          <h3>Mana Color Balance</h3>
          <p>
            Mainboard + Commander · mana cost pips compared with source capability,
            not mana quantity or reliability
          </p>
        </header>

        <div class="mana-balance-columns" aria-hidden="true">
          <span>Color</span>
          <span>Mana Cost</span>
          <span>Mana Sources</span>
        </div>

        <div class="mana-balance-stack">
          <div
            v-for="metric in manaColorMetrics"
            :key="metric.symbol"
            class="mana-color-row"
          >
            <span
              :class="['mana-color-symbol', `mana-symbol-${metric.symbol.toLowerCase()}`]"
              :title="metric.symbol === 'C' ? 'Colorless' : metric.symbol"
            >
              {{ metric.symbol }}
            </span>

            <div class="mana-color-value">
              <div class="bar-track">
                <div
                  :class="['bar-fill', 'color-cost-fill', `mana-fill-${metric.symbol.toLowerCase()}`]"
                  :style="{ width: manaColorBarWidth(metric.manaCost) }"
                ></div>
              </div>
              <strong>{{ metric.manaCost }}</strong>
            </div>

            <div class="mana-color-value">
              <div class="bar-track">
                <div
                  :class="['bar-fill', 'color-source-fill', `mana-fill-${metric.symbol.toLowerCase()}`]"
                  :style="{ width: manaColorBarWidth(metric.sources) }"
                ></div>
              </div>
              <strong>{{ metric.sources }}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.curve-card {
  display: grid;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid var(--surface-border-light);
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.04), rgba(15, 23, 42, 0.98)),
    var(--surface-card);
  box-shadow: var(--shadow-md);
}

.curve-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: end;
  flex-wrap: wrap;
}

.eyebrow {
  display: inline-block;
  margin-bottom: 10px;
  color: var(--accent-electric);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  color: var(--text-light);
  font-size: 1.25rem;
}

.summary-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.curve-toggle {
  flex: 0 0 auto;
  padding: 8px 12px;
  border: 1px solid var(--accent-electric-border);
  border-radius: 10px;
  background: var(--accent-electric-dim);
  color: var(--accent-electric);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.curve-toggle:hover {
  background: rgba(56, 189, 248, 0.18);
}

.summary-pill {
  min-width: 132px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.72);
}

.summary-label {
  display: block;
  margin-bottom: 6px;
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.summary-pill strong {
  color: var(--text-light);
  font-size: 1rem;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.chart-panel {
  display: grid;
  gap: 10px;
}

.panel-header h3 {
  margin: 0;
  color: var(--text-light);
  font-size: 1rem;
}

.panel-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.chart-stack {
  display: grid;
  gap: 8px;
}

.curve-row,
.category-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 40px;
  gap: 10px;
  align-items: center;
}

.bucket-label,
.category-label,
.count-label {
  color: var(--text-main);
  font-size: 0.88rem;
  font-weight: 700;
}

.category-label {
  width: 92px;
  max-width: 92px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-row {
  grid-template-columns: 92px minmax(0, 1fr) 40px;
}

.count-label {
  text-align: right;
}

.bar-track {
  overflow: hidden;
  height: 14px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.82);
}

.bar-fill {
  height: 100%;
  min-width: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.mana-fill {
  background: linear-gradient(90deg, #f59e0b, #fb7185);
}

.category-fill {
  background: linear-gradient(90deg, #38bdf8, #34d399);
}

.mana-balance-panel {
  grid-column: 1 / -1;
  padding-top: 4px;
}

.mana-balance-columns,
.mana-color-row {
  display: grid;
  grid-template-columns: 58px repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: center;
}

.mana-balance-columns {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.mana-balance-columns span:not(:first-child) {
  padding-left: 2px;
}

.mana-balance-stack {
  display: grid;
  gap: 9px;
}

.mana-color-symbol {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: #0f172a;
  font-size: 0.82rem;
  font-weight: 900;
  box-shadow: 0 5px 12px rgba(2, 6, 23, 0.3);
}

.mana-color-value {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38px;
  gap: 10px;
  align-items: center;
}

.mana-color-value strong {
  color: var(--text-light);
  font-size: 0.88rem;
  text-align: right;
}

.color-source-fill {
  opacity: 0.62;
  background-image: repeating-linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.18) 0,
    rgba(255, 255, 255, 0.18) 5px,
    transparent 5px,
    transparent 10px
  );
  background-blend-mode: screen;
}

.mana-fill-w,
.mana-symbol-w { background-color: #f5e7ad; }

.mana-fill-u,
.mana-symbol-u { background-color: #58a9e8; }

.mana-fill-b,
.mana-symbol-b { background-color: #9486a8; }

.mana-fill-r,
.mana-symbol-r { background-color: #e8655b; }

.mana-fill-g,
.mana-symbol-g { background-color: #54ad78; }

.mana-fill-c,
.mana-symbol-c { background-color: #94a3b8; }

.color-cost-fill,
.color-source-fill {
  transition: width 160ms ease;
}

@media (max-width: 1040px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .curve-row {
    grid-template-columns: 32px minmax(0, 1fr) 40px;
    gap: 10px;
  }

  .mana-balance-columns,
  .mana-color-row {
    grid-template-columns: 38px repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .mana-color-value {
    grid-template-columns: minmax(0, 1fr) 28px;
    gap: 6px;
  }

  .category-row {
    grid-template-columns: 72px minmax(0, 1fr) 40px;
  }

  .category-label {
    width: 72px;
    max-width: 72px;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .summary-pill {
    min-width: 0;
    flex: 1 1 140px;
  }
}
</style>
