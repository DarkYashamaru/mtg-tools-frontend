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
): CollectionSectionGroup[] {
  return sections.flatMap((section) => {
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
}
