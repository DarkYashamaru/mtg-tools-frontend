import type {
  CollectionItem,
  CollectionSortDirection,
  CollectionSortKey,
} from './types'

const RARITY_RANK: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  mythic: 3,
}

export function naturalCollectionSortDirection(key: CollectionSortKey): CollectionSortDirection {
  return key === 'name' || key === 'mana-value' ? 'asc' : 'desc'
}

function normalizedName(item: CollectionItem): string | null {
  const name = item.name?.trim()
  return name || null
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
}

function compareNames(
  left: CollectionItem,
  right: CollectionItem,
  direction: CollectionSortDirection,
): number {
  const leftName = normalizedName(left)
  const rightName = normalizedName(right)

  if (leftName === null && rightName === null) return 0
  if (leftName === null) return 1
  if (rightName === null) return -1

  const comparison = compareText(leftName, rightName)
  return direction === 'asc' ? comparison : -comparison
}

function numericSortValue(item: CollectionItem, key: CollectionSortKey): number | null {
  if (key === 'mana-value') {
    return item.cmc ?? item.gameplay_card?.cmc ?? null
  }
  if (key === 'score') {
    return item.commander_support_score ?? null
  }
  if (key === 'usd-price') {
    return item.gameplay_card?.lowest_price_usd ?? null
  }
  if (key === 'rarity') {
    const rarity = item.rarity?.trim().toLowerCase()
    return rarity ? RARITY_RANK[rarity] ?? null : null
  }
  return null
}

function compareIdentity(left: CollectionItem, right: CollectionItem): number {
  const cardComparison = compareText(left.card_id, right.card_id)
  return cardComparison || compareText(String(left.id), String(right.id))
}

function compareItems(
  left: CollectionItem,
  right: CollectionItem,
  key: CollectionSortKey,
  direction: CollectionSortDirection,
): number {
  if (key === 'name') {
    return compareNames(left, right, direction) || compareIdentity(left, right)
  }

  const leftValue = numericSortValue(left, key)
  const rightValue = numericSortValue(right, key)

  if (leftValue === null && rightValue === null) {
    return compareNames(left, right, 'asc') || compareIdentity(left, right)
  }
  if (leftValue === null) return 1
  if (rightValue === null) return -1

  const valueComparison = leftValue - rightValue
  if (valueComparison !== 0) {
    return direction === 'asc' ? valueComparison : -valueComparison
  }

  return compareNames(left, right, 'asc') || compareIdentity(left, right)
}

export function sortCollectionItems(
  items: CollectionItem[],
  key: CollectionSortKey,
  direction: CollectionSortDirection,
): CollectionItem[] {
  return [...items].sort((left, right) => compareItems(left, right, key, direction))
}
