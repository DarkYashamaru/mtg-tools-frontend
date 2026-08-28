import type { CollectionItem } from './types'

export const COLOR_FILTER_OPTIONS = [
  { value: 'W', label: 'White (W)' },
  { value: 'U', label: 'Blue (U)' },
  { value: 'B', label: 'Black (B)' },
  { value: 'R', label: 'Red (R)' },
  { value: 'G', label: 'Green (G)' },
  { value: 'colorless', label: 'Colorless' },
]

export type CollectionFacetFilters = {
  colors: string[]
  supertypes: string[]
  cardTypes: string[]
  subtypes: string[]
}

export type CollectionFacetOptions = {
  supertypes: string[]
  cardTypes: string[]
  subtypes: string[]
}

function normalizedValues(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean)
}

function itemFaceValues(item: CollectionItem, key: 'supertypes' | 'card_types' | 'subtypes'): string[] {
  return item.gameplay_card?.faces.flatMap((face) => normalizedValues(face[key])) ?? []
}

function matchesAny(values: string[], selected: string[]): boolean {
  return selected.length === 0 || selected.some((value) => values.includes(value))
}

export function collectionFacetOptions(items: CollectionItem[]): CollectionFacetOptions {
  const valuesFor = (key: 'supertypes' | 'card_types' | 'subtypes') => Array.from(
    new Set(items.flatMap((item) => itemFaceValues(item, key)))
  ).sort((left, right) => left.localeCompare(right))

  return {
    supertypes: valuesFor('supertypes'),
    cardTypes: valuesFor('card_types'),
    subtypes: valuesFor('subtypes'),
  }
}

export function matchesCollectionFacets(item: CollectionItem, filters: CollectionFacetFilters): boolean {
  const colors = item.gameplay_card?.color_identity.map((color) => color.symbol.toUpperCase()) ?? []
  const selectedColors = filters.colors.filter((color) => color !== 'colorless')
  const colorMatches = filters.colors.length === 0
    || (selectedColors.length === 0
      ? colors.length === 0
      : colors.every((color) => selectedColors.includes(color)))

  return colorMatches
    && matchesAny(itemFaceValues(item, 'supertypes'), filters.supertypes)
    && matchesAny(itemFaceValues(item, 'card_types'), filters.cardTypes)
    && matchesAny(itemFaceValues(item, 'subtypes'), filters.subtypes)
}
