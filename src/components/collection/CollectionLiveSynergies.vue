<script setup lang="ts">
import type { CollectionLiveSynergy } from './types'

defineProps<{
  groups: CollectionLiveSynergy[]
}>()
</script>

<template>
  <section v-if="groups.length" class="live-synergies">
    <h4>Live Synergies</h4>

    <div v-for="group in groups" :key="`${group.rule_key}:${group.direction}`" class="live-synergy-group">
      <strong>{{ group.title }}</strong>
      <span class="live-synergy-direction">
        {{ group.direction === 'enables' ? 'Enables' : 'Enabled by' }}
      </span>
      <ul>
        <li v-for="name in group.partner_names" :key="name">{{ name }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.live-synergies { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(148, 163, 184, 0.14); }
.live-synergies h4 { margin: 0; color: var(--text-main); font-size: 0.88rem; }
.live-synergy-group { display: grid; gap: 3px; margin-top: 10px; }
.live-synergy-group > strong { color: var(--accent-electric); font-size: 0.78rem; }
.live-synergy-direction { color: var(--text-muted); font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.live-synergy-group ul { display: flex; flex-wrap: wrap; gap: 4px 8px; margin: 0; padding: 0; list-style: none; color: var(--text-muted); font-size: 0.78rem; line-height: 1.45; }
.live-synergy-group li::before { content: '•'; margin-right: 4px; color: var(--accent-electric); }
</style>
