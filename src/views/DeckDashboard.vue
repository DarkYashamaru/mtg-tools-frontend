<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/authStore'

type CollectionSummary = {
  id: number
  name: string
  deck_type: string
  commander_name: string | null
  commander_image_uri: string | null
  item_count: number
}

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const { authHeaders, user } = storeToRefs(authStore)

const isLoading = ref(true)
const errorMessage = ref('')
const collections = ref<CollectionSummary[]>([])

function usernameLabel() {
  const currentUser = user.value
  return currentUser && typeof currentUser.username === 'string' ? currentUser.username : 'your'
}

async function loadCollections() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch('/api/collections', {
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

    if (!response.ok || !data.success || !Array.isArray(data.collections)) {
      throw new Error(data.error || 'Unable to load collections.')
    }

    collections.value = data.collections
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load collections.'
  } finally {
    isLoading.value = false
  }
}

function openCreateCollection() {
  router.push({ name: 'new-collection' })
}

function openCollection(collectionId: number) {
  router.push(`/tools/bulk-deck-builder/collections/${collectionId}`)
}

function isCommanderCollection(collection: CollectionSummary) {
  return collection.deck_type.toLowerCase() === 'commander'
}

function collectionSubtitle(collection: CollectionSummary) {
  const deckType = collection.deck_type.toLowerCase()

  if (deckType === 'commander') {
    return collection.commander_name
      ? `Commander: ${collection.commander_name}`
      : 'Commander deck imported without an assigned commander.'
  }

  if (deckType === 'standard') {
    return 'Standard deck collection.'
  }

  return 'Binder collection.'
}

onMounted(() => {
  loadCollections()
})
</script>

<template>
  <div class="dashboard-page">
    <section class="dashboard-shell">
      <header class="hero-card">
        <div>
          <span class="eyebrow">Deck Dashboard</span>
          <h1>{{ usernameLabel() }} collection workspace</h1>
          <p class="description">
            Choose an existing collection or start a new one. The master collection entry is visible here, but remains disabled for now.
          </p>
        </div>

        <button class="create-button" type="button" @click="openCreateCollection">
          Create New Collection
        </button>
      </header>

      <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>

      <section class="dashboard-grid">
        <button class="collection-card master-card" type="button" disabled>
          <span class="card-kicker">System Slot</span>
          <h2>Master Collection</h2>
          <p>Shared pool access will be enabled in a later pass.</p>
          <span class="card-meta">Disabled</span>
        </button>

        <div v-if="isLoading" class="loading-grid">
          <div v-for="item in 4" :key="item" class="collection-card skeleton-card skeleton-pulse"></div>
        </div>

        <template v-else>
          <button
            v-for="collection in collections"
            :key="collection.id"
            class="collection-card"
            type="button"
            @click="openCollection(collection.id)"
          >
            <div v-if="isCommanderCollection(collection) && collection.commander_image_uri" class="commander-thumb-wrap">
              <img
                :src="collection.commander_image_uri"
                :alt="collection.commander_name || collection.name"
                class="commander-thumb"
                loading="lazy"
              >
            </div>

            <span class="card-kicker">{{ collection.deck_type }}</span>
            <h2>{{ collection.name }}</h2>
            <p>{{ collectionSubtitle(collection) }}</p>
            <span class="card-meta">{{ collection.item_count }} cards tracked</span>
          </button>

          <div v-if="collections.length === 0" class="empty-card">
            <h2>No collections yet</h2>
            <p>Create your first collection to start building a commander workspace from your bulk cards.</p>
          </div>
        </template>
      </section>
    </section>
  </div>
</template>

<style scoped>
.dashboard-page {
  padding: 24px;
}

.dashboard-shell {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  gap: 24px;
}

.hero-card {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-end;
  padding: 32px;
  border-radius: 28px;
  background:
    linear-gradient(135deg, rgba(56, 189, 248, 0.22), rgba(17, 24, 39, 0.94)),
    var(--surface-card);
  border: 1px solid var(--accent-electric-border);
  box-shadow: var(--shadow-lg);
}

.eyebrow {
  display: inline-block;
  margin-bottom: 10px;
  color: var(--accent-electric);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: var(--text-light);
  font-size: clamp(2rem, 3.8vw, 3rem);
  line-height: 1.05;
}

.description {
  max-width: 62ch;
  margin: 12px 0 0;
  color: var(--text-muted);
  font-size: 1rem;
  line-height: 1.6;
}

.create-button {
  flex: 0 0 auto;
  min-width: 220px;
  padding: 14px 18px;
  border: none;
  border-radius: 14px;
  background: var(--accent-electric);
  color: #04131d;
  font-family: var(--font-sans);
  font-size: 0.98rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.create-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(56, 189, 248, 0.2);
}

.status-banner {
  margin: 0;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid transparent;
  font-size: 0.94rem;
}

.status-banner.error {
  background: rgba(127, 29, 29, 0.2);
  border-color: var(--error-border);
  color: var(--error-text);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}

.loading-grid {
  display: contents;
}

.collection-card,
.empty-card {
  min-height: 210px;
  padding: 24px;
  border-radius: 22px;
  border: 1px solid var(--surface-border-light);
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.05), rgba(15, 23, 42, 0.96)),
    var(--surface-card);
  box-shadow: var(--shadow-md);
}

.collection-card {
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.collection-card:hover:enabled {
  transform: translateY(-3px);
  border-color: var(--accent-electric-border);
  background:
    linear-gradient(180deg, rgba(56, 189, 248, 0.08), rgba(15, 23, 42, 0.96)),
    var(--surface-card);
}

.collection-card:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.master-card {
  border-style: dashed;
}

.card-kicker {
  display: inline-block;
  margin-bottom: 16px;
  color: var(--text-dark);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.collection-card h2,
.empty-card h2 {
  margin: 0 0 12px;
  color: var(--text-light);
  font-size: 1.4rem;
  line-height: 1.15;
}

.commander-thumb-wrap {
  margin: -6px -6px 16px;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.1);
  background: rgba(15, 23, 42, 0.6);
}

.commander-thumb {
  display: block;
  width: 100%;
  aspect-ratio: 1.4 / 1;
  object-fit: cover;
}

.collection-card p,
.empty-card p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.55;
}

.card-meta {
  display: inline-block;
  margin-top: 18px;
  color: var(--accent-electric);
  font-size: 0.88rem;
  font-weight: 700;
}

.skeleton-card {
  opacity: 0.6;
}

@media (max-width: 760px) {
  .dashboard-page {
    padding: 16px;
  }

  .hero-card {
    padding: 22px;
    align-items: stretch;
    flex-direction: column;
  }

  .create-button {
    width: 100%;
    min-width: 0;
  }
}
</style>
