import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import type { CollectionCardSearchResult } from '@/components/collection/types'

interface Options {
  errorMessage: Ref<string>
}

export function useCollectionCardSearch({ errorMessage }: Options) {
  const addCardQuery = ref('')
  const addCardSuggestions = ref<CollectionCardSearchResult[]>([])

  const isSearchingCards = ref(false)
  let addCardSearchTimeout: ReturnType<typeof window.setTimeout> | null = null
  let addCardSearchController: AbortController | null = null
  let latestAddCardSearchRequest = 0
  function dismissAddCardSuggestions() {
    addCardSuggestions.value = []
  }

  async function searchAddCardSuggestions(
    query: string,
    requestId: number,
  ) {
    addCardSearchController?.abort()

    const controller =
      new AbortController()

    addCardSearchController = controller
    isSearchingCards.value = true

    try {
      const response = await fetch(
        `/api/cards/search?q=${encodeURIComponent(query)}&limit=8&include_tokens=false`,
        {
          signal: controller.signal,
        },
      )

      const data = await response
        .json()
        .catch(() => ({}))

      if (
        requestId !==
        latestAddCardSearchRequest
      ) {
        return
      }

      if (
        !response.ok ||
        !data.success ||
        !Array.isArray(data.cards)
      ) {
        throw new Error(
          data.error ||
            'Unable to search cards.',
        )
      }

      addCardSuggestions.value =
        data.cards as CollectionCardSearchResult[]
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'AbortError'
      ) {
        return
      }

      if (
        requestId ===
        latestAddCardSearchRequest
      ) {
        addCardSuggestions.value = []

        errorMessage.value =
          error instanceof Error
            ? error.message
            : 'Unable to search cards.'
      }
    } finally {
      if (
        requestId ===
          latestAddCardSearchRequest &&
        addCardSearchController === controller
      ) {
        isSearchingCards.value = false
        addCardSearchController = null
      }
    }
  }
  watch(
    addCardQuery,
    (value) => {
      const query = value.trim()

      if (
        addCardSearchTimeout !== null
      ) {
        window.clearTimeout(
          addCardSearchTimeout,
        )

        addCardSearchTimeout = null
      }

      if (query.length < 3) {
        latestAddCardSearchRequest += 1

        addCardSearchController?.abort()
        addCardSearchController = null

        isSearchingCards.value = false

        dismissAddCardSuggestions()

        return
      }

      addCardSearchTimeout =
        window.setTimeout(() => {
          latestAddCardSearchRequest += 1

          void searchAddCardSuggestions(
            query,
            latestAddCardSearchRequest,
          )
        }, 250)
    },
  )
  onBeforeUnmount(() => {
    if (addCardSearchTimeout !== null) window.clearTimeout(addCardSearchTimeout)
    addCardSearchController?.abort()
  })

  return { addCardQuery, addCardSuggestions, isSearchingCards, dismissAddCardSuggestions }
}
