<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCollectionStore } from '../stores/collectionStore'
import { useAuthStore } from '@/stores/authStore'
import { loadSavedCollectionGameplay } from '@/composables/useSavedCollectionGameplay'

const router = useRouter()
const route = useRoute()
const store = useCollectionStore()
const authStore = useAuthStore()

// Bind seamlessly to the reactive store evaluation layer
const { collection, validCommanders, scoredCommanders } = storeToRefs(store)
const { authHeaders } = storeToRefs(authStore)
const isLoading = ref(false)
const errorMessage = ref('')

const activeCollectionId = computed(() => {
  const rawValue = route.params.collectionId
  return typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null
})

async function loadCollectionFromBackend(collectionId: string) {
  isLoading.value = true
  errorMessage.value = ''
  store.clearStore()

  try {
    const { cards } = await loadSavedCollectionGameplay({
      collectionId,
      authHeaders,
      routePath: route.fullPath,
      router,
    })
    store.setCollection(cards)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load collection data.'
  } finally {
    isLoading.value = false
  }
}

function handleCommanderClick(oracleId: string) {
  store.selectCommander(oracleId)
  if (activeCollectionId.value) {
    router.push({
      name: 'collection-select-commander-theme',
      params: {
        collectionId: activeCollectionId.value,
        commanderId: oracleId,
      },
    })
    return
  }

  router.push('/tools/bulk-deck-builder/select-commander-theme')
}

function goBackToImporter() {
  if (activeCollectionId.value) {
    router.push(`/tools/bulk-deck-builder/collections/${activeCollectionId.value}`)
    return
  }

  router.push('/tools/bulk-deck-builder')
}

onMounted(() => {
  if (activeCollectionId.value) {
    loadCollectionFromBackend(activeCollectionId.value)
  }
})
</script>

<template>
  <div class="container">
    <div class="header-action-row">
      <div>
        <h1>Your Rated Commanders</h1>
        <p class="description">Select a commander below to view matching synergistic cards in your pool.</p>
      </div>
      <button class="nav-back-btn" @click="goBackToImporter">← Import Different Deck</button>
    </div>

    <div v-if="!collection || collection.length === 0" class="empty-state">
      <h3 v-if="isLoading">Loading Collection</h3>
      <p v-if="isLoading">Resolving gameplay cards for this saved collection...</p>

      <template v-else>
      <h3>No Active Workspace Data Found</h3>
      <p>{{ errorMessage || 'Please import or paste your card collection data first to run evaluation scores.' }}</p>
      <button class="redirect-btn" @click="goBackToImporter">Go to Importer</button>
      </template>
    </div>

    <div v-else class="results-layout">
      <div class="stats-summary">
        <p>Total Collection Size: <strong>{{ collection.length }}</strong></p>
        <p>Potential Commanders Found: <strong>{{ validCommanders?.length || 0 }}</strong></p>
      </div>

      <section class="commander-section">
        <div class="commander-grid">
          <button  
            v-for="item in scoredCommanders"  
            :key="item?.commander?.oracle_id || Math.random().toString()"  
            class="commander-card-btn"
            @click="item?.commander?.oracle_id && handleCommanderClick(item.commander.oracle_id)"
          >
            <div class="card-image-container">
              <img  
                v-if="item?.commander?.faces?.[0]?.small_image"  
                :src="item.commander.faces[0].small_image"  
                :alt="item?.commander?.name || 'Commander card image'"
                class="card-img"
                loading="lazy"
              />
              <div v-else class="card-img-placeholder"><span>No Image</span></div>
            </div>

            <div class="card-info">
              <div class="header-block">
                <h3>{{ item?.commander?.name || 'Unknown Commander' }}</h3>
                <p class="cmc-tag">CMC: {{ item?.commander?.cmc ?? 0 }}</p>
              </div>

              <div class="score-display">
                <span class="score-label">Viability Score</span>
                <span class="score-value">{{ item?.totalScore ?? 0 }}</span>
                <span class="score-subtext">{{ item?.matchingCardCount ?? 0 }} cards in color</span>
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped src="./PossibleCommanders.css"></style>
