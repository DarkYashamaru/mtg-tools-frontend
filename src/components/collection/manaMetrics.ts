import type { CollectionItem } from './types'

export const MANA_COLOR_SYMBOLS = ['W', 'U', 'B', 'R', 'G', 'C'] as const

export type ManaColorSymbol = typeof MANA_COLOR_SYMBOLS[number]

export type ManaColorMetric = {
  symbol: ManaColorSymbol
  manaCost: number
  sources: number
}

const ACTIVE_DECK_ZONES = new Set(['mainboard', 'commander'])
const MANA_SYMBOL_PATTERN = /\{([^}]+)\}/g

function quantity(item: CollectionItem) {
  return Number.isFinite(item.amount) && item.amount > 0 ? item.amount : 0
}

function colorsInManaSymbol(symbol: string): ManaColorSymbol[] {
  const components = new Set(symbol.toUpperCase().split('/'))
  return MANA_COLOR_SYMBOLS.filter((color) => components.has(color))
}

function manaSymbols(manaCost: string | null | undefined): string[] {
  if (!manaCost) return []
  return Array.from(manaCost.matchAll(MANA_SYMBOL_PATTERN), (match) => match[1] ?? '')
}

export function activeDeckItems(items: CollectionItem[]): CollectionItem[] {
  return items.filter((item) => ACTIVE_DECK_ZONES.has(item.zone.trim().toLowerCase()))
}

export function calculateManaColorMetrics(items: CollectionItem[]): ManaColorMetric[] {
  const manaCostByColor = new Map<ManaColorSymbol, number>()
  const sourcesByColor = new Map<ManaColorSymbol, number>()
  for (const symbol of MANA_COLOR_SYMBOLS) {
    manaCostByColor.set(symbol, 0)
    sourcesByColor.set(symbol, 0)
  }

  for (const item of activeDeckItems(items)) {
    const itemQuantity = quantity(item)
    if (itemQuantity === 0) continue

    for (const face of item.gameplay_card?.faces ?? []) {
      for (const manaSymbol of manaSymbols(face.mana_cost)) {
        for (const color of colorsInManaSymbol(manaSymbol)) {
          manaCostByColor.set(color, (manaCostByColor.get(color) ?? 0) + itemQuantity)
        }
      }
    }

    const producedColors = new Set<ManaColorSymbol>()
    for (const capability of item.gameplay_card?.produced_mana ?? []) {
      const symbol = capability.symbol?.trim().toUpperCase()
      if (MANA_COLOR_SYMBOLS.includes(symbol as ManaColorSymbol)) {
        producedColors.add(symbol as ManaColorSymbol)
      }
    }

    for (const color of producedColors) {
      sourcesByColor.set(color, (sourcesByColor.get(color) ?? 0) + itemQuantity)
    }
  }

  return MANA_COLOR_SYMBOLS.map((symbol) => ({
    symbol,
    manaCost: manaCostByColor.get(symbol) ?? 0,
    sources: sourcesByColor.get(symbol) ?? 0,
  }))
}
