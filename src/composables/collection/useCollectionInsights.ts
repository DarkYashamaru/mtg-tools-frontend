import { computed, ref, watch, type Ref, type ComputedRef } from 'vue'
import type {
  CollectionRecord,
  CollectionItem,
  CollectionProfileSection,
  WorkspaceOrganizationMode,
  DeckLegalityResult,
} from '@/components/collection/types'

interface Options {
  collection: Ref<CollectionRecord | null>
  isCommanderCollection: ComputedRef<boolean>
  isMasterCollectionRoute: ComputedRef<boolean>
  organizationMode: Ref<WorkspaceOrganizationMode>
  builderSourceCollectionId: ComputedRef<string>
  builderThemeId: ComputedRef<number>
  authHeaders: ComputedRef<Record<string, string>>
  errorMessage: Ref<string>
  onUnauthorized: () => Promise<void>
}

export function useCollectionInsights({
  collection,
  isCommanderCollection,
  isMasterCollectionRoute,
  organizationMode,
  builderSourceCollectionId,
  builderThemeId,
  authHeaders,
  errorMessage,
  onUnauthorized,
}: Options) {
  const isValidatingDeck = ref(false)
  const deckLegalityResult = ref<DeckLegalityResult | null>(null)
  const commanderScoresByOracleId = ref<
    Record<
      string,
      {
        score: number
        reasons: NonNullable<CollectionItem['commander_support_reasons']>
        score_breakdown?: NonNullable<CollectionItem['score_breakdown']>
      }
    >
  >({})

  type ProfileSectionMode = 'category' | 'type'

  const profileSectionsByMode = ref<
    Record<ProfileSectionMode, CollectionProfileSection[]>
  >({
    category: [],
    type: [],
  })
  let profileSectionsGeneration = 0

  const profileSections = computed(() => {
    if (organizationMode.value === 'category') {
      return profileSectionsByMode.value.category
    }

    if (organizationMode.value === 'type') {
      return profileSectionsByMode.value.type
    }

    return []
  })
  const scoredCollection = computed<CollectionRecord | null>(() => {
    if (!collection.value) {
      return null
    }

    if (!isCommanderCollection.value) {
      return collection.value
    }

    return {
      ...collection.value,
      items: collection.value.items.map((item) => {
        const score = item.oracle_id
          ? commanderScoresByOracleId.value[item.oracle_id]
          : undefined

        return score
          ? {
              ...item,
              commander_support_score: score.score,
              commander_support_reasons: score.reasons,
              score_breakdown: score.score_breakdown,
            }
          : item
      }),
    }
  })
  function invalidateProfileSections() {
    profileSectionsGeneration += 1
    profileSectionsByMode.value = {
      category: [],
      type: [],
    }
  }
  async function loadCommanderScores() {
    if (
      !collection.value ||
      !isCommanderCollection.value ||
      !collection.value.commander_oracle_id
    ) {
      commanderScoresByOracleId.value = {}
      return
    }

    const oracleIds = Array.from(
      new Set(
        collection.value.items
          .map((item) => item.oracle_id)
          .filter(
            (id): id is string =>
              Boolean(id),
          ),
      ),
    )

    if (oracleIds.length === 0) {
      commanderScoresByOracleId.value = {}
      return
    }

    const fetchScores = async (
      sourceCollectionId: string,
    ) => {
      const response = await fetch(
        `/api/commander-builder-source/${sourceCollectionId}/${collection.value!.commander_oracle_id}/scores`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
            ...authHeaders.value,
          },

          body: JSON.stringify({
            oracle_ids: oracleIds,
            theme_id: builderThemeId.value,
          }),
        },
      )

      const data = await response
        .json()
        .catch(() => ({}))

      return {
        response,
        data,
      }
    }

    try {
      let { response, data } =
        await fetchScores(
          builderSourceCollectionId.value,
        )

      if (
        response.status === 404 &&
        builderSourceCollectionId.value !==
          'master'
      ) {
        ;({ response, data } =
          await fetchScores('master'))
      }

      commanderScoresByOracleId.value =
        response.ok &&
        data.success &&
        data.scores
          ? data.scores
          : {}
    } catch {
      /**
       * Scoring is supplementary.
       * Keep the collection usable without it.
       */
      commanderScoresByOracleId.value = {}
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Profile sections                                                           */
  /* -------------------------------------------------------------------------- */

  async function loadProfileSections(
    mode: ProfileSectionMode,
  ) {
    if (!collection.value) {
      profileSectionsByMode.value = {
        category: [],
        type: [],
      }
      return
    }

    const generation = profileSectionsGeneration

    const endpoint =
      isMasterCollectionRoute.value
        ? '/api/collections/master/sections'
        : `/api/collections/${collection.value.id}/sections`

    async function loadGroup(
      profileGroup: 'categories' | 'types',
    ): Promise<CollectionProfileSection[]> {
      try {
        const response = await fetch(
          `${endpoint}?profile_group=${profileGroup}`,
          {
            headers: {
              ...authHeaders.value,
            },
          },
        )

        const data = await response
          .json()
          .catch(() => ({}))

        return response.ok &&
          data.success &&
          Array.isArray(data.sections)
          ? (data.sections as CollectionProfileSection[])
          : []
      } catch {
        /**
         * Section organization is supplementary.
         * Keep the flat collection usable.
         */
        return []
      }
    }

    const profileGroup = mode === 'category' ? 'categories' : 'types'
    const sections = await loadGroup(profileGroup)

    if (generation !== profileSectionsGeneration) return

    profileSectionsByMode.value = {
      ...profileSectionsByMode.value,
      [mode]: sections,
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Deck validation                                                            */
  /* -------------------------------------------------------------------------- */

  async function validateDeck() {
    if (
      !collection.value ||
      isValidatingDeck.value
    ) {
      return
    }

    isValidatingDeck.value = true
    errorMessage.value = ''

    try {
      const response = await fetch(
        `/api/collections/${collection.value.id}/validate-legality`,
        {
          method: 'POST',

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
        !data.validation
      ) {
        throw new Error(
          data.error ||
            'Unable to validate this deck.',
        )
      }

      deckLegalityResult.value =
        data.validation as DeckLegalityResult
    } catch (error) {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : 'Unable to validate this deck.'
    } finally {
      isValidatingDeck.value = false
    }
  }
  watch(
    organizationMode,
    (mode) => {
      if (mode === 'zone' || !collection.value) return
      const current = profileSectionsByMode.value[mode]
      if (current.length === 0) void loadProfileSections(mode)
    },
  )

  return {
    commanderScoresByOracleId,
    scoredCollection,
    profileSections,
    invalidateProfileSections,
    loadProfileSections,
    loadCommanderScores,
    isValidatingDeck,
    deckLegalityResult,
    validateDeck,
  }
}
