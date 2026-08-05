<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CommanderHero from '@/components/CommanderHero.vue'
import { useAuthStore } from '@/stores/authStore'
import { useCollectionStore } from '../stores/collectionStore'
import type { Card, CardThemeResponse } from '@/utils/deckScorer'
import { loadSavedCollectionGameplay } from '@/composables/useSavedCollectionGameplay'

const router = useRouter()
const route = useRoute()
const store = useCollectionStore()
const authStore = useAuthStore()
const { authHeaders } = storeToRefs(authStore)

const activeCommander = ref<Card | null>(null)
const activeTheme = ref<CardThemeResponse | null>(null)
const collectionCards = ref<Card[]>([])
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

const activeThemeId = computed(() => {
  const rawValue = route.params.themeId
  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return null
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? parsed : null
})

const thematicCardsInPool = computed(() => {
  if (!activeCommander.value || !activeTheme.value) return []

  const commanderColors = new Set(activeCommander.value.color_identity.map((c) => c.symbol.toUpperCase()))
  const commanderId = activeCommander.value.oracle_id
  const targetThemeId = activeTheme.value.theme_id

  return collectionCards.value
    .filter((card) => {
      if (card.oracle_id === commanderId) return false
      return card.color_identity.every((color) => commanderColors.has(color.symbol.toUpperCase()))
    })
    .map((card) => {
      const matchingThemeInstance = card.themes?.find((t) => t.theme_id === targetThemeId)
      const themeScore = matchingThemeInstance ? matchingThemeInstance.score : 0

      return {
        card,
        themeScore,
      }
    })
    .sort((a, b) => b.themeScore - a.themeScore)
})

async function loadSelectedThemePage() {
  if (!activeCollectionId.value || !activeCommanderId.value || activeThemeId.value === null) {
    errorMessage.value = 'Missing collection, commander, or theme identifier.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const { cards } = await loadSavedCollectionGameplay({
      collectionId: activeCollectionId.value,
      authHeaders,
      routePath: route.fullPath,
      router,
    })

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

    const themes = await response.json()
    activeTheme.value = Array.isArray(themes)
      ? themes.find((theme) => Number(theme.theme_id) === activeThemeId.value) ?? null
      : null

    if (!activeTheme.value) {
      throw new Error('The selected theme was not found for this commander.')
    }

    store.setSelectedTheme(activeTheme.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load selected theme.'
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  if (activeCollectionId.value && activeCommanderId.value) {
    router.push({
      name: 'collection-select-commander-theme',
      params: {
        collectionId: activeCollectionId.value,
        commanderId: activeCommanderId.value,
      },
    })
    return
  }

  router.push('/tools/bulk-deck-builder/select-commander-theme')
}

function openCardDetail(oracleId: string) {
  const routeData = router.resolve({
    name: 'card-detail',
    params: { id: oracleId },
  })
  window.open(routeData.href, '_blank')
}

onMounted(() => {
  loadSelectedThemePage()
})
</script>

<template>
  <div class="container">
    <button class="back-link" @click="goBack">← Back to Theme Selection</button>

    <div v-if="isLoading" class="empty-state">
      <h3>Loading Strategy Workspace</h3>
      <p>Resolving the commander, collection pool, and selected theme.</p>
      <button class="action-btn" @click="goBack">Go to Theme Selection</button>
    </div>

    <div v-else-if="!activeCommander || !activeTheme || errorMessage" class="empty-state">
      <h3>No Strategy Workspace Active</h3>
      <p>{{ errorMessage || 'Please return to the selection panel to select both a commander and an operational synergy theme profile.' }}</p>
      <button class="action-btn" @click="goBack">Go to Theme Selection</button>
    </div>

    <div v-else>
      <CommanderHero :commander="activeCommander" show-tags>
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
                @click="openCardDetail(item.card.oracle_id)"
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
