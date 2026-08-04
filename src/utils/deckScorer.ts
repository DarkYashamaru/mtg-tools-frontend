// Define types matching your collection structures
export interface Face {
  name: string
  mana_cost: string | null
  oracle_text: string | null
  supertypes: string[]
  card_types: string[]
  subtypes: string[]
  small_image: string | null
  normal_image: string | null
  large_image: string | null
}

export interface TagCollectionSchema {
  direct: Array<{ slug: string }>
  inherited: Array<{ slug: string }>
}

export interface CardThemeMinimal {
  theme_id: number
  name: string
  curated: boolean
  score: number
}

export interface Card {
  oracle_id: string
  name: string
  cmc: number
  layout: string
  commander_legal: boolean
  standard_legal: boolean
  tags: TagCollectionSchema // Updated to use the new schema
  faces: Face[]
  keywords: Array<{ label: string }>
  color_identity: Array<{ symbol: string }>
  themes: CardThemeMinimal[]
}

// Structuring individual scores per commander
export interface CommanderScoreResult {
  commander: Card
  totalScore: number
  breakdown: {
    [strategyName: string]: number
  }
  matchingCardCount: number
}

export interface Theme {
  id: number
  name: string
  curated: boolean
}

export interface CardThemeResponse {
  theme_id: number
  name: string
  curated: boolean
  score: number
}

export interface ThemeCategory {
  id: number
  theme_id: number
  name: string
}

// -------------------------------------------------------------
// Base Strategy Blueprint
// -------------------------------------------------------------
export interface ScoringStrategy {
  name: string
  calculate(commander: Card, entireCollection: Card[]): number
}

// -------------------------------------------------------------
// Shared Helper Utilities
// -------------------------------------------------------------

// Convert a card's color identity symbols to a clean JavaScript Set
function getColorSet(card: Card): Set<string> {
  return new Set(card.color_identity.map(c => c.symbol.toUpperCase()))
}

// Helper to determine if a specific card is legally allowed in a commander's deck based on color rules
function isColorIdentityLegal(commanderColors: Set<string>, card: Card): boolean {
  const cardColors = getColorSet(card)
  for (const symbol of cardColors) {
    if (!commanderColors.has(symbol)) {
      return false
    }
  }
  return true
}

/**
 * Aggregates both direct and inherited tag slugs into a single, unique Set
 * to allow unified synergy calculation across all mechanics.
 */
function getCardTags(card: Card): Set<string> {
  const tagsSet = new Set<string>()
  
  // Guard clause in case tags wrapper object is undefined or null
  if (!card.tags) return tagsSet

  // Extract direct tag slugs
  if (Array.isArray(card.tags.direct)) {
    for (const t of card.tags.direct) {
      if (t?.slug) tagsSet.add(t.slug)
    }
  }

  // Extract inherited tag slugs
  if (Array.isArray(card.tags.inherited)) {
    for (const t of card.tags.inherited) {
      if (t?.slug) tagsSet.add(t.slug)
    }
  }
  
  return tagsSet
}

// -------------------------------------------------------------
// Strategy 1: Color Identity Matching Rule
// -------------------------------------------------------------
export const ColorIdentityStrategy: ScoringStrategy = {
  name: 'colorIdentityPool',
  calculate(commander: Card, entireCollection: Card[]): number {
    const commanderColors = getColorSet(commander)
    let validCardCount = 0

    for (const card of entireCollection) {
      if (card.oracle_id === commander.oracle_id) continue

      if (isColorIdentityLegal(commanderColors, card)) {
        validCardCount++
      }
    }

    return validCardCount
  }
}

// -------------------------------------------------------------
// Strategy 2: Tag Synergy Matching Rule
// -------------------------------------------------------------
export const TagSynergyStrategy: ScoringStrategy = {
  name: 'tagSynergy',
  calculate(commander: Card, entireCollection: Card[]): number {
    const commanderColors = getColorSet(commander)
    const commanderTags = getCardTags(commander)
    
    // If the commander has no tags assigned, it has no organic tag synergies to score
    if (commanderTags.size === 0) return 0

    let totalSynergyPoints = 0

    for (const card of entireCollection) {
      if (card.oracle_id === commander.oracle_id) continue

      // A card must first be legally allowed to be played in the deck color identity
      if (!isColorIdentityLegal(commanderColors, card)) continue

      const cardTags = getCardTags(card)
      
      // Look for intersecting tag matches between this card and the commander
      let cardMatchCount = 0
      for (const tag of cardTags) {
        if (commanderTags.has(tag)) {
          cardMatchCount++
        }
      }

      // Add points based on how many matching tags this card has (e.g., 1 tag match = 1 pt, 2 tag matches = 2 pts)
      totalSynergyPoints += cardMatchCount
    }

    return totalSynergyPoints
  }
}

// -------------------------------------------------------------
// Registry & Main Processor Engine
// -------------------------------------------------------------
const activeStrategies: ScoringStrategy[] = [
  ColorIdentityStrategy,
]

/**
 * Sweeps through your collection and calculates a running aggregate 
 * analysis score for each discovered Commander option.
 */
export function scoreCommanders(commanders: Card[], collection: Card[]): CommanderScoreResult[] {
  return commanders.map(commander => {
    let aggregateScore = 0
    const scoreBreakdown: { [key: string]: number } = {}

    // Run each active criteria calculation ruleset
    for (const strategy of activeStrategies) {
      const score = strategy.calculate(commander, collection)
      scoreBreakdown[strategy.name] = score
      aggregateScore += score
    }

    return {
      commander,
      totalScore: aggregateScore,
      breakdown: scoreBreakdown,
      // Total cards that are legal within the colors of this specific commander
      matchingCardCount: scoreBreakdown['colorIdentityPool'] || 0
    }
  }).sort((a, b) => b.totalScore - a.totalScore) // Sort highest scores to top of the list
}