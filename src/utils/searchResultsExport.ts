import type { GameplayCard } from '@/types/gameplayCard'

export function formatSearchResultsExport(cards: GameplayCard[]): string {
  return cards
    .map((card) => card.name.trim())
    .filter(Boolean)
    .map((name) => `1 ${name}`)
    .join('\n')
}
