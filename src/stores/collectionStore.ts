import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Card } from '../utils/deckScorer'

function dedupeGameplayCards(cards: Card[]): Card[] {
  const uniqueCards = new Map<string, Card>()

  for (const card of cards) {
    if (!card?.oracle_id || uniqueCards.has(card.oracle_id)) {
      continue
    }

    uniqueCards.set(card.oracle_id, card)
  }

  return Array.from(uniqueCards.values())
}

function clearLegacyCollectionCache() {
  try {
    sessionStorage.removeItem('mtg_bulk_collection')
  } catch {
    // Storage is optional; the active pool is intentionally memory-only.
  }
}

function initialCommanderId(): string | null {
  try {
    return sessionStorage.getItem('mtg_selected_commander_id')
  } catch {
    return null
  }
}

export const useCollectionStore = defineStore('collection', () => {
  // Full gameplay-card payloads can exceed browser storage quotas. Collection-backed
  // routes reload from the API, while unsaved imports intentionally last one session.
  clearLegacyCollectionCache()
  const collection = ref<Card[]>([])
  const selectedCommanderId = ref<string | null>(initialCommanderId())
  const selectedTheme = ref<any | null>(null)

  function setCollection(newCollection: Card[]) {
    collection.value = Array.isArray(newCollection) ? dedupeGameplayCards(newCollection) : []
  }

  function selectCommander(oracleId: string | null) {
    selectedCommanderId.value = oracleId
    try {
      if (oracleId) sessionStorage.setItem('mtg_selected_commander_id', oracleId)
      else sessionStorage.removeItem('mtg_selected_commander_id')
    } catch {
      // The selected commander remains available for the current in-memory session.
    }
  }

  function setSelectedTheme(theme: any) {
    selectedTheme.value = theme
  }

  const validCommanders = computed(() => {
    if (!Array.isArray(collection.value)) return []
    return collection.value.filter(card =>
      card?.commander_legal && card.faces?.some(f => f?.supertypes?.includes('Legendary') && f?.card_types?.includes('Creature'))
    )
  })

  const selectedCommanderData = computed(() => {
    if (!selectedCommanderId.value || !Array.isArray(validCommanders.value)) return null
    return validCommanders.value.find(card => card?.oracle_id === selectedCommanderId.value) || null
  })

  const selectedCommanderThemes = computed(() => {
    const activeCommander = selectedCommanderData.value
    if (!activeCommander || !Array.isArray(activeCommander.themes) || !Array.isArray(collection.value)) {
      return []
    }

    const commanderColors = new Set(activeCommander.color_identity.map(c => c.symbol.toUpperCase()))
    const commanderId = activeCommander.oracle_id
    const commanderThemeMap = new Map<number, { theme_id: number; name: string; curated: boolean; score: number }>()

    activeCommander.themes.forEach(theme => {
      commanderThemeMap.set(theme.theme_id, {
        theme_id: theme.theme_id,
        name: theme.name,
        curated: theme.curated,
        score: 0,
      })
    })

    collection.value.forEach(card => {
      if (card.oracle_id === commanderId) return

      const isColorLegal = card.color_identity.every(color =>
        commanderColors.has(color.symbol.toUpperCase())
      )
      if (!isColorLegal || !Array.isArray(card.themes)) return

      card.themes.forEach(cardTheme => {
        if (commanderThemeMap.has(cardTheme.theme_id)) {
          commanderThemeMap.get(cardTheme.theme_id)!.score += cardTheme.score
        }
      })
    })

    return Array.from(commanderThemeMap.values()).sort((a, b) => b.score - a.score)
  })

  function clearStore() {
    collection.value = []
    selectedCommanderId.value = null
    selectedTheme.value = null
    clearLegacyCollectionCache()
    try {
      sessionStorage.removeItem('mtg_selected_commander_id')
    } catch {
      // Storage is optional; in-memory state was already cleared.
    }
  }

  return {
    collection,
    selectedCommanderId,
    selectedTheme,
    validCommanders,
    selectedCommanderData,
    selectedCommanderThemes,
    setCollection,
    selectCommander,
    setSelectedTheme,
    clearStore,
  }
})
