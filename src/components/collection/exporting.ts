import type { CollectionItem } from './types'

export type CollectionExportOptions = {
  includeMaybeboard: boolean
  includeSectionHeaders: boolean
  includeSetCode: boolean
  includeCollectorNumber: boolean
  includeColorTags: boolean
}

function sectionTitle(zone: string): string {
  const normalized = zone.trim().toLowerCase()
  if (normalized === 'commander') return 'Commander'
  if (normalized === 'sideboard') return 'Sideboard'
  if (normalized === 'maybeboard') return 'Maybeboard'
  return 'Mainboard'
}

function colorTags(item: CollectionItem): string {
  const colors = item.gameplay_card?.color_identity
    .map((color) => color.symbol.toUpperCase())
    .filter((color) => ['W', 'U', 'B', 'R', 'G'].includes(color)) ?? []
  return colors.map((color) => `^${color}^`).join(' ')
}

function formatItem(item: CollectionItem, options: CollectionExportOptions): string | null {
  const name = item.name?.trim()
  if (!name || item.amount < 1) return null

  const includePrint = options.includeSetCode || options.includeCollectorNumber
  const print = includePrint && item.set_code
    ? ` (${item.set_code})${options.includeCollectorNumber && item.collector_number ? ` ${item.collector_number}` : ''}`
    : ''
  const tags = options.includeColorTags ? colorTags(item) : ''
  return [`${item.amount} ${name}${print}`, tags].filter(Boolean).join(' ')
}

export function formatCollectionExport(items: CollectionItem[], options: CollectionExportOptions): string {
  const exportableItems = options.includeMaybeboard
    ? items
    : items.filter((item) => item.zone !== 'maybeboard')

  if (!options.includeSectionHeaders) {
    return exportableItems.map((item) => formatItem(item, options)).filter((line): line is string => Boolean(line)).join('\n')
  }

  const sections = new Map<string, CollectionItem[]>()
  for (const item of exportableItems) {
    const title = sectionTitle(item.zone || 'mainboard')
    sections.set(title, [...(sections.get(title) ?? []), item])
  }

  return ['Commander', 'Mainboard', 'Sideboard', 'Maybeboard']
    .flatMap((title) => {
      const lines = (sections.get(title) ?? [])
        .map((item) => formatItem(item, options))
        .filter((line): line is string => Boolean(line))
      return lines.length > 0 ? [title, ...lines] : []
    })
    .join('\n\n')
}
