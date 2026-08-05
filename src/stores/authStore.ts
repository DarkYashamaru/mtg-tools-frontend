import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

type AuthUser = Record<string, unknown>

type LoginPayload = {
  username: string
  password: string
}

const AUTH_STORAGE_KEY = 'mtg_auth_user'
const AUTH_TOKEN_STORAGE_KEY = 'mtg_auth_token'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(getStoredUser())
  const accessToken = ref<string | null>(getStoredToken())
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
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user))
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.access_token)
    } finally {
      isLoading.value = false
    }
  }

  function logout() {
    user.value = null
    accessToken.value = null
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
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

function getStoredUser(): AuthUser | null {
  try {
    const storedUser = sessionStorage.getItem(AUTH_STORAGE_KEY)

    if (!storedUser) {
      return null
    }

    const parsedUser = JSON.parse(storedUser)
    return parsedUser && typeof parsedUser === 'object' ? parsedUser : null
  } catch {
    return null
  }
}

function getStoredToken(): string | null {
  try {
    const storedToken = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    return typeof storedToken === 'string' && storedToken.length > 0 ? storedToken : null
  } catch {
    return null
  }
}
