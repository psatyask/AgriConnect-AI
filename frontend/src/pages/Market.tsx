import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ListingCard from '../components/ListingCard'
import { useListings } from '../api/listings'
import { useLatestPrices, useLocations, usePriceHistory, type Scope } from '../api/prices'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { getDemo } from '../data/demo'
import { formatMoney, formatNumber } from '../utils/format'
import PriceChart from '../components/PriceChart'
import PriceLedger, { groupRows, type Line } from '../components/PriceLedger'
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
  const { language } = useLanguage()
  const { region, money } = useMoney()
  const demo = getDemo(region.code)
  const [scope, setScope] = useState<Scope>({ commodity: region.commodities[0].id, state: '', district: '', market: '' })
  const locations = useLocations(region.code, scope.commodity)
  const latest = useLatestPrices(region.code, scope)
  const [vf, setVf] = useState(''), [line, setLine] = useState<Line | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const states = locations.data?.states ?? []
  const districts = states.find((s) => s.state === scope.state)?.districts ?? []
  const hasDistricts = states.some((s) => s.districts.some((d) => d.district !== ''))
  // Sources without a district level (US terminal markets) list their markets straight under the state.
  const markets = hasDistricts ? (districts.find((d) => d.district === scope.district)?.markets ?? []) : districts.flatMap((d) => d.markets)
  const hasMarkets = states.some((s) => s.districts.some((d) => d.markets.some((m) => m !== 'State average')))
  const all = latest.data?.items ?? []
  const total = latest.data?.total ?? all.length
  const checkedAt = latest.data?.checked_at ? new Date(latest.data.checked_at) : null
  const stale = checkedAt != null && Date.now() - checkedAt.getTime() > 48 * 3600 * 1000  // the automatic refresh should keep this well under a day
  const varieties = [...new Set(all.map((r) => r.variety).filter(Boolean))].sort()
  const vSel = varieties.includes(vf) ? vf : ''  // a filter from another crop quietly resets
  const rows = all.filter((r) => !vSel || r.variety === vSel)
  const groups = groupRows(rows)
  const first = rows[0] ?? all[0]  // filters can match nothing; the header still describes the source
  // The chart follows the line you pick; until you pick one (or if it is filtered away) it shows the first line of the biggest group.
  const top = groups[0]?.rows[0]
  const chosen: Line | null = line && rows.some((r) => r.variety === line.variety && r.unit === line.unit) ? line : top ? { variety: top.variety, unit: top.unit } : null
  const history = usePriceHistory(region.code, scope, chosen?.variety ?? '', chosen?.unit ?? '')
  const showRange = rows.some((r) => r.min != null || r.max != null)
  const showModal = rows.some((r) => r.modal != null)  // USDA terminal markets report a low-high range, never a modal price
  const showMarket = !scope.market  // name the market on each line unless one market is already chosen
  const unitLabel = (u: string) => t(`units.${u}`, { defaultValue: u })
  const hasLive = all.length > 0
  const pick = (patch: Partial<Scope>) => setScope((p) => ({ ...p, ...patch }))
  const sel = 'min-h-11 rounded-xl border px-3 text-sm'
  const style = { borderColor: 'var(--border)', background: 'var(--card)' }
  const field = (label: string, value: string, onChange: (v: string) => void, options: string[], disabled = false) => (
    <label className="flex flex-col gap-1 text-xs font-semibold">{label}
      <select className={sel} style={style} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('prices.allOf')}</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>)
  const points = history.data?.points ?? []
  const lastPt = points.at(-1), firstPt = points[0]
  const delta = lastPt && firstPt && points.length > 1 ? Math.round((lastPt.price - firstPt.price) * 100) / 100 : null
  const pickLine = (l: Line) => {
    setLine(l)
    if (window.matchMedia?.('(max-width: 1023px)').matches) chartRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })  // the chart sits above the list on phones
  }
  const filtersActive = scope.state || scope.district || scope.market || vSel
  const chartName = chosen ? (chosen.variety || t(region.commodities.find((c) => c.id === scope.commodity)?.nameKey ?? 'home.cropLabel')) : ''
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <h1 className="font-display text-3xl font-extrabold">{t('nav.intelligence')}</h1>
        {hasLive && first && (
          <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm" style={{ color: 'var(--muted)' }}>
            <span>{t('prices.asOf', { date: first.period === 'monthly' ? first.date.slice(0, 7) : first.date })}</span>
            <span>{t('prices.source')}: {first.source_label}</span>
            {checkedAt && <span>{t('prices.checkedAt', { when: checkedAt.toLocaleString(language.code, { dateStyle: 'medium', timeStyle: 'short' }) })}</span>}
          </p>)}
      </div>
      {stale && <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">{t('prices.stale')}</p>}
      <Card className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        <label className="flex flex-col gap-1 text-xs font-semibold">{t('home.cropLabel')}
          <select className={sel} style={style} value={scope.commodity} onChange={(e) => { setScope({ commodity: e.target.value, state: '', district: '', market: '' }); setLine(null) }}>
            {region.commodities.map((c) => <option key={c.id} value={c.id}>{t(c.nameKey)}</option>)}</select></label>
        {field(t('prices.state'), scope.state, (v) => pick({ state: v, district: '', market: '' }), states.map((s) => s.state), states.length === 0)}
        {hasDistricts && field(t('prices.district'), scope.district, (v) => pick({ district: v, market: '' }), districts.map((d) => d.district), !scope.state)}
        {hasMarkets && field(t('prices.market'), scope.market, (v) => pick({ market: v }), markets, hasDistricts ? !scope.district : !scope.state)}
        {varieties.length > 1 && field(t('prices.variety'), vSel, setVf, varieties)}
        {filtersActive && (
          <button type="button" className="col-span-2 min-h-11 self-end rounded-xl px-3 text-sm font-semibold hover:bg-brand/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand lg:col-span-1 lg:justify-self-start" style={{ color: 'var(--link)' }}
            onClick={() => { pick({ state: '', district: '', market: '' }); setVf('') }}>{t('prices.clearFilters')}</button>)}
      </Card>
      {(latest.isError || locations.isError) && <p role="alert" className="mb-4 text-sm text-red-600">{t('prices.loadFail')}</p>}
      {latest.isLoading && (
        <div aria-busy="true" role="status" className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <span className="sr-only">{t('prices.loading')}</span>
          <Card className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg" style={{ background: 'var(--border)' }} />)}</Card>
          <Card><div className="h-56 animate-pulse rounded-lg" style={{ background: 'var(--border)' }} /></Card>
        </div>)}
      {hasLive && (
        <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <div ref={chartRef} className="lg:order-2 lg:sticky lg:top-4 lg:self-start">
            <Card>
              <h2 className="font-display text-lg font-extrabold">{t('prices.history')}</h2>
              {chosen && <p className="text-sm" style={{ color: 'var(--muted)' }}>{chartName} · {unitLabel(chosen.unit)} · {t('prices.chartLines', { count: rows.filter((r) => r.variety === chosen.variety && r.unit === chosen.unit).length })}</p>}
              {lastPt && (
                <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
                  <span className="font-display text-2xl font-extrabold tabular-nums">{money(lastPt.price)}</span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{t(history.data?.basis === 'midpoint' ? 'prices.latestMid' : 'prices.latestModal', { date: lastPt.date })}</span>
                </p>)}
              {delta != null && firstPt && (
                <p className="text-sm font-semibold tabular-nums">
                  {t(delta > 0 ? 'prices.trendUp' : delta < 0 ? 'prices.trendDown' : 'prices.trendFlat', { amount: money(Math.abs(delta)), date: firstPt.date })}</p>)}
              {history.isLoading ? <div aria-busy="true" className="mt-3 h-56 animate-pulse rounded-lg" style={{ background: 'var(--border)' }}><span className="sr-only">{t('prices.loading')}</span></div>
                : history.data?.needs ? <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>{t(history.data.needs === 'unit' ? 'prices.historyPickUnit' : 'prices.historyPickVariety')}</p>
                : points.length > 1 ? <div className="mt-2"><PriceChart data={points.map((p) => ({ label: p.date.slice(5), price: p.price, forecast: null }))} demo={false} /></div>
                  : <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>{t('prices.historyThin')}</p>}
              {history.data && <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{t(first.period === 'monthly' ? 'prices.historyHintMonthly' : history.data?.basis === 'midpoint' ? 'prices.historyHintMid' : 'prices.historyHint', { unit: unitLabel(history.data?.unit ?? first.unit) })}</p>}
            </Card>
          </div>
          <Card className="lg:order-1">
            <PriceLedger groups={groups} selected={chosen} onSelect={pickLine} money={money} unitLabel={unitLabel} showMarket={showMarket} />
            {rows.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('prices.noMatch')}</p>}
            <p className="mt-4 text-xs" style={{ color: 'var(--muted)' }}>{t('prices.showing', { count: rows.length, shown: rows.length, matching: rows.length })}{total > all.length && ` · ${t('prices.truncated', { shown: all.length, total })}`}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{groups.length > 1 ? t('prices.perPackage') : t('prices.perUnit', { unit: unitLabel(first.unit) })} · {showRange && `${t(showModal ? 'prices.modalExplain' : 'prices.rangeExplain')} `}{t('pages.limits')}</p>
          </Card>
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
