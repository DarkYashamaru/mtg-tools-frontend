import type { GameplayCard } from '@/types/gameplayCard'

export interface CommanderSupportReason {
  code: string
  label: string
  points: number
}

export interface CommanderSupportSourceItem {
  card_id: string
  oracle_id: string
  name: string
  image_uri: string | null
  amount: number
  zone: string
}

export interface CommanderSupportEntry {
  oracle_id: string
  name: string
  score: number
  bucket: string
  reasons: CommanderSupportReason[]
  card: GameplayCard
  source_item: CommanderSupportSourceItem
}

export interface CommanderSupportBucketMetadata {
  key: string
  title: string
  description: string
}

export interface CommanderSupportResponse {
  success: boolean
  supported: boolean
  profile_version?: number
  commander_oracle_id: string
  commander_name?: string
  card_scores: Record<string, number>
  card_score_reasons?: Record<string, CommanderSupportReason[]>
  bucket_metadata: CommanderSupportBucketMetadata[]
  buckets: Record<string, CommanderSupportEntry[]>
}
