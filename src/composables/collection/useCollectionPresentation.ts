import { computed, ref, watch, type Ref, type ComputedRef } from 'vue'
import type {
  CollectionRecord,
  CollectionSortKey,
  CollectionSortDirection,
  CommanderWorkspaceMode,
  WorkspaceOrganizationMode,
  WorkspaceViewMode,
} from '@/components/collection/types'

import {
  collectionFacetOptions,
  matchesCollectionFacets,
  type CollectionFacetFilters,
} from '@/components/collection/filtering'
import { sortCollectionItems } from '@/components/collection/sorting'

interface Options {
  organizationMode: Ref<WorkspaceOrganizationMode>
  collection: Ref<CollectionRecord | null>
  scoredCollection: ComputedRef<CollectionRecord | null>
}

export function useCollectionPresentation({ collection, scoredCollection, organizationMode }: Options) {
  const filterText = ref('')
  const colorFilters = ref<string[]>([])
  const supertypeFilters = ref<string[]>([])
  const cardTypeFilters = ref<string[]>([])
  const subtypeFilters = ref<string[]>([])

  const viewMode = ref<WorkspaceViewMode>('list')
  const sortKey = ref<CollectionSortKey>('name')
  const sortDirection = ref<CollectionSortDirection>('asc')

  const commanderWorkspaceMode = ref<CommanderWorkspaceMode>('normal')
  const collectionFacetFilters = computed<CollectionFacetFilters>(
    () => ({
      colors: colorFilters.value,
      supertypes: supertypeFilters.value,
      cardTypes: cardTypeFilters.value,
      subtypes: subtypeFilters.value,
    }),
  )

  const facetOptions = computed(() =>
    collectionFacetOptions(collection.value?.items ?? []),
  )
  const hasSortableScores = computed(
    () =>
      scoredCollection.value?.items.some(
        (item) =>
          item.commander_support_score !== undefined,
      ) ?? false,
  )

  const filteredCollection = computed<CollectionRecord | null>(() => {
    if (!scoredCollection.value) {
      return null
    }

    const query = filterText.value.trim().toLowerCase()

    const matchingItems = scoredCollection.value.items.filter(
      (item) => {
        const haystack = [
          item.name ?? '',
          item.set_code ?? '',
          item.collector_number ?? '',
          item.lang ?? '',
          item.zone ?? '',
          ...(item.categories ?? []).map(
            (category) => category.name,
          ),
          ...(item.archetypes ?? []).map(
            (archetype) => archetype.name,
          ),
        ]
          .join(' ')
          .toLowerCase()

        return (
          haystack.includes(query) &&
          matchesCollectionFacets(
            item,
            collectionFacetFilters.value,
          )
        )
      },
    )

    return {
      ...scoredCollection.value,
      items: sortCollectionItems(
        matchingItems,
        sortKey.value,
        sortDirection.value,
      ),
    }
  })
  watch(
    hasSortableScores,
    (hasScores) => {
      if (
        !hasScores &&
        sortKey.value === 'score'
      ) {
        sortKey.value = 'name'
        sortDirection.value = 'asc'
      }
    },
  )

  return {
    filterText,
    colorFilters,
    supertypeFilters,
    cardTypeFilters,
    subtypeFilters,
    viewMode,
    organizationMode,
    sortKey,
    sortDirection,
    commanderWorkspaceMode,
    facetOptions,
    hasSortableScores,
    filteredCollection,
  }
}
