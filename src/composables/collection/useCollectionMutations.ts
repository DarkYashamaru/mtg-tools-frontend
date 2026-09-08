import { ref, type Ref, type ComputedRef } from 'vue'
import type { CollectionRecord, CollectionItem, DeckLegalityResult } from '@/components/collection/types'

import { enrichCollectionWithGameplay } from './collectionMetadata'

interface Options {
  collection: Ref<CollectionRecord | null>
  isReadOnlyCollection: ComputedRef<boolean>
  isCommanderCollection: ComputedRef<boolean>
  authHeaders: ComputedRef<Record<string, string>>
  errorMessage: Ref<string>
  hoveredItem: Ref<CollectionItem | null>
  printPickerItem: Ref<CollectionItem | null>
  deckLegalityResult: Ref<DeckLegalityResult | null>
  isSourceBrowserOpen: Ref<boolean>
  onUnauthorized: () => Promise<void>
  closeContextMenu: () => void
  mergeCollectionMetadata: (updated: CollectionRecord) => CollectionRecord
  refreshCollectionSupplementaryData: () => Promise<void>
}

export function useCollectionMutations({
  collection,
  isReadOnlyCollection,
  isCommanderCollection,
  authHeaders,
  errorMessage,
  hoveredItem,
  printPickerItem,
  deckLegalityResult,
  isSourceBrowserOpen,
  onUnauthorized,
  closeContextMenu,
  mergeCollectionMetadata,
  refreshCollectionSupplementaryData,
}: Options) {

  const isReplacingPrint = ref(false)

  const mutatingItemIds = ref<Array<string | number>>([])
  const isMutatingCommander = ref(false)
  function beginItemMutation(
    itemId: string | number,
  ) {
    mutatingItemIds.value = [
      ...new Set([
        ...mutatingItemIds.value,
        itemId,
      ]),
    ]
  }

  function endItemMutation(
    itemId: string | number,
  ) {
    mutatingItemIds.value =
      mutatingItemIds.value.filter(
        (id) => id !== itemId,
      )
  }

  async function mutateItemQuantity(
    item: CollectionItem,
    direction: 'increment' | 'decrement',
  ) {
    if (
      !collection.value ||
      isReadOnlyCollection.value
    ) {
      return
    }

    beginItemMutation(item.id)

    errorMessage.value = ''
    closeContextMenu()

    try {
      const response =
        direction === 'increment'
          ? await fetch(
              `/api/collections/${collection.value.id}/items`,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                  ...authHeaders.value,
                },

                body: JSON.stringify({
                  card_id: item.card_id,
                  zone: item.zone,
                  amount: 1,
                }),
              },
            )
          : await fetch(
              `/api/collections/${collection.value.id}/items/${item.id}?amount=1`,
              {
                method: 'DELETE',

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
            'Unable to update collection item.',
        )
      }

      const updatedCollection =
        mergeCollectionMetadata(
          data.collection as CollectionRecord,
        )

      collection.value = updatedCollection

      await refreshCollectionSupplementaryData()

      deckLegalityResult.value = null

      hoveredItem.value =
        updatedCollection.items.find(
          (candidate) =>
            candidate.id === item.id,
        ) ?? null
    } catch (error) {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : 'Unable to update collection item.'
    } finally {
      endItemMutation(item.id)
    }
  }
  async function moveItemToZone(
    item: CollectionItem,
    zone: 'mainboard' | 'maybeboard',
  ) {
    if (
      !collection.value ||
      isReadOnlyCollection.value ||
      !isCommanderCollection.value
    ) {
      return
    }

    beginItemMutation(item.id)

    errorMessage.value = ''
    closeContextMenu()

    try {
      const response = await fetch(
        `/api/collections/${collection.value.id}/items/${item.id}/zone`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
            ...authHeaders.value,
          },

          body: JSON.stringify({
            zone,
          }),
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
            'Unable to move collection item.',
        )
      }

      const updatedCollection =
        mergeCollectionMetadata(
          data.collection as CollectionRecord,
        )

      collection.value = updatedCollection

      await refreshCollectionSupplementaryData()

      deckLegalityResult.value = null
    } catch (error) {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : 'Unable to move collection item.'
    } finally {
      endItemMutation(item.id)
    }
  }
  async function addCardToMainboard(
    cardId: string,
  ) {
    if (
      !collection.value ||
      isReadOnlyCollection.value
    ) {
      return
    }

    const response = await fetch(
      `/api/collections/${collection.value.id}/items`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
          ...authHeaders.value,
        },

        body: JSON.stringify({
          card_id: cardId,
          zone: 'mainboard',
          amount: 1,
        }),
      },
    )

    const data = await response
      .json()
      .catch(() => ({}))

    if (response.status === 401) {
      await onUnauthorized()

      throw new Error(
        'Authentication required.',
      )
    }

    if (
      !response.ok ||
      !data.success ||
      !data.collection
    ) {
      throw new Error(
        data.error ||
          'Unable to add card to collection.',
      )
    }

    const mergedCollection =
      mergeCollectionMetadata(
        data.collection as CollectionRecord,
      )

    collection.value =
      await enrichCollectionWithGameplay(
        mergedCollection,
        collection.value,
      )

    await refreshCollectionSupplementaryData()

    deckLegalityResult.value = null
  }
  async function replacePrint(
    cardId: string,
  ) {
    const item = printPickerItem.value

    if (
      !collection.value ||
      !item ||
      isReplacingPrint.value
    ) {
      return
    }

    isReplacingPrint.value = true
    errorMessage.value = ''

    try {
      const response = await fetch(
        `/api/collections/${collection.value.id}/items/${item.id}/print`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
            ...authHeaders.value,
          },

          body: JSON.stringify({
            card_id: cardId,
          }),
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
            'Unable to replace printing.',
        )
      }

      const updated =
        mergeCollectionMetadata(
          data.collection as CollectionRecord,
        )

      collection.value =
        await enrichCollectionWithGameplay(
          updated,
          collection.value,
        )

      printPickerItem.value = null
      hoveredItem.value = null
      deckLegalityResult.value = null

      await refreshCollectionSupplementaryData()
    } catch (error) {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : 'Unable to replace printing.'
    } finally {
      isReplacingPrint.value = false
    }
  }
  async function mutateCommander(
    item: CollectionItem,
    action: 'set' | 'remove',
  ) {
    if (
      !collection.value ||
      isReadOnlyCollection.value ||
      isMutatingCommander.value
    ) {
      return
    }

    isMutatingCommander.value = true

    errorMessage.value = ''
    closeContextMenu()

    try {
      const response =
        action === 'set'
          ? await fetch(
              `/api/collections/${collection.value.id}/commander`,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                  ...authHeaders.value,
                },

                body: JSON.stringify({
                  item_id: item.id,
                }),
              },
            )
          : await fetch(
              `/api/collections/${collection.value.id}/commander/${item.id}`,
              {
                method: 'DELETE',

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
            'Unable to update commander.',
        )
      }

      const updated =
        mergeCollectionMetadata(
          data.collection as CollectionRecord,
        )

      collection.value =
        await enrichCollectionWithGameplay(
          updated,
          collection.value,
        )

      isSourceBrowserOpen.value = false
      deckLegalityResult.value = null

      await refreshCollectionSupplementaryData()
    } catch (error) {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : 'Unable to update commander.'
    } finally {
      isMutatingCommander.value = false
    }
  }

  return {
    mutatingItemIds,
    isMutatingCommander,
    isReplacingPrint,
    mutateItemQuantity,
    moveItemToZone,
    addCardToMainboard,
    replacePrint,
    mutateCommander,
  }
}
