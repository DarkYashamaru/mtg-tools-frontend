<script setup lang="ts">
import { computed } from 'vue'
import CardFaceViewer from '@/components/cards/CardFaceViewer.vue'

interface Props {
  commander: any
  showTags?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showTags: false
})

const commanderDirectTags = computed(() => props.commander?.tags?.direct?.map((t: any) => t.slug) || [])
const commanderInheritedTags = computed(() => props.commander?.tags?.inherited?.map((t: any) => t.slug) || [])

const hasTags = computed(() => commanderDirectTags.value.length > 0 || commanderInheritedTags.value.length > 0)
</script>

<template>
  <header class="commander-hero">
    <div class="hero-image-wrapper">
      <CardFaceViewer
        :card="commander"
        image-size="large"
        :show-flip-control="true"
        :interactive="true"
        :lazy="true"
      />
    </div>
    
    <div class="hero-text">
      <slot name="banner" />

      <h1>{{ commander.name }}</h1>

      <div class="identity-row">
        <div class="identity-container">
          <span class="label-text">Identity:</span>
          <div v-if="commander.color_identity?.length" class="color-pips">
            <span 
              v-for="color in commander.color_identity" 
              :key="color.symbol"
              :class="['pip', color.symbol.toLowerCase()]"
              :title="`Mana color: ${color.symbol}`"
            />
          </div>
          <div v-else class="color-pips">
            <span class="pip c" title="Colorless" />
          </div>
        </div>
        <span class="cmc-badge">CMC {{ commander.cmc ?? 0 }}</span>
      </div>

      <div v-if="showTags && hasTags" class="tag-cloud-wrapper">
        <div v-if="commanderDirectTags.length > 0" class="tag-section">
          <p class="section-label">Direct Tags</p>
          <div class="tag-group">
            <span v-for="tag in commanderDirectTags" :key="tag" class="tag-badge commander-tag direct">
              {{ tag }}
            </span>
          </div>
        </div>

        <div v-if="commanderInheritedTags.length > 0" class="tag-section">
          <p class="section-label">Inherited Tags</p>
          <div class="tag-group">
            <span v-for="tag in commanderInheritedTags" :key="tag" class="tag-badge commander-tag inherited">
              {{ tag }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.commander-hero {
  display: flex;
  gap: 32px;
  align-items: flex-start;
  margin-bottom: 24px;
  font-family: var(--font-sans);
}

.hero-image-wrapper {
  width: 180px;
  flex-shrink: 0;
  position: relative;
  overflow: visible;
}

.hero-image-wrapper :deep(.face-viewer) {
  width: 100%;
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--surface-border-light);
  position: relative;
  z-index: 1;
  transform-origin: center left;
  will-change: transform;
  transition: 
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.25s ease,
    border-color 0.25s ease;
}

.hero-image-wrapper:hover :deep(.face-viewer),
.hero-image-wrapper:focus-within :deep(.face-viewer) {
  transform: scale(1.5);
  z-index: 99;
  border-color: var(--accent-electric);
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.65), 
    0 0 0 1px rgba(56, 189, 248, 0.2);
}

.hero-text {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

h1 {
  color: var(--text-light);
  font-size: 2.25rem;
  font-weight: 800;
  margin: 0 0 8px 0;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

/* Identity & Budget Metadata */
.identity-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 4px;
}

.identity-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label-text {
  color: var(--text-dark);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.color-pips {
  display: flex;
  gap: 6px;
}

.cmc-badge {
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border-light);
  color: var(--text-main);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* Tag Clusters Layout */
.tag-cloud-wrapper {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background-color: rgba(17, 24, 39, 0.4);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
}

.tag-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.section-label {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  font-weight: 700;
  width: 140px;
  flex-shrink: 0;
}

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Token-driven Tags styling */
.tag-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.commander-tag.direct {
  background-color: var(--accent-electric-dim);
  border: 1px solid var(--accent-electric-border);
  color: var(--accent-electric);
}

.commander-tag.inherited {
  background-color: var(--surface-hover);
  border: 1px solid var(--surface-border-light);
  color: var(--text-main);
}
</style>
