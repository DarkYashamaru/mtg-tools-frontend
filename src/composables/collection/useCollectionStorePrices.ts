import { computed, ref, watch, onBeforeUnmount, type Ref, type ComputedRef } from 'vue'
import type { CollectionRecord } from '@/components/collection/types'

import { useAuthStore } from '@/stores/authStore'
import type { DracoPriceResponse } from '@/types/dracoPrice'

interface Options {
  collection: Ref<CollectionRecord | null>
  collectionId: ComputedRef<string>
  isCommanderCollection: ComputedRef<boolean>
  isReadOnlyCollection: ComputedRef<boolean>
  authHeaders: ComputedRef<Record<string, string>>
  errorMessage: Ref<string>
  onUnauthorized: () => Promise<void>
}

export function useCollectionStorePrices({
  collection,
  collectionId,
  isCommanderCollection,
  isReadOnlyCollection,
  authHeaders,
  errorMessage,
  onUnauthorized,
}: Options) {
  const authStore = useAuthStore()
  const STORE_PRICE_REFRESH_CARD_LIMIT = 300
  const isRefreshingStorePrices = ref(false)
  const storePriceRefreshProgress = ref('')
  let storePriceRefreshController: AbortController | null = null
  const collectionCardQuantity = computed(() =>
    collection.value?.items.reduce(
      (total, item) => total + item.amount,
      0,
    ) ?? 0,
  )

  const canRefreshStorePrices = computed(() =>
    isCommanderCollection.value
    && !isReadOnlyCollection.value
    && collectionCardQuantity.value <= STORE_PRICE_REFRESH_CARD_LIMIT,
  )

  const storePriceRefreshLimitMessage = computed(() =>
    isCommanderCollection.value &&
    !isReadOnlyCollection.value &&
    collectionCardQuantity.value > STORE_PRICE_REFRESH_CARD_LIMIT
      ? `Store prices cannot be refreshed because this collection has ${collectionCardQuantity.value} cards across all zones. The limit is ${STORE_PRICE_REFRESH_CARD_LIMIT}.`
      : '',
  )
  type StorePriceRefreshCard = {
    oracle_id: string
    name: string
  }

  type StoreName = 'draco' | 'vault'

  function stopStorePriceRefresh() {
    storePriceRefreshController?.abort()
    storePriceRefreshController = null
    isRefreshingStorePrices.value = false
    storePriceRefreshProgress.value = ''
  }

  function updateStorePriceInCollection(
    oracleId: string,
    store: StoreName,
    price: DracoPriceResponse,
  ) {
    if (!collection.value) return

    collection.value = {
      ...collection.value,
      items: collection.value.items.map((item) => {
        if (item.oracle_id !== oracleId || !item.gameplay_card) return item

        const gameplayCard = { ...item.gameplay_card }
        if (typeof price.price_cop === 'number') {
          if (store === 'draco') gameplayCard.dracostore_price_cop = price.price_cop
          else gameplayCard.vaultstore_price_cop = price.price_cop
        }
        if (store === 'draco') {
          gameplayCard.dracostore_last_updated = price.last_updated
          gameplayCard.dracostore_next_refresh_at = price.next_refresh_at
          gameplayCard.dracostore_price_stale = price.stale
        } else {
          gameplayCard.vaultstore_last_updated = price.last_updated
          gameplayCard.vaultstore_next_refresh_at = price.next_refresh_at
          gameplayCard.vaultstore_price_stale = price.stale
          gameplayCard.vaultstore_product_url = price.product_url ?? null
        }

        return { ...item, gameplay_card: gameplayCard }
      }),
    }
  }

  async function refreshCollectionStorePrices() {
    if (isRefreshingStorePrices.value || !canRefreshStorePrices.value || !collection.value) return

    const refreshCollectionId = collectionId.value
    const token = authStore.accessToken
    const run = new AbortController()
    storePriceRefreshController = run
    isRefreshingStorePrices.value = true
    errorMessage.value = ''
    storePriceRefreshProgress.value = 'Preparing store price refresh…'

    const isCurrent = () => (
      !run.signal.aborted
      && token === authStore.accessToken
      && refreshCollectionId === collectionId.value
    )

    try {
      const preflight = await fetch(
        `/api/collections/${encodeURIComponent(refreshCollectionId)}/store-price-refresh`,
        {
          method: 'POST',
          headers: { ...authHeaders.value },
          signal: run.signal,
        },
      )
      const payload = await preflight.json().catch(() => ({}))

      if (preflight.status === 401) {
        await onUnauthorized()
        return
      }
      if (!preflight.ok || !payload.success || !Array.isArray(payload.cards)) {
        throw new Error(payload.error || 'Unable to prepare the store price refresh.')
      }
      if (!isCurrent()) return

      const cards = payload.cards as StorePriceRefreshCard[]
      const queue = cards.flatMap((card) =>
        (['draco', 'vault'] as StoreName[]).map((store) => ({ card, store })),
      )
      const total = queue.length
      let completed = 0
      let updated = 0
      let cached = 0
      let unavailable = 0
      let failed = 0
      const renderProgress = () => {
        storePriceRefreshProgress.value = total === 0
          ? 'There are no cards with store price data to refresh.'
          : `${completed}/${total} store checks processed · ${updated} updated · ${cached} cached · ${unavailable} unavailable or stale${failed ? ` · ${failed} failed` : ''}`
      }
      renderProgress()

      async function worker() {
        while (queue.length && isCurrent()) {
          const task = queue.shift()
          if (!task) return
          try {
            const params = new URLSearchParams({ name: task.card.name })
            const response = await fetch(
              `/api/store-prices/${task.store}/${encodeURIComponent(task.card.oracle_id)}?${params}`,
              { signal: run.signal },
            )
            if (!response.ok) throw new Error('Store price check failed.')
            const price = await response.json() as DracoPriceResponse
            if (!isCurrent()) return

            updateStorePriceInCollection(task.card.oracle_id, task.store, price)
            if (price.cache_status === 'refreshed') updated += 1
            else if (price.cache_status === 'cached') cached += 1
            else unavailable += 1
          } catch (error) {
            if (isCurrent()) failed += 1
          } finally {
            if (isCurrent()) {
              completed += 1
              renderProgress()
            }
          }
        }
      }

      await Promise.all([worker(), worker()])
    } catch (error) {
      if (isCurrent()) {
        errorMessage.value = error instanceof Error
          ? error.message
          : 'Unable to refresh store prices.'
        storePriceRefreshProgress.value = ''
      }
    } finally {
      if (isCurrent()) {
        isRefreshingStorePrices.value = false
        storePriceRefreshController = null
      }
    }
  }
  watch(
    () => authStore.accessToken,
    () => stopStorePriceRefresh(),
  )
  onBeforeUnmount(stopStorePriceRefresh)

  return {
    isRefreshingStorePrices,
    storePriceRefreshProgress,
    canRefreshStorePrices,
    storePriceRefreshLimitMessage,
    refreshCollectionStorePrices,
    stopStorePriceRefresh,
  }
}
