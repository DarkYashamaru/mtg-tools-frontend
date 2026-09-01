export interface GameplayCardFace {
  name: string
  mana_cost: string | null
  oracle_text: string | null
  power?: string | null
  toughness?: string | null
  supertypes: string[]
  card_types: string[]
  subtypes: string[]
  small_image: string | null
  normal_image: string | null
  large_image: string | null
}

export interface GameplayCardTag {
  slug: string
  description?: string | null
}

export interface GameplayCardTags {
  direct: GameplayCardTag[]
  inherited: GameplayCardTag[]
}

export interface GameplayCardMarker {
  id: string
  name: string
  description?: string | null
}

export interface GameplayCardTheme {
  theme_id: number
  name: string
  curated: boolean
  score: number
}

export interface GameplayCardCategory {
  name: string
}

export interface GameplayCardArchetype {
  name: string
}

export interface GameplayCard {
  oracle_id: string
  name: string
  cmc: number
  layout: string
  commander_legal: boolean
  standard_legal: boolean
  tags: GameplayCardTags
  markers: GameplayCardMarker[]
  faces: GameplayCardFace[]
  keywords: Array<{ label: string }>
  color_identity: Array<{ symbol: string }>
  produced_mana: Array<{ symbol: string }>
  themes: GameplayCardTheme[]
  categories: GameplayCardCategory[]
  archetypes: GameplayCardArchetype[]
  owned_amount?: number
  owned_print_count?: number
  owned_collection_count?: number
  lowest_price_usd?: number | null
  dracostore_price_cop?: number | null
  ownership_sources?: Array<{
    collection_id: number
    collection_name: string
    item_id: number
    card_id: string
    set_code: string | null
    collector_number: string | null
    lang: string | null
    image_uri: string | null
    amount: number
    zone: string
  }>
}
