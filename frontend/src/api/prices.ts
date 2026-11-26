import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export interface PriceRow {
  state: string; district: string; market: string; variety: string; grade: string; date: string
  min: number | null; max: number | null; modal: number | null; unit: string; currency: string; period: 'daily' | 'monthly'; source: string; source_label: string
}
export interface LocationTree { as_of: string | null; states: { state: string; districts: { district: string; markets: string[] }[] }[] }
export interface Scope { commodity: string; state: string; district: string; market: string }

function qs(country: string, s: Scope) {
  const p = new URLSearchParams({ country, commodity: s.commodity })
  if (s.state) p.set('state', s.state)
  if (s.district) p.set('district', s.district)
  if (s.market) p.set('market', s.market)
  return p
}

// Keys start with the country code so switching country never shows another region's prices.
export const useLocations = (country: string, commodity: string) =>
  useQuery({ queryKey: [country, 'price-locations', commodity], retry: false,
    queryFn: () => api<LocationTree>(`/api/prices/locations?country=${country}&commodity=${commodity}`) })

export const useLatestPrices = (country: string, s: Scope) =>
  useQuery({ queryKey: [country, 'prices', s], retry: false,
    queryFn: () => api<{ items: PriceRow[]; total: number }>(`/api/prices?${qs(country, s)}&limit=500`) })

export const usePriceHistory = (country: string, s: Scope) =>
  useQuery({ queryKey: [country, 'price-history', s], retry: false,
    queryFn: () => api<{ points: { date: string; price: number; reports: number }[] }>(`/api/prices/history?${qs(country, s)}&days=180`) })
