import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { scoreCommanders, type Card } from '../utils/deckScorer'

export const useCollectionStore = defineStore('collection', () => {
  const getInitialCollection = (): Card[] => {
    try {
      const stored = sessionStorage.getItem('mtg_bulk_collection')
      if (!stored) return []
      return Array.isArray(JSON.parse(stored)) ? JSON.parse(stored) : []
    } catch (e) { return [] }
  }

  const collection = ref<Card[]>(getInitialCollection())
  const selectedCommanderId = ref<string | null>(sessionStorage.getItem('mtg_selected_commander_id'))
  const selectedTheme = ref<any | null>(null) // Retain memory state handler hook if needed

  function setCollection(newCollection: Card[]) {
    const cleanCollection = Array.isArray(newCollection) ? newCollection : []
    collection.value = cleanCollection
    sessionStorage.setItem('mtg_bulk_collection', JSON.stringify(cleanCollection))
  }

  function selectCommander(oracleId: string | null) {
    selectedCommanderId.value = oracleId
    if (oracleId) sessionStorage.setItem('mtg_selected_commander_id', oracleId)
    else sessionStorage.removeItem('mtg_selected_commander_id')
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

  const scoredCommanders = computed(() => {
    if (!Array.isArray(collection.value) || !Array.isArray(validCommanders.value)) return []
    return scoreCommanders(validCommanders.value, collection.value)
  })

  const selectedCommanderData = computed(() => {
    if (!selectedCommanderId.value || !Array.isArray(scoredCommanders.value)) return null
    return scoredCommanders.value.find(item => item?.commander?.oracle_id === selectedCommanderId.value) || null
  })

  // 💥 NEW: Client-side Aggregation Engine Based completely on Physical Pool Availability
const selectedCommanderThemes = computed(() => {
  const activeCommander = selectedCommanderData.value?.commander
  // Guard check: Ensure we have a commander, they have themes, and the collection exists
  if (!activeCommander || !Array.isArray(activeCommander.themes) || !Array.isArray(collection.value)) {
    return []
  }

  const commanderColors = new Set(activeCommander.color_identity.map(c => c.symbol.toUpperCase()))
  const commanderId = activeCommander.oracle_id

  // 1. Initialize a map using ONLY the chosen Commander's registered themes
  const commanderThemeMap = new Map<number, { theme_id: number; name: string; curated: boolean; score: number }>()
  
  activeCommander.themes.forEach(theme => {
    commanderThemeMap.set(theme.theme_id, {
      theme_id: theme.theme_id,
      name: theme.name,
      curated: theme.curated,
      score: 0 // This will store the cumulative physical pool score
    })
  })

  // 2. Scan the collection pool to accumulate scores for those specific themes
  collection.value.forEach(card => {
    // Skip the commander card itself so it doesn't inflate its own pool score
    if (card.oracle_id === commanderId) return

    // Check color identity legality against the commander
    const isColorLegal = card.color_identity.every(color => 
      commanderColors.has(color.symbol.toUpperCase())
    )
    if (!isColorLegal) return

    // Tally up scores ONLY if the card's theme matches one of the commander's themes
    if (Array.isArray(card.themes)) {
      card.themes.forEach(cardTheme => {
        if (commanderThemeMap.has(cardTheme.theme_id)) {
          // Increment the specific commander theme pool with this card's synergy score
          commanderThemeMap.get(cardTheme.theme_id)!.score += cardTheme.score
        }
      })
    }
  })

  // 3. Return only the commander's themes, sorted by physical pool backing density
  return Array.from(commanderThemeMap.values()).sort((a, b) => b.score - a.score)
})

  function clearStore() {
    collection.value = []
    selectedCommanderId.value = null
    selectedTheme.value = null
    sessionStorage.removeItem('mtg_bulk_collection')
    sessionStorage.removeItem('mtg_selected_commander_id')
  }

  return {
    collection,
    selectedCommanderId,
    selectedTheme,
    validCommanders,
    scoredCommanders,
    selectedCommanderData,
    selectedCommanderThemes, // Exposed computed utility hook
    setCollection,
    selectCommander,
    setSelectedTheme,
    clearStore
  }
})