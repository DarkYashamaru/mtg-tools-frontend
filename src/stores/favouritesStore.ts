import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './authStore'

export const useFavouritesStore = defineStore('favourites', () => {
  const auth = useAuthStore()
  const ids = ref<Set<string>>(new Set())
  const pending = ref<Set<string>>(new Set())
  const loaded = ref(false)
  const error = ref('')
  let generation = 0
  let loading: Promise<void> | null = null

  watch(() => auth.accessToken, () => {
    generation++
    ids.value = new Set()
    pending.value = new Set()
    loaded.value = false
    error.value = ''
    loading = null
  }, { flush: 'sync' })

  async function request(path: string, method = 'GET') {
    const token = auth.accessToken
    const response = await fetch(path, { method, headers: auth.authHeaders })
    if (token !== auth.accessToken) throw new Error('Session changed.')
    if (response.status === 401) {
      auth.logout()
      throw new Error('Your session expired. Please log in again.')
    }
    if (!response.ok) throw new Error(method === 'GET'
      ? 'Unable to load favorites. Please retry.'
      : 'Unable to update favorites. Please retry.')
    return response
  }

  async function load() {
    if (!auth.isAuthenticated || loaded.value) return
    if (loading) return loading
    const current = generation
    const task = (async () => {
      try {
        error.value = ''
        const response = await request('/api/favourites/ids')
        const data = await response.json()
        if (current !== generation) return
        ids.value = new Set(data.oracle_ids)
        loaded.value = true
      } catch (err) {
        if (current === generation) error.value = (err as Error).message
      } finally {
        if (current === generation) loading = null
      }
    })()
    loading = task
    return task
  }

  async function toggle(id: string) {
    if (!auth.isAuthenticated || pending.value.has(id)) return false
    await load()
    if (pending.value.has(id) || !auth.isAuthenticated) return false
    if (!loaded.value) throw new Error(error.value || 'Unable to load favorites.')
    const current = generation
    const removing = ids.value.has(id)
    pending.value.add(id)
    try {
      await request(`/api/favourites/${encodeURIComponent(id)}`, removing ? 'DELETE' : 'PUT')
      if (current !== generation) return false
      if (removing) ids.value.delete(id)
      else ids.value.add(id)
      return true
    } finally {
      if (current === generation) pending.value.delete(id)
    }
  }

  return { ids, pending, loaded, error, load, toggle, request }
})
