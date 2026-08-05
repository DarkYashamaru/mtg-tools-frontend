export type CollectionItem = {
  id: number
  card_id: string
  oracle_id: string | null
  name: string | null
  set_code: string | null
  collector_number: string | null
  lang: string | null
  image_uri: string | null
  amount: number
  zone: string
}

export type CollectionRecord = {
  id: number
  user_id: number
  name: string
  deck_type: string
  commander_card_id: string | null
  commander_oracle_id: string | null
  commander_name: string | null
  commander_image_uri: string | null
  item_count: number
  items: CollectionItem[]
}

export type WorkspaceViewMode = 'grid' | 'list'
