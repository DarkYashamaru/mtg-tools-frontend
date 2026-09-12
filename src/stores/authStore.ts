import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useCollectionStore } from '@/stores/collectionStore'

type AuthUser = Record<string, unknown>

type LoginPayload = {
  username: string
  password: string
}

const AUTH_STORAGE_KEY = 'mtg_auth_user'
const AUTH_TOKEN_STORAGE_KEY = 'mtg_auth_token'

export const useAuthStore = defineStore('auth', () => {
  const storedAuth = getStoredAuth()
  const user = ref<AuthUser | null>(storedAuth.user)
  const accessToken = ref<string | null>(storedAuth.accessToken)
  const isLoading = ref(false)

  const isAuthenticated = computed(() => user.value !== null && typeof accessToken.value === 'string' && accessToken.value.length > 0)
  const authHeaders = computed((): Record<string, string> => {
    if (!accessToken.value) {
      return {}
    }

    return { Authorization: `Bearer ${accessToken.value}` }
  })

  async function login(payload: LoginPayload) {
    isLoading.value = true

    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok || !data.success || !data.user || typeof data.access_token !== 'string') {
        throw new Error(data.error || 'Unable to log in.')
      }

      user.value = data.user
      accessToken.value = data.access_token
      persistAuth(data.user, data.access_token)
    } finally {
      isLoading.value = false
    }
  }

  function logout() {
    useCollectionStore().clearStore()
    user.value = null
    accessToken.value = null
    clearStoredAuth()
  }

  return {
    user,
    accessToken,
    isLoading,
    isAuthenticated,
    authHeaders,
    login,
    logout,
  }
})

type StoredAuth = {
  user: AuthUser | null
  accessToken: string | null
}

function getStoredAuth(): StoredAuth {
  const persistentAuth = readAuth(localStorage)
  if (persistentAuth.user && persistentAuth.accessToken) {
    return persistentAuth
  }

  const legacyAuth = readAuth(sessionStorage)
  if (!legacyAuth.user || !legacyAuth.accessToken) {
    return { user: null, accessToken: null }
  }

  // Preserve existing logins when upgrading from session-only persistence.
  persistAuth(legacyAuth.user, legacyAuth.accessToken)
  removeAuth(sessionStorage)
  return legacyAuth
}

function readAuth(storage: Storage): StoredAuth {
  try {
    const storedUser = storage.getItem(AUTH_STORAGE_KEY)
    const storedToken = storage.getItem(AUTH_TOKEN_STORAGE_KEY)
    const user = storedUser ? JSON.parse(storedUser) : null

    return {
      user: user && typeof user === 'object' ? user : null,
      accessToken: typeof storedToken === 'string' && storedToken.length > 0 ? storedToken : null,
    }
  } catch {
    return { user: null, accessToken: null }
  }
}

function persistAuth(user: AuthUser, accessToken: string) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, accessToken)
  } catch {}
}

function clearStoredAuth() {
  removeAuth(localStorage)
  removeAuth(sessionStorage)
}

function removeAuth(storage: Storage) {
  try {
    storage.removeItem(AUTH_STORAGE_KEY)
    storage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {}
}
