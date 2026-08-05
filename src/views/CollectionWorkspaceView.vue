<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CollectionHeader from '@/components/collection/CollectionHeader.vue'
import CollectionToolbar from '@/components/collection/CollectionToolbar.vue'
import type { CollectionRecord, WorkspaceViewMode } from '@/components/collection/types'
import { useAuthStore } from '@/stores/authStore'
import type { GameplayCard } from '@/types/gameplayCard'

const CommanderWorkspace = defineAsyncComponent(() => import('@/components/collection/CommanderWorkspace.vue'))
const StandardWorkspace = defineAsyncComponent(() => import('@/components/collection/StandardWorkspace.vue'))
const BinderWorkspace = defineAsyncComponent(() => import('@/components/collection/BinderWorkspace.vue'))

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { authHeaders } = storeToRefs(authStore)

const isLoading = ref(true)
const errorMessage = ref('')
const collection = ref<CollectionRecord | null>(null)
const filterText = ref('')
const viewMode = ref<WorkspaceViewMode>('list')

const collectionId = computed(() => String(route.params.collectionId ?? ''))

const filteredCollection = computed<CollectionRecord | null>(() => {
  if (!collection.value) {
    return null
  }

  const query = filterText.value.trim().toLowerCase()
  if (!query) {
    return collection.value
  }

  return {
    ...collection.value,
    items: collection.value.items.filter((item) => {
      const haystack = [
        item.name ?? '',
        item.set_code ?? '',
        item.collector_number ?? '',
        item.lang ?? '',
        item.zone ?? '',
        ...(item.categories ?? []).map((category) => category.name),
        ...(item.archetypes ?? []).map((archetype) => archetype.name),
      ].join(' ').toLowerCase()

      return haystack.includes(query)
    }),
  }
})

const workspaceComponent = computed(() => {
  const deckType = collection.value?.deck_type.toLowerCase()
  if (deckType === 'commander') {
    return CommanderWorkspace
  }
  if (deckType === 'standard') {
    return StandardWorkspace
  }
  return BinderWorkspace
})

const showCommanderBuilderAction = computed(() => collection.value?.deck_type.toLowerCase() === 'binder')

async function loadCollection() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`/api/collections/${collectionId.value}`, {
      headers: {
        ...authHeaders.value,
      },
    })

    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()
      router.replace({
        name: 'login',
        query: { redirect: route.fullPath },
      })
      return
    }

    if (!response.ok || !data.success || !data.collection) {
      throw new Error(data.error || 'Unable to load collection workspace.')
    }

    const loadedCollection = data.collection as CollectionRecord
    const deckText = loadedCollection.items
      .flatMap((item) => {
        if (!item.name || item.amount < 1) {
          return []
        }

        return Array.from({ length: item.amount }, () => `1 ${item.name}`)
      })
      .join('\n')

    let gameplayCardsByOracleId = new Map<string, GameplayCard>()

    if (deckText) {
      const gameplayResponse = await fetch('/api/deck-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck_text: deckText }),
      })

      const gameplayPayload = await gameplayResponse.json().catch(() => ({}))
      if (!gameplayResponse.ok || !gameplayPayload.success || !Array.isArray(gameplayPayload.cards)) {
        throw new Error(gameplayPayload.error || 'Unable to load gameplay data for this collection.')
      }

      gameplayCardsByOracleId = new Map(
        (gameplayPayload.cards as GameplayCard[]).map((card) => [card.oracle_id, card])
      )
    }

    collection.value = {
      ...loadedCollection,
      items: loadedCollection.items.map((item) => {
        const gameplayCard = item.oracle_id ? gameplayCardsByOracleId.get(item.oracle_id) : undefined

        return {
          ...item,
          categories: gameplayCard?.categories ?? [],
          archetypes: gameplayCard?.archetypes ?? [],
        }
      }),
    }
    viewMode.value = collection.value.deck_type.toLowerCase() === 'binder' ? 'list' : 'grid'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load collection workspace.'
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  router.push({ name: 'deck-dashboard' })
}

function goToCommanderBuilder() {
  if (!collection.value || collection.value.deck_type.toLowerCase() !== 'binder') {
    return
  }

  router.push({
    name: 'collection-possible-commanders',
    params: { collectionId: collection.value.id },
  })
}

onMounted(() => {
  loadCollection()
})
</script>

<template>
  <div class="workspace-page">
    <section class="workspace-shell">
      <div class="nav-row">
        <button class="back-button" type="button" @click="goBack">
          Back to Deck Dashboard
        </button>
      </div>

      <div v-if="isLoading" class="loading-panel skeleton-pulse">
        <div class="loading-copy">
          <h2>Loading collection workspace...</h2>
        </div>
      </div>

      <div v-else-if="errorMessage" class="state-panel error">
        <h2>Unable to load collection</h2>
        <p>{{ errorMessage }}</p>
      </div>

      <template v-else-if="collection && filteredCollection">
        <CollectionHeader
          :collection="collection"
          :show-commander-builder-action="showCommanderBuilderAction"
          @create-commander-deck="goToCommanderBuilder"
        />
        <CollectionToolbar v-model="viewMode" v-model:filter-text="filterText" :collection="collection" />

        <div v-if="filteredCollection.items.length === 0" class="state-panel">
          <h2>No cards match this filter</h2>
          <p>Try a different local filter or clear the current search.</p>
        </div>

        <component
          :is="workspaceComponent"
          v-else
          :collection="filteredCollection"
          :view-mode="viewMode"
        />
      </template>
    </section>
  </div>
</template>

<style scoped>
.workspace-page {
  padding: 20px;
}

.workspace-shell {
  max-width: 1520px;
  margin: 0 auto;
  display: grid;
  gap: 18px;
}

.nav-row {
  display: flex;
  justify-content: flex-start;
}

.back-button {
  padding: 12px 16px;
  border: 1px solid var(--surface-border-light);
  border-radius: 14px;
  background: transparent;
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 0.94rem;
  font-weight: 700;
  cursor: pointer;
}

.loading-panel,
.state-panel {
  padding: 28px;
  border-radius: 24px;
  border: 1px solid var(--surface-border-light);
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.04), rgba(15, 23, 42, 0.98)),
    var(--surface-card);
  box-shadow: var(--shadow-md);
}

.loading-copy h2,
.state-panel h2 {
  margin: 0;
  color: var(--text-light);
  font-size: 1.4rem;
}

.state-panel p {
  margin: 10px 0 0;
  color: var(--text-muted);
  line-height: 1.6;
}

.state-panel.error {
  border-color: var(--error-border);
}

@media (max-width: 760px) {
  .workspace-page {
    padding: 14px;
  }
}
</style>
