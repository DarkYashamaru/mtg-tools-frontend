import { ref, type Ref, type ComputedRef } from 'vue'
import type { CollectionRecord } from '@/components/collection/types'
import type { GameplayCard } from '@/types/gameplayCard'
import { useCollectionStore } from '@/stores/collectionStore'
import {
  enrichCollectionWithGameplay,
  mergeCollectionMetadata as mergeMetadata,
} from './collectionMetadata'

interface Options {
  collection: Ref<CollectionRecord | null>
  collectionId: ComputedRef<string>
  isMasterCollectionRoute: ComputedRef<boolean>
  authHeaders: ComputedRef<Record<string, string>>
  onUnauthorized: () => Promise<void>
  onBeforeLoad: () => void
  onLoaded: () => Promise<void>
}

export function useCollectionData({
  collection,
  collectionId,
  isMasterCollectionRoute,
  authHeaders,
  onUnauthorized,
  onBeforeLoad,
  onLoaded,
}: Options) {
  const isLoading = ref(true)

  const loadErrorMessage = ref('')
  const collectionStore = useCollectionStore()
  function syncSavedCollectionSnapshot() {
    if (isMasterCollectionRoute.value || !collection.value) return

    const cards = collection.value.items
      .map((item) => item.gameplay_card)
      .filter((card): card is GameplayCard => Boolean(card))

    collectionStore.setSavedCollection(collection.value, cards)
  }
  async function loadCollection() {
    isLoading.value = true

    loadErrorMessage.value = ''
    onBeforeLoad()

    try {
      const collectionEndpoint =
        isMasterCollectionRoute.value
          ? '/api/collections/master'
          : `/api/collections/${collectionId.value}`

      const response = await fetch(
        collectionEndpoint,
        {
          headers: {
            ...authHeaders.value,
          },
        },
      )

      const data = await response
        .json()
        .catch(() => ({}))

      if (response.status === 401) {
        await onUnauthorized()

        return
      }

      if (
        !response.ok ||
        !data.success ||
        !data.collection
      ) {
        throw new Error(
          data.error ||
            'Unable to load collection workspace.',
        )
      }

      const loadedCollection =
        data.collection as CollectionRecord

      collection.value =
        await enrichCollectionWithGameplay(
          loadedCollection,
        )

      await onLoaded()
    } catch (error) {
      loadErrorMessage.value =
        error instanceof Error
          ? error.message
          : 'Unable to load collection workspace.'
    } finally {
      isLoading.value = false
    }
  }
  function mergeCollectionMetadata(updated: CollectionRecord) {
    return mergeMetadata(updated, collection.value)
  }

  return {
    isLoading,
    loadErrorMessage,
    loadCollection,
    syncSavedCollectionSnapshot,
    mergeCollectionMetadata,
  }
}
