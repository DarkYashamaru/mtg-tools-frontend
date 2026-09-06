export type StoreCacheStatus = 'refreshed' | 'cached' | 'stale' | 'unavailable' | 'in_progress'

export interface DracoPriceResponse {
  success: boolean
  price: string | null
  price_cop: number | null
  currency: string
  cache_status: StoreCacheStatus
  stale: boolean
  last_updated: string | null
  next_refresh_at: string | null
  product_url?: string | null
}

export function storeStatusLabel(status: StoreCacheStatus): string {
  return {
    refreshed: 'Updated from store',
    cached: 'Cached price',
    stale: 'Stale price — latest lookup failed',
    unavailable: 'Price unavailable',
    in_progress: 'Another lookup is in progress',
  }[status]
}

export function formatDracoTime(value: string): string {
  return new Date(value).toLocaleString()
}
