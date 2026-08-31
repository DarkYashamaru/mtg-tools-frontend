<script setup lang="ts">
interface Props {
  usdPrice?: number | null
  dracoPrice?: number | null
}

defineProps<Props>()

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})
const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

function formatUsdPrice(price: number) {
  return `${usdFormatter.format(price)} USD`
}

function formatCopPrice(price: number) {
  return `${copFormatter.format(price)} COP`
}
</script>

<template>
  <div v-if="usdPrice != null || dracoPrice != null" class="price-badges">
    <span v-if="usdPrice != null" class="price-badge usd-price">{{ formatUsdPrice(usdPrice) }}</span>
    <span v-if="dracoPrice != null" class="price-badge draco-price">Draco {{ formatCopPrice(dracoPrice) }}</span>
  </div>
</template>

<style scoped>
.price-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.price-badge {
  display: inline-flex;
  align-items: center;
  width: max-content;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
  padding: 3px 8px;
  border: 1px solid var(--surface-border-light);
  border-radius: 12px;
}

.usd-price {
  color: #b9e6ff;
  background: rgba(56, 189, 248, 0.12);
  border-color: var(--accent-electric-border);
}

.draco-price {
  color: #f7d28d;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.35);
}
</style>

