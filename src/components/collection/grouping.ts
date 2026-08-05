import type { CollectionItem } from './types'

export type CollectionCategoryGroup = {
  name: string
  items: CollectionItem[]
  totalCards: number
}

function normalizedCategoryNames(item: CollectionItem): string[] {
  const categoryNames = (item.categories ?? [])
    .map((category) => category?.name?.trim())
    .filter((name): name is string => !!name)

  if (categoryNames.length > 0) {
    return categoryNames
  }

  return ['Uncategorized']
}

export function groupCollectionItemsByCategory(items: CollectionItem[]): CollectionCategoryGroup[] {
  const groups = new Map<string, CollectionItem[]>()

  for (const item of items) {
    for (const categoryName of normalizedCategoryNames(item)) {
      const bucket = groups.get(categoryName) ?? []
      bucket.push(item)
      groups.set(categoryName, bucket)
    }
  }

  return Array.from(groups.entries())
    .map(([name, groupedItems]) => ({
      name,
      items: groupedItems,
      totalCards: groupedItems.reduce((sum, item) => sum + item.amount, 0),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}
