<script setup lang="ts">
import { computed } from 'vue'
import CardFaceViewer from '@/components/cards/CardFaceViewer.vue'
import type { GameplayCard } from '@/types/gameplayCard'

const props = defineProps<{ commander: GameplayCard }>()
const directTags = computed(() => props.commander.tags?.direct ?? [])
const inheritedTags = computed(() => props.commander.tags?.inherited ?? [])

function typeLine(face: GameplayCard['faces'][number]) {
  const cardTypes = [face.supertypes?.join(' '), face.card_types?.join(' ')].filter(Boolean).join(' ')
  return cardTypes + (face.subtypes?.length ? ' — ' + face.subtypes.join(' ') : '')
}
</script>

<template>
  <section class="spotlight" aria-labelledby="commander-spotlight-name">
    <p class="eyebrow">Your selected commander</p>
    <h1 id="commander-spotlight-name">{{ commander.name }}</h1>
    <div class="commander-meta">
      <div class="identity">
        <span>Color identity</span>
        <div class="color-pips">
          <span v-for="color in commander.color_identity" :key="color.symbol" :class="['pip', color.symbol.toLowerCase()]" :title="color.symbol" />
          <span v-if="!commander.color_identity?.length" class="pip c" title="Colorless" />
        </div>
      </div>
      <span class="mana-value">Mana value {{ commander.cmc ?? 0 }}</span>
    </div>
    <div class="card-wrap">
      <CardFaceViewer :card="commander" image-size="large" :show-flip-control="true" :interactive="true" :lazy="false" />
    </div>
    <div v-if="directTags.length || inheritedTags.length" class="tags">
      <div v-if="directTags.length" class="tag-section">
        <p>Direct tags</p>
        <span v-for="tag in directTags" :key="tag.slug" class="tag direct">{{ tag.slug }}</span>
      </div>
      <div v-if="inheritedTags.length" class="tag-section">
        <p>Inherited tags</p>
        <span v-for="tag in inheritedTags" :key="tag.slug" class="tag inherited">{{ tag.slug }}</span>
      </div>
    </div>
    <div class="rules-panel">
      <article v-for="face in commander.faces" :key="face.name" class="face-rules">
        <header><strong>{{ face.name }}</strong><span v-if="face.mana_cost">{{ face.mana_cost }}</span></header>
        <p v-if="typeLine(face)" class="type-line">{{ typeLine(face) }}</p>
        <p v-for="paragraph in (face.oracle_text || '').split('\n')" :key="paragraph" class="oracle-text">{{ paragraph }}</p>
        <p v-if="face.power != null && face.toughness != null" class="stats">{{ face.power }}/{{ face.toughness }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.spotlight { display: grid; justify-items: center; gap: 14px; padding: 12px 0 34px; text-align: center; }
.eyebrow { margin: 0; color: var(--accent-electric); font-size: .72rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: 0; color: var(--text-light); font-size: clamp(2rem, 5vw, 3rem); line-height: 1.1; }
.commander-meta { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 12px; color: var(--text-muted); font-size: .85rem; font-weight: 700; }
.identity, .color-pips { display: flex; align-items: center; gap: 7px; }.color-pips { gap: 5px; }
.pip { width: 19px; height: 19px; border-radius: 50%; border: 1px solid rgba(255,255,255,.3); }.pip.w { background: #f6f1d3; }.pip.u { background: #58a8d9; }.pip.b { background: #4a4654; }.pip.r { background: #d96a59; }.pip.g { background: #63a36b; }.pip.c { background: #9ca3af; }
.mana-value { padding: 5px 10px; border: 1px solid var(--surface-border-light); border-radius: 999px; background: var(--surface-hover); color: var(--text-main); }
.card-wrap { width: min(360px, 100%); overflow: visible; }.card-wrap :deep(.face-viewer) { border: 1px solid var(--surface-border-light); border-radius: 14px; box-shadow: var(--shadow-lg); }
.tags, .rules-panel { width: min(800px, 100%); box-sizing: border-box; }.tags { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--surface-border-light); border-radius: 14px; background: rgba(17,24,39,.4); text-align: left; }.tag-section { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }.tag-section p { width: 110px; margin: 0; color: var(--text-muted); font-size: .72rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }.tag { padding: 4px 9px; border-radius: 999px; font-size: .78rem; font-weight: 700; }.direct { border: 1px solid var(--accent-electric-border); background: var(--accent-electric-dim); color: var(--accent-electric); }.inherited { border: 1px solid var(--surface-border-light); background: var(--surface-hover); color: var(--text-main); }
.rules-panel { display: grid; gap: 12px; text-align: left; }.face-rules { padding: 18px; border: 1px solid var(--surface-border-light); border-radius: 14px; background: rgba(15,23,42,.55); }.face-rules header { display: flex; justify-content: space-between; gap: 12px; color: var(--text-light); }.face-rules header span, .stats { color: var(--accent-electric); font-weight: 800; }.type-line { margin: 7px 0 12px; color: var(--text-muted); font-style: italic; }.oracle-text { margin: 0 0 9px; line-height: 1.55; white-space: pre-wrap; }.stats { margin: 10px 0 0; text-align: right; }
@media (max-width: 560px) { .spotlight { padding-bottom: 24px; }.tag-section p { width: 100%; }.rules-panel, .tags { width: 100%; } }
</style>

