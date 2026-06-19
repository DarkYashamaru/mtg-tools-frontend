<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCollectionStore } from '../stores/collectionStore'
import CommanderHero from '@/components/CommanderHero.vue' 

const router = useRouter()
const store = useCollectionStore()

const { selectedTheme, selectedCommanderData } = storeToRefs(store)

const activeDetails = computed(() => selectedCommanderData.value)
const activeTheme = computed(() => selectedTheme.value)

const thematicCardsInPool = computed(() => {
  const activeCommander = activeDetails.value?.commander
  const targetTheme = activeTheme.value
  
  if (!activeCommander || !targetTheme) return []
  
  const commanderColors = new Set(activeCommander.color_identity.map(c => c.symbol.toUpperCase()))
  const commanderId = activeCommander.oracle_id
  const targetThemeId = targetTheme.theme_id

  return store.collection
    .filter(card => {
      if (card.oracle_id === commanderId) return false
      return card.color_identity.every(color => commanderColors.has(color.symbol.toUpperCase()))
    })
    .map(card => {
      const matchingThemeInstance = card.themes?.find(t => t.theme_id === targetThemeId)
      const themeScore = matchingThemeInstance ? matchingThemeInstance.score : 0

      return {
        card,
        themeScore
      }
    })
    .sort((a, b) => b.themeScore - a.themeScore)
})

function goBack() {
  router.push('/tools/bulk-deck-builder/select-commander-theme')
}
</script>

<template>
  <div class="container">
    <button class="back-link" @click="goBack">← Back to Theme Selection</button>

    <div v-if="!activeDetails || !activeDetails.commander || !activeTheme" class="empty-state">
      <h3>No Strategy Workspace Active</h3>
      <p>Please return to the selection panel to select both a commander and an operational synergy theme profile.</p>
      <button class="action-btn" @click="goBack">Go to Theme Selection</button>
    </div>

    <div v-else>
      <CommanderHero :commander="activeDetails.commander" show-tags>
        <template #banner>
          <div class="theme-banner">
            Active Strategy: <strong>{{ activeTheme.name }}</strong>
          </div>
        </template>
      </CommanderHero>

      <hr class="divider" />

      <section class="pool-explorer">
        <div class="section-header-block">
          <h2>Theme Strategy Manifest ({{ thematicCardsInPool.length }} cards)</h2>
          <p class="sub-label">
            Displaying collection cards legal within this identity space, ranked by their specific synergy alignment score for the <strong>{{ activeTheme.name }}</strong> archetype.
          </p>
        </div>

        <div class="pool-table-wrapper">
          <table class="pool-table">
            <thead>
              <tr>
                <th>Card Details</th>
                <th>CMC</th>
                <th>Colors</th>
                <th class="score-th">Theme Score</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="item in thematicCardsInPool" 
                :key="item.card.oracle_id" 
                :class="{ 'zero-synergy': item.themeScore === 0 }"
              >
                <td class="card-name-cell">
                  <div class="card-identity-block">
                    <div class="thumb-wrapper">
                      <img 
                        v-if="item.card.faces?.[0]?.normal_image"
                        :src="item.card.faces[0].normal_image"
                        :alt="item.card.name"
                        class="table-thumb"
                        loading="lazy"
                      />
                      <div v-else class="thumb-placeholder"><span>No Art</span></div>
                    </div>
                    <div class="card-text-metadata">
                      <strong>{{ item.card.name }}</strong>
                      <p class="oracle-preview">{{ item.card.faces[0]?.oracle_text || 'No oracle text registered.' }}</p>
                    </div>
                  </div>
                </td>
                <td>{{ item.card.cmc ?? 0 }}</td>
                <td>
                  <div v-if="item.card.color_identity?.length" class="color-pips">
                    <span 
                      v-for="color in item.card.color_identity" 
                      :key="color.symbol"
                      :class="['pip', color.symbol.toLowerCase()]"
                      :title="color.symbol"
                    />
                  </div>
                  <div v-else class="color-pips">
                    <span class="pip c" title="Colorless" />
                  </div>
                </td>
                <td class="score-cell">
                  <span v-if="item.themeScore > 0" class="badge-score-value">
                    +{{ item.themeScore }}
                  </span>
                  <span v-else class="empty-tag-text">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped src="./SelectedTheme.css"></style>