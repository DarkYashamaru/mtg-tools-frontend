import type { GameplayCard } from '@/types/gameplayCard'

export type CollectionItem = {
  id: string | number
  card_id: string
  oracle_id: string | null
  name: string | null
  commander_support_score?: number
  commander_support_reasons?: Array<{
    code: string
    label: string
    points: number
  }>
  score_breakdown?: Array<{
    key: string
    label: string
    score: number
    reasons: Array<{ code: string; label: string; points: number }>
  }>
  card_insights?: Array<{
    label: string
    value: string | number
  }>
  gameplay_card?: GameplayCard
  cmc?: number
  card_types?: string[]
  color_identity?: Array<{ symbol: string }>
  tags?: {
    direct: Array<{ slug: string; description?: string | null }>
    inherited: Array<{ slug: string; description?: string | null }>
  }
  set_code: string | null
  collector_number: string | null
  lang: string | null
  image_uri: string | null
  amount: number
  zone: string
  available_print_count?: number
  source_collection_count?: number
  sources?: Array<{
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
  categories?: Array<{ name: string }>
  archetypes?: Array<{ name: string }>
}

export type CollectionCommanderCard = {
  card_id: string
  oracle_id: string | null
  name: string | null
  set_code: string | null
  collector_number: string | null
  lang: string | null
  image_uri: string | null
  amount: number
}

export type CollectionRecord = {
  id: string | number
  user_id: number
  name: string
  deck_type: string
  builder_source_collection_id?: string | null
  builder_theme_id?: number | null
  commander_cards?: CollectionCommanderCard[]
  commander_card_id: string | null
  commander_oracle_id: string | null
  commander_name: string | null
  commander_image_uri: string | null
  item_count: number
  is_virtual?: boolean
  is_read_only?: boolean
  source_collection_count?: number
  items: CollectionItem[]
}

export type DeckLegalityResult = {
  legal: boolean
  card_count: number
  required_card_count: number
  checks: {
    card_count: { valid: boolean; actual: number; required: number }
    commander: { valid: boolean }
    duplicates: { valid: boolean; cards: Array<{ oracle_id: string; name: string | null; copies: number }> }
    color_identity: {
      valid: boolean
      commander_colors: string[]
      cards: Array<{ oracle_id: string; name: string | null; colors: string[] }>
    }
  }
}

export type WorkspaceViewMode = 'grid' | 'list'
export type WorkspaceOrganizationMode = 'section' | 'category'
export type CommanderWorkspaceMode = 'normal' | 'template'

export type CollectionCardContextMenuPayload = {
  item: CollectionItem
  x: number
  y: number
}

export type CollectionCardSearchResult = {
  card_id: string
  oracle_id: string | null
  name: string | null
  set_code: string | null
  collector_number: string | null
  lang: string | null
  image_uri: string | null
}
