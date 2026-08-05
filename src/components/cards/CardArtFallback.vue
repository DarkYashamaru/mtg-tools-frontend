<script setup lang="ts">
import { computed } from 'vue'
import { getFaceTypeLine, type CardFaceLike } from './cardDisplay'

interface Props {
  cardName?: string | null
  face?: CardFaceLike | null
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  cardName: '',
  face: null,
  compact: false,
})

const typeLine = computed(() => getFaceTypeLine(props.face ?? undefined))
const displayName = computed(() => props.face?.name || props.cardName || 'Unknown Card')
</script>

<template>
  <div class="fallback-card" :class="{ compact }">
    <span class="fallback-eyebrow">Card Preview</span>
    <strong class="fallback-name">{{ displayName }}</strong>
    <span v-if="typeLine" class="fallback-type">{{ typeLine }}</span>
  </div>
</template>

<style scoped>
.fallback-card {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 18px;
  box-sizing: border-box;
  background:
    linear-gradient(160deg, rgba(56, 189, 248, 0.08), rgba(15, 23, 42, 0.98)),
    var(--surface-card);
  color: var(--text-main);
  text-align: center;
}

.fallback-card.compact {
  gap: 6px;
  padding: 14px;
}

.fallback-eyebrow {
  color: var(--text-dark);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fallback-name {
  color: var(--text-light);
  font-size: 0.98rem;
  line-height: 1.35;
}

.fallback-card.compact .fallback-name {
  font-size: 0.88rem;
}

.fallback-type {
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.4;
}
</style>
