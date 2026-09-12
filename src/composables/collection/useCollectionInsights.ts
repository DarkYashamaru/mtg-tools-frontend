import { computed, ref, watch, type Ref, type ComputedRef } from 'vue'
import type {
  CollectionRecord,
  CollectionItem,
  CollectionLiveSynergy,
  CollectionProfileSection,
  WorkspaceOrganizationMode,
  DeckLegalityResult,
  CommanderDeckTemplateData,
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
  const liveSynergiesByOracleId = ref<Record<string, CollectionLiveSynergy[]>>({})
  const commanderTemplate = ref<CommanderDeckTemplateData | null>(null)

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
        const oracleId = item.oracle_id
        const score = oracleId
          ? commanderScoresByOracleId.value[oracleId]
          : undefined
        const liveSynergies = oracleId
          ? liveSynergiesByOracleId.value[oracleId]
          : undefined

        return score || liveSynergies?.length
          ? {
              ...item,
              ...(score
                ? {
                    commander_support_score: score.score,
                    commander_support_reasons: score.reasons,
                    score_breakdown: score.score_breakdown,
                  }
                : {}),
              ...(liveSynergies?.length
                ? { live_synergies: liveSynergies }
                : {}),
            }
          : item
      }),
    }
  })

  async function loadCommanderTemplate() {
    if (!collection.value || !isCommanderCollection.value || isMasterCollectionRoute.value || !collection.value.commander_oracle_id) { commanderTemplate.value = null; return }
    try {
      const response = await fetch(`/api/commander-template/${collection.value.id}/${collection.value.commander_oracle_id}`, { headers: { ...authHeaders.value } })
      if (response.status === 401) { await onUnauthorized(); return }
      const data = await response.json().catch(() => ({}))
      commanderTemplate.value = response.ok && data.success && data.template ? data.template as CommanderDeckTemplateData : null
    } catch { commanderTemplate.value = null }
  }

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
      liveSynergiesByOracleId.value = {}
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
    const activeDeckOracleIds = Array.from(
      new Set(
        collection.value.items
          .filter((item) => item.zone === 'commander' || item.zone === 'mainboard')
          .map((item) => item.oracle_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )

    if (oracleIds.length === 0) {
      commanderScoresByOracleId.value = {}
      liveSynergiesByOracleId.value = {}
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
            live_oracle_ids: activeDeckOracleIds,
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

      if (response.ok && data.success && data.scores) {
        commanderScoresByOracleId.value = data.scores
        const namesByOracleId = new Map(
          collection.value.items
            .filter((item) => item.oracle_id)
            .map((item) => [item.oracle_id as string, item.name || 'Unknown card']),
        )
        liveSynergiesByOracleId.value = Object.fromEntries(
          Object.entries(data.live_synergies ?? {}).map(([oracleId, groups]) => [
            oracleId,
            (groups as Omit<CollectionLiveSynergy, 'partner_names'>[]).map((group) => ({
              ...group,
              partner_names: group.partner_oracle_ids
                .map((partnerId) => namesByOracleId.get(partnerId))
                .filter((name): name is string => Boolean(name)),
            })),
          ]),
        )
      } else {
        commanderScoresByOracleId.value = {}
        liveSynergiesByOracleId.value = {}
      }
    } catch {
      /**
       * Scoring is supplementary.
       * Keep the collection usable without it.
       */
      commanderScoresByOracleId.value = {}
      liveSynergiesByOracleId.value = {}
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
    commanderTemplate,
    loadCommanderTemplate,
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
