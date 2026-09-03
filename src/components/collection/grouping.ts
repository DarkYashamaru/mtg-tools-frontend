import type { CollectionItem, CollectionProfileSection } from './types'

export type CollectionSectionGroup = {
  key: string
  title: string
  description: string
  items: CollectionItem[]
  totalCards: number
}

export function groupCollectionItemsByProfileSection(
  items: CollectionItem[],
  sections: CollectionProfileSection[],
  includeUncategorized = false,
): CollectionSectionGroup[] {
  const groups = sections.flatMap((section) => {
    const sectionOracleIds = new Set(section.oracle_ids)
    const groupedItems = items.filter((item) => item.oracle_id && sectionOracleIds.has(item.oracle_id))
    if (groupedItems.length === 0) return []
    return [{
      key: section.key,
      title: section.title,
      description: section.description,
      items: groupedItems,
      totalCards: groupedItems.reduce((sum, item) => sum + item.amount, 0),
    }]
  })
  if (!includeUncategorized) return groups

  const categorizedOracleIds = new Set(sections.flatMap((section) => section.oracle_ids))
  const uncategorizedItems = items.filter(
    (item) => !item.oracle_id || !categorizedOracleIds.has(item.oracle_id),
  )
  if (uncategorizedItems.length === 0) return groups

  return [
    ...groups,
    {
      key: 'uncategorized',
      title: 'Uncategorized',
      description: 'Cards that do not match a specialized or commander-specific category.',
      items: uncategorizedItems,
      totalCards: uncategorizedItems.reduce((sum, item) => sum + item.amount, 0),
    },
  ]
}
