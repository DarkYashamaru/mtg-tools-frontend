import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

type AuthUser = Record<string, unknown>

type LoginPayload = {
  username: string
  password: string
}

const AUTH_STORAGE_KEY = 'mtg_auth_user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(getStoredUser())
  const isLoading = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  async function login(payload: LoginPayload) {
    isLoading.value = true

    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok || !data.success || !data.user) {
        throw new Error(data.error || 'Unable to log in.')
      }

      user.value = data.user
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user))
    } finally {
      isLoading.value = false
    }
  }

  function logout() {
    user.value = null
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
  }

  return {
    user,
    isLoading,
    isAuthenticated,
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
