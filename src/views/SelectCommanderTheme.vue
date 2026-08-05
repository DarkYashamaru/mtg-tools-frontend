<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CommanderHero from '@/components/CommanderHero.vue'
import { useAuthStore } from '@/stores/authStore'
import { useCollectionStore } from '@/stores/collectionStore'
import type { CollectionRecord } from '@/components/collection/types'
import type { Card } from '@/utils/deckScorer'
import { loadSavedCollectionGameplay } from '@/composables/useSavedCollectionGameplay'

type CommanderTheme = {
  theme_id: number
  name: string
  curated: boolean
  score: number
}

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const store = useCollectionStore()
const { authHeaders } = storeToRefs(authStore)

const collectionRecord = ref<CollectionRecord | null>(null)
const collectionCards = ref<Card[]>([])
const activeCommander = ref<Card | null>(null)
const rawCommanderThemes = ref<CommanderTheme[]>([])
const isLoading = ref(true)
const errorMessage = ref('')

const activeCollectionId = computed(() => {
  const rawValue = route.params.collectionId
  return typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null
})

const activeCommanderId = computed(() => {
  const rawValue = route.params.commanderId
  return typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null
})

const selectedCommanderThemes = computed(() => {
  if (!activeCommander.value || rawCommanderThemes.value.length === 0 || collectionCards.value.length === 0) {
    return []
  }

  const commanderColors = new Set(activeCommander.value.color_identity.map((c) => c.symbol.toUpperCase()))
  const commanderId = activeCommander.value.oracle_id

  const mappingAccumulator = new Map<number, CommanderTheme>()

  rawCommanderThemes.value.forEach((theme) => {
    mappingAccumulator.set(theme.theme_id, {
      theme_id: theme.theme_id,
      name: theme.name,
      curated: theme.curated,
      score: 0,
    })
  })

  collectionCards.value.forEach((card) => {
    if (card.oracle_id === commanderId) return

    const isColorLegal = card.color_identity.every((color) =>
      commanderColors.has(color.symbol.toUpperCase())
    )
    if (!isColorLegal) return

    if (Array.isArray(card.themes)) {
      card.themes.forEach((cardTheme) => {
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
  return Math.max(...selectedCommanderThemes.value.map((t) => t.score)) || 1
})

async function loadCollectionScopedThemePage() {
  if (!activeCollectionId.value || !activeCommanderId.value) {
    errorMessage.value = 'Missing collection or commander identifier.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const { collection, cards } = await loadSavedCollectionGameplay({
      collectionId: activeCollectionId.value,
      authHeaders,
      routePath: route.fullPath,
      router,
    })

    collectionRecord.value = collection
    collectionCards.value = cards
    store.setCollection(cards)
    store.selectCommander(activeCommanderId.value)

    activeCommander.value = cards.find((card) => card.oracle_id === activeCommanderId.value) ?? null

    if (!activeCommander.value) {
      throw new Error('The selected commander is not present in this collection.')
    }

    const response = await fetch(`/api/themes/by-commander/${activeCommanderId.value}`)
    if (!response.ok) {
      throw new Error('Failed to pull commander theme profiles.')
    }

    rawCommanderThemes.value = await response.json()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load theme data.'
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  if (activeCollectionId.value) {
    router.push({
      name: 'collection-possible-commanders',
      params: { collectionId: activeCollectionId.value },
    })
    return
  }

  router.push('/tools/bulk-deck-builder/possible-commanders')
}

function selectTheme(theme: CommanderTheme) {
  store.setSelectedTheme(theme)

  if (activeCollectionId.value && activeCommanderId.value) {
    router.push({
      name: 'collection-selected-theme',
      params: {
        collectionId: activeCollectionId.value,
        commanderId: activeCommanderId.value,
        themeId: String(theme.theme_id),
      },
    })
    return
  }

  router.push('/tools/bulk-deck-builder/selected-theme')
}

onMounted(() => {
  loadCollectionScopedThemePage()
})
</script>

<template>
  <div class="container">
    <button class="back-link" @click="goBack">← Back to Overview</button>

    <div v-if="isLoading" class="empty-state">
      <h3>Loading Commander Themes</h3>
      <p>Resolving this collection and ranking strategy themes for the selected commander.</p>
      <button class="action-btn" @click="goBack">Back to Commanders Grid</button>
    </div>

    <div v-else-if="errorMessage || !activeCommander" class="empty-state">
      <h3>No Commander Chosen</h3>
      <p>{{ errorMessage || 'Please return to the grid selection panel and choose a commander option to analyze.' }}</p>
      <button class="action-btn" @click="goBack">Go to Commanders Grid</button>
    </div>

    <div v-else>
      <CommanderHero :commander="activeCommander" show-tags />

      <hr class="divider" />

      <section class="theme-explorer">
        <div class="section-header">
          <div>
            <h2>Available Pool Strategy Themes ({{ selectedCommanderThemes.length }})</h2>
            <p class="sub-label">Themes are ranked dynamically based on the cumulative scores of matching cards available in your physical collection pool.</p>
          </div>
        </div>

        <div v-if="isLoading" class="status-box loading">
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
