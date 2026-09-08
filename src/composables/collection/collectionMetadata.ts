import type { CollectionRecord, CollectionItem } from '@/components/collection/types'
import type { GameplayCard } from '@/types/gameplayCard'

export function mergeCollectionMetadata(
  updatedCollection: CollectionRecord,
  currentCollection: CollectionRecord | null,
): CollectionRecord {

  if (!currentCollection) {
    return updatedCollection
  }

  const currentItemsById = new Map(
    currentCollection.items.map(
      (item) => [item.id, item],
    ),
  )

  const currentItemsByCardZone = new Map(
    currentCollection.items.map(
      (item) => [
        `${item.card_id}:${item.zone}`,
        item,
      ],
    ),
  )

  return {
    ...updatedCollection,

    items: updatedCollection.items.map(
      (item) => {
        const existingItem =
          currentItemsById.get(item.id) ??
          currentItemsByCardZone.get(
            `${item.card_id}:${item.zone}`,
          )

        return {
          ...item,

          cmc:
            existingItem?.cmc ??
            item.cmc ??
            0,

          card_types:
            existingItem?.card_types ??
            item.card_types ??
            [],

          categories:
            existingItem?.categories ??
            item.categories ??
            [],

          archetypes:
            existingItem?.archetypes ??
            item.archetypes ??
            [],

          gameplay_card:
            existingItem?.gameplay_card ??
            item.gameplay_card,
        }
      },
    ),
  }
}

function buildItemMetadata(
  gameplayCard: GameplayCard | undefined,
) {
  return {
    cmc: gameplayCard?.cmc ?? 0,

    card_types: Array.from(
      new Set(
        gameplayCard?.faces.flatMap(
          (face) =>
            face.card_types ?? [],
        ) ?? [],
      ),
    ),

    categories:
      gameplayCard?.categories ?? [],

    archetypes:
      gameplayCard?.archetypes ?? [],

    gameplay_card: gameplayCard,
  }
}

async function fetchGameplayCardsByOracleId(
  items: CollectionItem[],
) {
  const oracleIds = Array.from(
    new Set(
      items
        .map((item) => item.oracle_id?.trim())
        .filter(
          (value): value is string =>
            Boolean(value),
        ),
    ),
  )

  if (oracleIds.length === 0) {
    return new Map<string, GameplayCard>()
  }

  const gameplayResponse = await fetch(
    '/api/deck-cards',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        oracle_ids: oracleIds,
      }),
    },
  )

  const gameplayPayload =
    await gameplayResponse
      .json()
      .catch(() => ({}))

  if (
    !gameplayResponse.ok ||
    !gameplayPayload.success ||
    !Array.isArray(gameplayPayload.cards)
  ) {
    const missingIds = Array.isArray(
      gameplayPayload.missing_oracle_ids,
    )
      ? gameplayPayload.missing_oracle_ids.filter(
          (value: unknown): value is string =>
            typeof value === 'string',
        )
      : []
    const namesByOracleId = new Map(
      items
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
        : gameplayPayload.error ||
          'Unable to load gameplay data for this collection.',
    )
  }

  return new Map(
    (
      gameplayPayload.cards as GameplayCard[]
    ).map(
      (card) => [
        card.oracle_id,
        card,
      ],
    ),
  )
}

export async function enrichCollectionWithGameplay(
  baseCollection: CollectionRecord,
  metadataSource: CollectionRecord | null = null,
) {
  const existingMetadataByOracleId =
    new Map(
      (metadataSource?.items ?? [])
        .filter((item) => item.oracle_id)
        .map((item) => [
          item.oracle_id as string,

          {
            cmc: item.cmc ?? 0,
            card_types:
              item.card_types ?? [],
            categories:
              item.categories ?? [],
            archetypes:
              item.archetypes ?? [],
            gameplay_card:
              item.gameplay_card,
          },
        ]),
    )

  const missingItems =
    baseCollection.items.filter(
      (item) =>
        Boolean(item.oracle_id) &&
        !existingMetadataByOracleId.get(
          item.oracle_id as string,
        )?.gameplay_card &&
        Boolean(item.name),
    )

  const fetchedGameplayByOracleId =
    missingItems.length > 0
      ? await fetchGameplayCardsByOracleId(
          missingItems,
        )
      : new Map<string, GameplayCard>()

  return {
    ...baseCollection,

    items: baseCollection.items.map(
      (item) => {
        const existingMetadata =
          item.oracle_id
            ? existingMetadataByOracleId.get(
                item.oracle_id,
              )
            : undefined

        const gameplayCard =
          existingMetadata?.gameplay_card ??
          (item.oracle_id
            ? fetchedGameplayByOracleId.get(
                item.oracle_id,
              )
            : undefined)

        return {
          ...item,

          ...(existingMetadata?.gameplay_card
            ? existingMetadata
            : buildItemMetadata(gameplayCard)),
        }
      },
    ),
  }
}
