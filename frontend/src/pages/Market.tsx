import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ListingCard from '../components/ListingCard'
import { useListings } from '../api/listings'
import { useLatestPrices, useLocations, usePriceHistory, type Scope } from '../api/prices'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { getDemo } from '../data/demo'
import { formatMoney, formatNumber } from '../utils/format'
import PriceChart from '../components/PriceChart'
import CropIcon, { cropBg } from '../components/art/CropIcon'
import { Card, DemoBadge, EmptyRegion } from '../components/ui'

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex items-center gap-3"><h1 className="font-display text-3xl font-extrabold">{title}</h1><DemoBadge /></div>
      {children}
    </main>
  )
}

function useMoney() {
  const { region } = useRegion()
  const { language } = useLanguage()
  return { region, language, money: (n: number) => formatMoney(n, region, language.code) }
}

export function Marketplace() {
  const { t } = useTranslation()
  const { region, language, money } = useMoney()
  const demo = getDemo(region.code)
  const [commodity, setCommodity] = useState('')
  const [place, setPlace] = useState('')
  const listings = useListings(region.code, commodity, place)
  const real = listings.data?.items ?? []
  const input = 'min-h-11 rounded-xl border bg-transparent px-3 text-sm font-normal'
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-5 font-display text-3xl font-extrabold">{t('nav.marketplace')}</h1>
      <div className="grid gap-5 md:grid-cols-[240px_1fr]">
        <Card className="h-fit space-y-3">
          <b>{t('pages.filters')}</b>
          <label className="flex flex-col gap-1 text-xs font-semibold">{t('home.cropLabel')}
            <select className={input} style={{ borderColor: 'var(--border)', background: 'var(--card)' }} value={commodity} onChange={(e) => setCommodity(e.target.value)}>
              <option value="" />
              {region.commodities.map((c) => <option key={c.id} value={c.id}>{t(c.nameKey)}</option>)}
            </select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold">{t('home.locationLabel')}
            <input className={input} style={{ borderColor: 'var(--border)' }} value={place} onChange={(e) => setPlace(e.target.value)} /></label>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{region.hierarchy.slice(1).join(' / ')}</p>
        </Card>
        <div className="space-y-6">
          {listings.isError && <p role="alert" className="text-sm text-red-600">{t('market.loadFail')}</p>}
          {real.length > 0 && <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{real.map((l) => <li key={l.id}><ListingCard l={l} /></li>)}</ul>}
          {listings.isSuccess && real.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('market.noListings', { region: t(region.nameKey) })}</p>)}
          {listings.isSuccess && real.length === 0 && demo && (
            <section aria-label={t('market.examples')}>
              <div className="mb-3 flex items-center gap-3"><h2 className="font-semibold">{t('market.examples')}</h2><DemoBadge /></div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {demo.listings.map((l) => (
                  <li key={l.id}><Card className="h-full overflow-hidden !p-0 opacity-80">
                    <div className="flex h-20 items-center justify-center" style={{ background: cropBg(l.commodity) }}><CropIcon id={l.commodity} size={48} /></div>
                    <div className="p-5"><b>{t(`commodities.${l.commodity}`)} · {l.variety} · {l.grade}</b>
                      <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{l.place}</div>
                      <div className="mt-3 font-display text-xl font-extrabold text-brand">{money(l.price)} / {t(`units.${l.unit}`)}</div>
                      <div className="text-sm" style={{ color: 'var(--muted)' }}>{formatNumber(l.qty, language.code)} {t(`units.${l.unit}`)} {t('home.available')}</div>
                    </div></Card></li>))}
              </ul>
            </section>)}
          {!demo && real.length === 0 && !listings.isError && <EmptyRegion />}
        </div>
      </div>
      <p className="mt-6 text-xs" style={{ color: 'var(--muted)' }}>Phone numbers and emails stay hidden until the farmer consents.</p>
    </main>
  )
}

export function Intelligence() {
  const { t } = useTranslation()
  const { region, money } = useMoney()
  const demo = getDemo(region.code)
  const [scope, setScope] = useState<Scope>({ commodity: region.commodities[0].id, state: '', district: '', market: '' })
  const locations = useLocations(region.code, scope.commodity)
  const latest = useLatestPrices(region.code, scope)
  const [vf, setVf] = useState(''), [uf, setUf] = useState(''), [showAll, setShowAll] = useState(false)
  const states = locations.data?.states ?? []
  const districts = states.find((s) => s.state === scope.state)?.districts ?? []
  const hasDistricts = states.some((s) => s.districts.some((d) => d.district !== ''))
  // Sources without a district level (US terminal markets) list their markets straight under the state.
  const markets = hasDistricts ? (districts.find((d) => d.district === scope.district)?.markets ?? []) : districts.flatMap((d) => d.markets)
  const hasMarkets = states.some((s) => s.districts.some((d) => d.markets.some((m) => m !== 'State average')))
  const all = latest.data?.items ?? []
  const total = latest.data?.total ?? all.length
  const varieties = [...new Set(all.map((r) => r.variety).filter(Boolean))].sort()
  const packages = [...new Set(all.map((r) => r.unit))].sort()
  const vSel = varieties.includes(vf) ? vf : '', uSel = packages.includes(uf) ? uf : ''  // a filter from another crop quietly resets
  const rows = all.filter((r) => (!vSel || r.variety === vSel) && (!uSel || r.unit === uSel))
    .sort((a, b) => a.variety.localeCompare(b.variety) || a.unit.localeCompare(b.unit) || a.grade.localeCompare(b.grade))
  const shown = showAll ? rows : rows.slice(0, 40)
  const first = rows[0] ?? all[0]  // filters can match nothing; the header still describes the source
  const history = usePriceHistory(region.code, scope, vSel, uSel)
  const showRange = rows.some((r) => r.min != null || r.max != null)
  const showModal = rows.some((r) => r.modal != null)  // USDA terminal markets report a low-high range, never a modal price
  const mixedUnits = new Set(rows.map((r) => r.unit)).size > 1 || packages.length > 1
  const unitLabel = (u: string) => t(`units.${u}`, { defaultValue: u })
  const hasLive = all.length > 0
  const pick = (patch: Partial<Scope>) => setScope((p) => ({ ...p, ...patch }))
  const sel = 'min-h-11 rounded-xl border px-3 text-sm'
  const style = { borderColor: 'var(--border)', background: 'var(--card)' }
  const series = (history.data?.points ?? []).map((p) => ({ label: p.date.slice(5), price: p.price, forecast: null }))
  const field = (label: string, value: string, onChange: (v: string) => void, options: string[], disabled = false) => (
    <label className="flex flex-col gap-1 text-xs font-semibold">{label}
      <select className={sel} style={style} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('prices.allOf')}</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>)
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-5 font-display text-3xl font-extrabold">{t('nav.intelligence')}</h1>
      <Card className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-semibold">{t('home.cropLabel')}
          <select className={sel} style={style} value={scope.commodity} onChange={(e) => setScope({ commodity: e.target.value, state: '', district: '', market: '' })}>
            {region.commodities.map((c) => <option key={c.id} value={c.id}>{t(c.nameKey)}</option>)}</select></label>
        {field(t('prices.state'), scope.state, (v) => pick({ state: v, district: '', market: '' }), states.map((s) => s.state), states.length === 0)}
        {hasDistricts && field(t('prices.district'), scope.district, (v) => pick({ district: v, market: '' }), districts.map((d) => d.district), !scope.state)}
        {hasMarkets && field(t('prices.market'), scope.market, (v) => pick({ market: v }), markets, hasDistricts ? !scope.district : !scope.state)}
      </Card>
      {(latest.isError || locations.isError) && <p role="alert" className="mb-4 text-sm text-red-600">{t('prices.loadFail')}</p>}
      {hasLive && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <p className="mb-2 text-sm" style={{ color: 'var(--muted)' }}>{t('prices.asOf', { date: first.period === 'monthly' ? first.date.slice(0, 7) : first.date })} · {t('prices.source')}: {first.source_label}</p>
            {(varieties.length > 1 || packages.length > 1) && (
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                {varieties.length > 1 && field(t('prices.variety'), vSel, setVf, varieties)}
                {packages.length > 1 && field(t('prices.unit'), uSel, setUf, packages)}
              </div>)}
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left" style={{ color: 'var(--muted)' }}><th className="py-2">{t('prices.market')}</th><th>{t('prices.variety')}</th><th>{t('prices.date')}</th>{mixedUnits && <th>{t('prices.unit')}</th>}{showRange && <><th>{t('prices.min')}</th><th>{t('prices.max')}</th></>}{showModal && <th>{showRange ? t('prices.modal') : t('prices.price')}</th>}</tr></thead>
              <tbody>{shown.map((r) => (
                <tr key={`${r.market}-${r.variety}-${r.grade}-${r.unit}`} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2 font-semibold">{r.market}<div className="text-xs font-normal" style={{ color: 'var(--muted)' }}>{[r.district, r.state].filter(Boolean).join(', ')}</div></td>
                  <td>{r.variety || '—'}{r.grade && <div className="text-xs" style={{ color: 'var(--muted)' }}>{r.grade}</div>}</td><td>{r.period === 'monthly' ? r.date.slice(0, 7) : r.date}</td>
                  {mixedUnits && <td>{unitLabel(r.unit)}</td>}
                  {showRange && <><td>{r.min != null ? money(r.min) : '—'}</td><td>{r.max != null ? money(r.max) : '—'}</td></>}
                  {showModal && <td className="font-semibold">{r.modal != null ? money(r.modal) : '—'}</td>}</tr>))}</tbody>
            </table></div>
            {rows.length > shown.length && <button type="button" className="mt-3 min-h-11 rounded-xl border px-4 text-sm font-semibold" style={style} onClick={() => setShowAll(true)}>{t('prices.showAll', { n: rows.length })}</button>}
            <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>{t('prices.showing', { shown: shown.length, matching: rows.length })}{total > all.length && ` · ${t('prices.truncated', { shown: all.length, total })}`}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{mixedUnits ? t('prices.perPackage') : t('prices.perUnit', { unit: unitLabel(first.unit) })} · {showRange && `${t(showModal ? 'prices.modalExplain' : 'prices.rangeExplain')} `}{t('pages.limits')}</p>
          </Card>
          <Card><b>{t('prices.history')}</b>
            {history.data?.needs ? <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{t(history.data.needs === 'unit' ? 'prices.historyPickUnit' : 'prices.historyPickVariety')}</p>
              : series.length > 1 ? <PriceChart data={series} demo={false} /> : <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{t('prices.historyThin')}</p>}
            <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{t(first.period === 'monthly' ? 'prices.historyHintMonthly' : history.data?.basis === 'midpoint' ? 'prices.historyHintMid' : 'prices.historyHint', { unit: unitLabel(history.data?.unit ?? first.unit) })}</p></Card>
        </div>)}
      {!hasLive && !latest.isError && latest.isSuccess && (
        <Card><p className="text-sm font-semibold">{t('prices.noData')}</p><p className="text-sm" style={{ color: 'var(--muted)' }}>{t('prices.noDataHint')}</p></Card>)}
      {!hasLive && latest.isSuccess && demo && (
        <section className="mt-6" aria-label="Demo prices">
          <div className="mb-3 flex items-center gap-3"><DemoBadge /><span className="text-sm" style={{ color: 'var(--muted)' }}>{t('prices.liveNotConnected', { region: t(region.nameKey) })}</span></div>
          <div className="grid gap-5 lg:grid-cols-2 opacity-80">
            <Card><div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left" style={{ color: 'var(--muted)' }}><th className="py-2">{t('home.cropLabel')}</th><th>{t('prices.market')}</th><th>{t('prices.min')}</th><th>{t('prices.max')}</th><th>{t('prices.modal')}</th></tr></thead>
              <tbody>{demo.prices.map((p) => (
                <tr key={p.commodity} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2 font-semibold">{t(`commodities.${p.commodity}`)}</td><td>{p.market}</td>
                  <td>{money(p.min)}</td><td>{money(p.max)}</td><td>{money(p.modal)} / {t(`units.${p.unit}`)}</td></tr>))}</tbody>
            </table></div></Card>
            <Card><b>{t('home.priceTrend')}</b><PriceChart data={demo.series} /></Card>
          </div>
        </section>)}
      {!demo && !hasLive && latest.isSuccess && <EmptyRegion />}
    </main>
  )
}

export function Forecasting() {
  const { t } = useTranslation()
  const { region } = useMoney()
  const demo = getDemo(region.code)
  return (
    <Shell title={t('nav.forecasting')}>
      {demo ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2"><PriceChart data={demo.series} height={300} />
            <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>Demo values only. Not a real forecast.</p></Card>
          <Card className="space-y-2 text-sm">
            <b>Forecast details</b>
            {['Predicted price', 'Lower bound', 'Upper bound', 'Model version', 'Training data cutoff', 'MAE / RMSE / WAPE'].map((k) => (
              <div key={k} className="flex justify-between"><span style={{ color: 'var(--muted)' }}>{k}</span><span>[from trained model]</span></div>))}
            <p className="pt-2 text-xs" style={{ color: 'var(--muted)' }}>A forecast is an estimate, not a guaranteed price. {t('pages.limits')}</p>
          </Card>
        </div>
      ) : <EmptyRegion />}
    </Shell>
  )
}
