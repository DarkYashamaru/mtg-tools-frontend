<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/authStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const { isAuthenticated, user } = storeToRefs(authStore)

const authButtonLabel = computed(() => (isAuthenticated.value ? 'Bulk Builder' : 'Login'))
const authButtonTarget = computed(() => {
  if (isAuthenticated.value) {
    return '/tools/bulk-deck-builder'
  }

  return {
    name: 'login',
    query: { redirect: '/' },
  }
})

const showCollectionBack = computed(() => route.name === "collection-workspace")

const usernameLabel = computed(() => {
  const currentUser = user.value

  if (!currentUser || typeof currentUser.username !== 'string') {
    return ''
  }

  return currentUser.username
})

function handleLogout() {
  authStore.logout()

  if (route.meta.requiresAuth) {
    router.push('/')
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-leading">
        <router-link v-if="showCollectionBack" class="topbar-back-button" :to="{ name: 'deck-dashboard' }">Back to Deck Dashboard</router-link>
        <router-link class="topbar-brand" to="/">MTG Deck Toolkit</router-link>
      </div>

      <div class="topbar-actions">
        <span v-if="usernameLabel" class="user-chip">{{ usernameLabel }}</span>
        <router-link class="topbar-button" :to="authButtonTarget">
          {{ authButtonLabel }}
        </router-link>
        <router-link v-if="isAuthenticated" class="topbar-button" :to="{ name: 'favourite-cards' }">Favorites</router-link>
        <button v-if="isAuthenticated" class="topbar-ghost-button" type="button" @click="handleLogout">
          Logout
        </button>
      </div>
    </header>

    <router-view />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 28%),
    var(--bg-page);
}

.topbar {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 18px 24px 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.topbar-leading { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

.topbar-back-button { padding: 9px 12px; border: 1px solid var(--surface-border-light); border-radius: 10px; color: var(--text-main); text-decoration: none; font-weight: 700; }

.topbar-brand {
  color: var(--text-light);
  text-decoration: none;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.user-chip {
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid var(--surface-border-light);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 0.86rem;
  font-weight: 600;
}

.topbar-button,
.topbar-ghost-button {
  padding: 10px 14px;
  border-radius: 10px;
  font-family: var(--font-sans);
  font-size: 0.92rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.topbar-button {
  background: var(--accent-electric);
  color: #090d16;
  border: none;
}

.topbar-button:hover,
.topbar-ghost-button:hover {
  transform: translateY(-1px);
}

.topbar-ghost-button {
  background: transparent;
  color: var(--text-main);
  border: 1px solid var(--surface-border-light);
}

@media (max-width: 640px) {
  .topbar {
    padding: 16px 16px 0;
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
