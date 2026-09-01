<script setup lang="ts">
import { computed } from 'vue'
import CardFaceViewer from '@/components/cards/CardFaceViewer.vue'
import type { CollectionItem } from './types'

type PreviewVariant = 'full' | 'card' | 'score'

interface Props { item: CollectionItem | null; variant?: PreviewVariant }
const props = withDefaults(defineProps<Props>(), { variant: 'full' })
const showsCard = computed(() => props.variant !== 'score')
const showsScore = computed(() => props.variant !== 'card')
const scoreBreakdown = computed(() => props.item?.score_breakdown ?? [])
const directReasons = computed(() => props.item?.commander_support_reasons ?? [])
</script>

<template>
  <aside class="commander-builder-preview-panel">
    <div v-if="item" class="preview-card">
      <CardFaceViewer
        v-if="showsCard"
        :card="item.gameplay_card"
        :preview-image-url="item.gameplay_card ? null : item.image_uri"
        :fallback-name="item.name"
        image-size="normal"
        :show-flip-control="true"
        :interactive="true"
      />
      <div class="preview-copy">
        <strong>{{ item.name || 'Unknown Card' }}</strong>
        <p v-if="showsCard">{{ item.set_code || '—' }} · {{ item.collector_number || '—' }} · {{ item.lang || '—' }}</p>

        <template v-if="showsScore">
          <div v-if="item.commander_support_score !== undefined" class="score-summary">
            <span>Total score</span>
            <strong>{{ item.commander_support_score }}</strong>
          </div>
          <p v-else class="unscored-copy">Not scored from this source collection.</p>

          <div v-for="layer in scoreBreakdown" :key="layer.key" class="score-layer">
            <div class="score-layer-header">
              <span>{{ layer.label }}</span>
              <strong>{{ layer.score > 0 ? '+' : '' }}{{ layer.score }}</strong>
            </div>
            <p v-if="layer.reasons.length">{{ layer.reasons.map((reason) => `${reason.label} (${reason.points > 0 ? '+' : ''}${reason.points})`).join(' · ') }}</p>
          </div>
          <p v-if="!scoreBreakdown.length && directReasons.length" class="reason-copy">
            {{ directReasons.map((reason) => `${reason.label} (${reason.points > 0 ? '+' : ''}${reason.points})`).join(' · ') }}
          </p>
        </template>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.commander-builder-preview-panel { position: sticky; top: 20px; align-self: start; }
.preview-card { overflow: hidden; border: 1px solid var(--surface-border-light); border-radius: 18px; background: rgba(15, 23, 42, 0.92); box-shadow: var(--shadow-md); }
.preview-card :deep(img), .preview-card :deep(.face-fallback) { display: block; width: 100%; aspect-ratio: 0.71 / 1; }
.preview-copy { padding: 14px; }
.preview-copy > strong { color: var(--text-light); }
.preview-copy > p { margin: 6px 0 0; color: var(--text-muted); font-size: 0.86rem; }
.score-summary { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-top: 14px; padding: 10px 12px; border: 1px solid var(--accent-electric-border); border-radius: 12px; background: var(--accent-electric-dim); color: var(--text-main); }
.score-summary strong, .score-layer-header strong { color: var(--accent-electric); }
.unscored-copy { font-style: italic; }
.score-layer { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(148, 163, 184, 0.14); }
.score-layer-header { display: flex; justify-content: space-between; gap: 12px; color: var(--text-main); font-size: 0.88rem; font-weight: 700; }
.score-layer p, .reason-copy { margin: 6px 0 0; color: var(--text-muted); font-size: 0.78rem; line-height: 1.5; }
@media (max-width: 980px) { .commander-builder-preview-panel { position: static; } }
</style>
