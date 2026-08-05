import type { ComputedRef } from 'vue'
import type { Router } from 'vue-router'
import type { Card } from '@/utils/deckScorer'
import type { CollectionRecord } from '@/components/collection/types'
import { useAuthStore } from '@/stores/authStore'

type AuthHeadersRef = ComputedRef<Record<string, string>>

type LoadSavedCollectionGameplayOptions = {
  collectionId: string
  authHeaders: AuthHeadersRef
  routePath: string
  router: Router
}

export async function loadSavedCollectionGameplay({
  collectionId,
  authHeaders,
  routePath,
  router,
}: LoadSavedCollectionGameplayOptions): Promise<{
  collection: CollectionRecord
  cards: Card[]
}> {
  const authStore = useAuthStore()

  const collectionResponse = await fetch(`/api/collections/${collectionId}`, {
    headers: {
      ...authHeaders.value,
    },
  })

  const collectionPayload = await collectionResponse.json().catch(() => ({}))

  if (collectionResponse.status === 401) {
    authStore.logout()
    await router.replace({
      name: 'login',
      query: { redirect: routePath },
    })
    throw new Error('Authentication required.')
  }

  if (!collectionResponse.ok || !collectionPayload.success || !collectionPayload.collection) {
    throw new Error(collectionPayload.error || 'Unable to load the selected collection.')
  }

  const selectedCollection = collectionPayload.collection as CollectionRecord
  const deckText = selectedCollection.items
    .flatMap((item) => {
      if (!item.name || item.amount < 1) {
        return []
      }

      return Array.from({ length: item.amount }, () => `1 ${item.name}`)
    })
    .join('\n')

  if (!deckText) {
    throw new Error('This collection has no importable card names.')
  }

  const cardsResponse = await fetch('/api/deck-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deck_text: deckText }),
  })

  const cardsPayload = await cardsResponse.json().catch(() => ({}))

  if (!cardsResponse.ok || !cardsPayload.success || !Array.isArray(cardsPayload.cards)) {
    throw new Error(cardsPayload.error || 'Unable to load gameplay cards for this collection.')
  }

  return {
    collection: selectedCollection,
    cards: cardsPayload.cards as Card[],
  }
}
