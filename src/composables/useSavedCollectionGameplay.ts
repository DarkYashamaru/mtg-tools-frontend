import type { ComputedRef } from 'vue'
import type { Router } from 'vue-router'
import type { Card } from '@/utils/deckScorer'
import type { CollectionRecord } from '@/components/collection/types'
import { useAuthStore } from '@/stores/authStore'
import { useCollectionStore } from '@/stores/collectionStore'

type AuthHeadersRef = ComputedRef<Record<string, string>>

function dedupeGameplayCards(cards: Card[]): Card[] {
  const uniqueCards = new Map<string, Card>()

  for (const card of cards) {
    if (!card?.oracle_id || uniqueCards.has(card.oracle_id)) {
      continue
    }

    uniqueCards.set(card.oracle_id, card)
  }

  return Array.from(uniqueCards.values())
}

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
  const collectionStore = useCollectionStore()
  const cached = collectionStore.getSavedCollection(collectionId)

  if (cached) {
    return cached
  }

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
  const oracleIds = Array.from(
    new Set(
      selectedCollection.items
        .map((item) => item.oracle_id?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  )

  if (oracleIds.length === 0) {
    throw new Error('This collection has no cards with Oracle IDs.')
  }

  const cardsResponse = await fetch('/api/deck-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oracle_ids: oracleIds }),
  })

  const cardsPayload = await cardsResponse.json().catch(() => ({}))

  if (!cardsResponse.ok || !cardsPayload.success || !Array.isArray(cardsPayload.cards)) {
    const missingIds = Array.isArray(cardsPayload.missing_oracle_ids)
      ? cardsPayload.missing_oracle_ids.filter(
          (value: unknown): value is string => typeof value === 'string',
        )
      : []
    const namesByOracleId = new Map(
      selectedCollection.items
        .filter((item) => item.oracle_id)
        .map((item) => [
          item.oracle_id as string,
          item.name || 'Unknown card',
        ]),
    )
    const missingLabels = missingIds.map(
      (oracleId: string) =>
        `${namesByOracleId.get(oracleId) || 'Unknown card'} (${oracleId})`,
    )

    throw new Error(
      missingLabels.length > 0
        ? `Gameplay data is missing for: ${missingLabels.join(', ')}`
        : cardsPayload.error || 'Unable to load gameplay cards for this collection.',
    )
  }

  const result = {
    collection: selectedCollection,
    cards: dedupeGameplayCards(cardsPayload.cards as Card[]),
  }

  collectionStore.setSavedCollection(result.collection, result.cards)
  return result
}
