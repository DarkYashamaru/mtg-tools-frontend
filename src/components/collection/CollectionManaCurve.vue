<script setup lang="ts">
import { computed } from 'vue'
import type { CollectionRecord } from './types'

interface Props {
  collection: CollectionRecord
}

const props = defineProps<Props>()

type ManaBucket = {
  label: string
  count: number
}

type CategoryBucket = {
  name: string
  count: number
}

const nonLandItems = computed(() => props.collection.items.filter((item) => {
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

  for (const item of props.collection.items) {
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

function barWidth(count: number) {
  return `${Math.max((count / maxBucketCount.value) * 100, count > 0 ? 6 : 0)}%`
}

function categoryBarWidth(count: number) {
  return `${Math.max((count / maxCategoryCount.value) * 100, count > 0 ? 6 : 0)}%`
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
    </header>

    <div class="chart-grid">
      <section class="chart-panel">
        <header class="panel-header">
          <h3>Mana Curve</h3>
          <p>Lands excluded</p>
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
          <p>All assigned categories</p>
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

  .category-row {
    grid-template-columns: 72px minmax(0, 1fr) 40px;
  }

  .category-label {
    width: 72px;
    max-width: 72px;
  }

  .summary-pill {
    min-width: 0;
    flex: 1 1 140px;
  }
}
</style>
