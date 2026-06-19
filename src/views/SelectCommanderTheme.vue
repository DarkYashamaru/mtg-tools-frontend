<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCollectionStore } from '@/stores/collectionStore'
import CommanderHero from '@/components/CommanderHero.vue' // Adjust path as needed


const router = useRouter()
const store = useCollectionStore()

const { selectedCommanderData } = storeToRefs(store)
const activeDetails = computed(() => selectedCommanderData.value)

const rawCommanderThemes = ref<any[]>([])
const isThemesLoading = ref(false)

watch(
  () => activeDetails.value?.commander?.oracle_id,
  async (newOracleId) => {
    if (!newOracleId) {
      rawCommanderThemes.value = []
      return
    }

    isThemesLoading.value = true
    try {
      const response = await fetch(`/api/themes/by-commander/${newOracleId}`)
      if (response.ok) {
        rawCommanderThemes.value = await response.json()
      } else {
        console.error('Failed to pull commander theme profiles')
      }
    } catch (err) {
      console.error('Network error fetching strategic theme mappings:', err)
    } finally {
      isThemesLoading.value = false
    }
  },
  { immediate: true }
)

const selectedCommanderThemes = computed(() => {
  const activeCommander = activeDetails.value?.commander
  if (!activeCommander || rawCommanderThemes.value.length === 0 || !store.collection) {
    return []
  }

  const commanderColors = new Set(activeCommander.color_identity.map(c => c.symbol.toUpperCase()))
  const commanderId = activeCommander.oracle_id

  const mappingAccumulator = new Map<number, { theme_id: number; name: string; curated: boolean; score: number }>()
  
  rawCommanderThemes.value.forEach(theme => {
    mappingAccumulator.set(theme.theme_id, {
      theme_id: theme.theme_id,
      name: theme.name,
      curated: theme.curated,
      score: 0 
    })
  })

  store.collection.forEach(card => {
    if (card.oracle_id === commanderId) return

    const isColorLegal = card.color_identity.every(color => 
      commanderColors.has(color.symbol.toUpperCase())
    )
    if (!isColorLegal) return

    if (Array.isArray(card.themes)) {
      card.themes.forEach(cardTheme => {
        if (mappingAccumulator.has(cardTheme.theme_id)) {
          mappingAccumulator.get(cardTheme.theme_id)!.score += cardTheme.score
        }
      })
    }
  })

  return Array.from(mappingAccumulator.values()).sort((a, b) => b.score - a.score)
})

const maxThemeScore = computed(() => {
  if (selectedCommanderThemes.value.length === 0) return 1
  return Math.max(...selectedCommanderThemes.value.map(t => t.score)) || 1
})

function goBack() {
  router.push('/tools/bulk-deck-builder/possible-commanders')
}

function selectTheme(theme: any) {
  store.setSelectedTheme(theme)
  router.push('/tools/bulk-deck-builder/selected-theme')
}
</script>

<template>
  <div class="container">
    <button class="back-link" @click="goBack">← Back to Overview</button>

    <div v-if="!activeDetails || !activeDetails.commander" class="empty-state">
      <h3>No Commander Chosen</h3>
      <p>Please return to the grid selection panel and choose a commander option to analyze.</p>
      <button class="action-btn" @click="goBack">Go to Commanders Grid</button>
    </div>

    <div v-else>
      <CommanderHero :commander="activeDetails.commander" show-tags />

      <hr class="divider" />

      <section class="theme-explorer">
        <div class="section-header">
          <div>
            <h2>Available Pool Strategy Themes ({{ selectedCommanderThemes.length }})</h2>
            <p class="sub-label">Themes are ranked dynamically based on the cumulative scores of matching cards available in your physical collection pool.</p>
          </div>
        </div>

        <div v-if="isThemesLoading" class="status-box loading">
          <p>Querying strategy matrix profiles and computing pool backing statistics...</p>
        </div>

        <div v-else-if="selectedCommanderThemes.length === 0" class="status-box empty">
          <p>No valid collection cards match strategic sub-themes within this Commander's color space.</p>
        </div>

        <div v-else class="theme-table-wrapper">
          <table class="theme-table">
            <thead>
              <tr>
                <th>Theme Strategy Name</th>
                <th>Classification</th>
                <th>Cumulative Card Pool Score</th>
                <th class="actions-th">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="theme in selectedCommanderThemes" :key="theme.theme_id">
                <td class="theme-name-cell">
                  <strong>{{ theme.name }}</strong>
                </td>
                <td>
                  <span :class="['curated-badge', theme.curated ? 'curated' : 'community']">
                    {{ theme.curated ? 'Curated Strategy' : 'Community Built' }}
                  </span>
                </td>
                <td>
                  <div class="score-indicator">
                    <span class="score-number">
                      {{ Math.round((theme.score / maxThemeScore) * 100) }}%
                    </span>
                    <div 
                      class="score-bar" 
                      :style="{ width: `${(theme.score / maxThemeScore) * 100}%` }"
                    />
                  </div>
                </td>
                <td class="actions-cell">
                  <button class="select-theme-btn" @click="selectTheme(theme)">
                    Select Strategy →
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped src="./SelectCommanderTheme.css"></style>