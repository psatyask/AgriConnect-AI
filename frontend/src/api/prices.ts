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
    queryFn: () => api<{ items: PriceRow[]; total: number; checked_at: string | null }>(`/api/prices?${qs(country, s)}&limit=500`) })

export interface History { points: { date: string; price: number; reports: number }[]; basis: 'modal' | 'midpoint'; unit: string | null; needs: 'unit' | 'variety' | null }

export const usePriceHistory = (country: string, s: Scope, variety = '', unit = '') =>
  useQuery({ queryKey: [country, 'price-history', s, variety, unit], retry: false,
    queryFn: () => {
      const p = qs(country, s)
      if (variety) p.set('variety', variety)
      if (unit) p.set('unit', unit)
      return api<History>(`/api/prices/history?${p}&days=180`)
    } })

export interface Forecast {
  status: 'ok' | 'no_forecast'; reason?: string; basis?: 'modal' | 'midpoint'; unit?: string | null
  model?: 'ma5' | 'ses' | 'trend'; value?: number; low?: number; high?: number; target_date?: string
  holdout_skill?: number; holdout_tests?: number; tests?: number; horizon_days: number
}

/** Only asked for once a single price line is chosen; the server decides whether the evidence supports a forecast. */
export const usePriceForecast = (country: string, s: Scope, variety: string, unit: string, enabled: boolean) =>
  useQuery({ queryKey: [country, 'price-forecast', s, variety, unit], retry: false, enabled,
    queryFn: () => {
      const p = qs(country, s)
      if (variety) p.set('variety', variety)
      if (unit) p.set('unit', unit)
      return api<Forecast>(`/api/prices/forecast?${p}`)
    } })

export interface Signal {
  status: 'ok' | 'none'; reason?: string; p_up?: number; lines?: number; as_of?: string; other_markets_change?: number | null
  evidence?: { auc: number; auc_low: number; auc_high: number; tests: number; through: string }
}

/** Direction lean from the offline model; the server returns nothing unless the product's held-out evidence passed. Needs one market. */
export const useDirectionSignal = (country: string, s: Scope, variety: string, unit: string, enabled: boolean) =>
  useQuery({ queryKey: [country, 'price-signal', s, variety, unit], retry: false, enabled: enabled && !!s.market,
    queryFn: () => {
      const p = qs(country, s)
      if (variety) p.set('variety', variety)
      if (unit) p.set('unit', unit)
      return api<Signal>(`/api/prices/signal?${p}`)
    } })

export interface SignalOverview { items: { commodity: string; auc: number; auc_low: number; tests: number; up: number; down: number; even: number; as_of: string }[]; evaluated_through: string | null }

export const useSignalOverview = (country: string) =>
  useQuery({ queryKey: [country, 'price-signals'], retry: false, queryFn: () => api<SignalOverview>(`/api/prices/signals?country=${country}`) })
