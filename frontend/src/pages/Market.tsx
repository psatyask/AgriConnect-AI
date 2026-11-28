import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ListingCard from '../components/ListingCard'
import { useListings } from '../api/listings'
import { useLatestPrices, useLocations, useDirectionSignal, usePriceForecast, useSignalOverview, usePriceHistory, type Scope } from '../api/prices'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { getDemo } from '../data/demo'
import { formatMoney, formatNumber } from '../utils/format'
import PriceChart from '../components/PriceChart'
import CropOptions from '../components/CropOptions'
import PriceLedger, { groupRows, type Line, type LedgerRow } from '../components/PriceLedger'
import { kgPerPackage } from '../utils/units'
import { AccuracyMeter, LeanBar, ProbGauge } from '../components/Lean'
import CropIcon, { cropBg } from '../components/art/CropIcon'
import { Card, DemoBadge, EmptyRegion } from '../components/ui'

function Shell({ title, children, live }: { title: string; children: React.ReactNode; live?: boolean }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex items-center gap-3"><h1 className="font-display text-3xl font-extrabold">{title}</h1>{!live && <DemoBadge />}</div>
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
              <CropOptions crops={region.commodities} />
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
  const [params] = useSearchParams()
  const wanted = params.get('crop')
  const [scope, setScope] = useState<Scope>({ commodity: region.commodities.some((c) => c.id === wanted) ? wanted! : region.commodities[0].id, state: '', district: '', market: '' })
  const locations = useLocations(region.code, scope.commodity)
  const latest = useLatestPrices(region.code, scope)
  const [vf, setVf] = useState(''), [line, setLine] = useState<Line | null>(null), [mode, setMode] = useState<'auto' | 'reported' | 'base'>('auto')
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
  // One common scale: the region's everyday weight unit (lb in the US, kg in India). Only lines whose package names a weight
  // are converted; the rest stay in their own package groups, because guessing a weight would be inventing a price.
  const baseUnit = region.units[0]
  const kgOf = (unit: string) => (baseUnit?.toKg ? kgPerPackage(unit, region, scope.commodity) : null)
  const canConvert = rows.some((r) => r.unit !== baseUnit?.id && kgOf(r.unit) != null)
  const perBase = canConvert && (mode === 'base' || (mode === 'auto' && new Set(rows.map((r) => r.unit)).size > 1))  // mixed packages default to one scale
  const view: LedgerRow[] = perBase ? rows.map((r) => {
    const kg = kgOf(r.unit)
    if (kg == null) return r
    const f = (baseUnit.toKg as number) / kg, conv = (v: number | null) => (v == null ? null : v * f)
    return { ...r, min: conv(r.min), max: conv(r.max), modal: conv(r.modal), unit: baseUnit.id, srcUnit: r.unit }
  }) : rows
  const groups = groupRows(view)
  const first = rows[0] ?? all[0]  // filters can match nothing; the header still describes the source
  // The chart follows the line you pick; until you pick one (or if it is filtered away) it shows the first line of the biggest group.
  const top = groups[0]?.rows[0]
  const topSrc = top ? { variety: top.variety, unit: top.srcUnit ?? top.unit } : null
  const chosen: Line | null = line && rows.some((r) => r.variety === line.variety && r.unit === line.unit) ? line : topSrc
  const history = usePriceHistory(region.code, scope, chosen?.variety ?? '', chosen?.unit ?? '')
  const dailyOnly = (rows[0] ?? all[0])?.period !== 'monthly'
  const fc = usePriceForecast(region.code, scope, chosen?.variety ?? '', chosen?.unit ?? '', !!chosen && !!history.data && !history.data.needs && dailyOnly)
  const sig = useDirectionSignal(region.code, scope, chosen?.variety ?? '', chosen?.unit ?? '', !!chosen && dailyOnly).data
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
  const chartKg = perBase && chosen ? kgOf(chosen.unit) : null
  const chartF = chartKg != null ? (baseUnit.toKg as number) / chartKg : 1  // the chart is converted the same way as the list
  const chartUnit = chartKg != null ? baseUnit.id : chosen?.unit ?? ''
  const points = (history.data?.points ?? []).map((p) => ({ ...p, price: p.price * chartF }))
  const f = fc.data?.status === 'ok' ? fc.data : null
  const chartData = points.map((p) => ({ label: p.date.slice(5), price: p.price, forecast: null as number | null, band: null as [number, number] | null }))
  if (f && f.value != null && f.low != null && f.high != null && f.target_date && chartData.length) {
    chartData[chartData.length - 1].forecast = chartData[chartData.length - 1].price  // joins the dashed line to the last report
    chartData.push({ label: f.target_date.slice(5), price: null as unknown as number, forecast: f.value * chartF, band: [f.low * chartF, f.high * chartF] })
  }
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
      {hasLive && all.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }} data-testid="snapshot">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: cropBg(scope.commodity) }}><CropIcon id={scope.commodity} size={48} /></span>
          <div className="min-w-40"><p className="font-display text-2xl font-extrabold">{t(region.commodities.find((c) => c.id === scope.commodity)?.nameKey ?? 'home.cropLabel')}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('prices.snapshot.where', { scope: scope.market || scope.state || region.code })}</p></div>
          {([[total, t('prices.snapshot.lines')], [new Set(all.map((r) => r.market)).size, t('prices.snapshot.markets')], [new Set(all.map((r) => r.unit)).size, t('prices.snapshot.packages')]] as const).map(([n, label]) => (
            <div key={label} className="rounded-xl px-4 py-2" style={{ background: 'var(--bg)' }}><p className="font-display text-xl font-extrabold tabular-nums">{n}</p><p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p></div>))}
        </div>)}
      {stale && <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">{t('prices.stale')}</p>}
      <Card className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        <label className="flex flex-col gap-1 text-xs font-semibold">{t('home.cropLabel')}
          <select className={sel} style={style} value={scope.commodity} onChange={(e) => { setScope({ commodity: e.target.value, state: '', district: '', market: '' }); setLine(null) }}>
            <CropOptions crops={region.commodities} /></select></label>
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
              {chosen && <p className="text-sm" style={{ color: 'var(--muted)' }}>{chartName} · {chartKg != null ? t('prices.perBase', { unit: unitLabel(chartUnit) }) : unitLabel(chartUnit)} · {t('prices.chartLines', { count: rows.filter((r) => r.variety === chosen.variety && r.unit === chosen.unit).length })}</p>}
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
                : points.length > 1 ? <div className="mt-2"><PriceChart data={chartData} demo={false} /></div>
                  : <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>{t('prices.historyThin')}</p>}
              {history.data && !history.data.needs && points.length > 1 && (
                <div className="mt-3 rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }} data-testid="forecast">
                  <b>{t('prices.forecast.title')}</b>
                  {!dailyOnly ? <p style={{ color: 'var(--muted)' }}>{t('prices.forecast.none.daily_only')}</p>
                    : fc.isLoading ? <p style={{ color: 'var(--muted)' }}>{t('prices.loading')}</p>
                    : f && f.value != null ? (<>
                        <p className="font-semibold tabular-nums">{t('prices.forecast.ok', { value: money(f.value * chartF), date: f.target_date, low: money((f.low ?? f.value) * chartF), high: money((f.high ?? f.value) * chartF) })}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('prices.forecast.evidence', { model: t(`prices.forecast.model.${f.model}`), skill: Math.round((f.holdout_skill ?? 0) * 100), n: f.holdout_tests })} {t('prices.forecast.range')}</p></>)
                    : fc.data ? <p style={{ color: 'var(--muted)' }}>{t(`prices.forecast.none.${fc.data.reason}`, { defaultValue: t('prices.forecast.none.too_little_history') })}</p> : null}
                </div>)}
              {sig?.status === 'ok' && sig.p_up != null && sig.evidence && (
                <div className="mt-3 rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }} data-testid="signal">
                  <b>{t('prices.signal.title')}</b>
                  <p className="mt-1 font-semibold">{sig.p_up >= 0.6 ? t('prices.signal.up', { pct: Math.round(sig.p_up * 100) })
                    : sig.p_up <= 0.4 ? t('prices.signal.down', { pct: Math.round((1 - sig.p_up) * 100) }) : t('prices.signal.flat')}</p>
                  <ProbGauge pUp={sig.p_up} />
                  {sig.other_markets_change != null && (
                    <p className="mt-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums" style={{ borderColor: 'var(--border)', color: sig.other_markets_change >= 0 ? 'var(--up)' : 'var(--down)' }}>
                      {sig.other_markets_change >= 0 ? '▲' : '▼'} {t('prices.signal.others', { change: `${sig.other_markets_change >= 0 ? '+' : ''}${((Math.exp(sig.other_markets_change) - 1) * 100).toFixed(1)}%`, date: sig.as_of })}</p>)}
                  <div className="mt-3 max-w-xs"><AccuracyMeter auc={sig.evidence.auc} /></div>
                  <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{t('prices.signal.note', { auc: Math.round(sig.evidence.auc * 100), n: sig.evidence.tests })}</p>
                </div>)}
              {history.data && <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{t(first.period === 'monthly' ? 'prices.historyHintMonthly' : history.data?.basis === 'midpoint' ? 'prices.historyHintMid' : 'prices.historyHint', { unit: unitLabel(chartUnit || (history.data?.unit ?? first.unit)) })}</p>}
            </Card>
          </div>
          <Card className="lg:order-1">
            {canConvert && (
              <div role="group" aria-label={t('prices.scale')} className="mb-4 inline-flex rounded-xl border p-0.5" style={style}>
                {([['reported', t('prices.asReported'), !perBase], ['base', t('prices.perBase', { unit: unitLabel(baseUnit.id) }), perBase]] as const).map(([m, label, on]) => (
                  <button key={m} type="button" aria-pressed={on} onClick={() => setMode(m)}
                    className={`min-h-11 rounded-[10px] px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${on ? 'bg-brand text-white' : ''}`}>{label}</button>))}
              </div>)}
            <PriceLedger groups={groups} selected={chosen} onSelect={pickLine} money={money} unitLabel={unitLabel} showMarket={showMarket} convertedTo={perBase ? baseUnit.id : undefined} />
            {rows.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('prices.noMatch')}</p>}
            <p className="mt-4 text-xs" style={{ color: 'var(--muted)' }}>{t('prices.showing', { count: rows.length, shown: rows.length, matching: rows.length })}{total > all.length && ` · ${t('prices.truncated', { shown: all.length, total })}`}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{perBase ? t('prices.convertNote', { unit: unitLabel(baseUnit.id) }) : groups.length > 1 ? t('prices.perPackage') : t('prices.perUnit', { unit: unitLabel(first.unit) })} · {showRange && `${t(showModal ? 'prices.modalExplain' : 'prices.rangeExplain')} `}{t('pages.limits')}</p>
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
  const ov = useSignalOverview(region.code)
  const [sort, setSort] = useState<'auc' | 'up' | 'down' | 'name'>('auc')
  const name = (id: string) => t(region.commodities.find((c) => c.id === id)?.nameKey ?? 'home.cropLabel')
  const items = [...(ov.data?.items ?? [])].sort((a, b) =>
    sort === 'up' ? b.up / (b.up + b.down + b.even) - a.up / (a.up + a.down + a.even)
    : sort === 'down' ? b.down / (b.up + b.down + b.even) - a.down / (a.up + a.down + a.even)
    : sort === 'name' ? name(a.commodity).localeCompare(name(b.commodity)) : b.auc - a.auc)
  const sum = items.reduce((s, i) => ({ up: s.up + i.up, down: s.down + i.down, even: s.even + i.even }), { up: 0, down: 0, even: 0 })
  const newest = items.reduce((m, i) => (i.as_of > m ? i.as_of : m), '')
  const verdict = (i: { up: number; down: number; even: number }) => (i.up > 2 * i.down ? 'up' : i.down > 2 * i.up ? 'down' : 'mixed')
  const tile = (label: string, value: string | number, color?: string) => (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <p className="font-display text-3xl font-extrabold tabular-nums" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{label}</p></div>)
  return (
    <Shell title={t('nav.forecasting')} live>
      <div className="space-y-5" data-testid="signals-page">
        <Card className="space-y-2 text-sm">
          <p>{t('forecastPage.intro')}</p>
          <p style={{ color: 'var(--muted)' }}>{t('forecastPage.how')}</p>
        </Card>
        {ov.isLoading ? <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('prices.loading')}</p>
          : items.length === 0 ? <Card><p className="text-sm" style={{ color: 'var(--muted)' }}>{t('forecastPage.empty')}</p></Card>
          : (<>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {tile(t('forecastPage.tProducts'), items.length)}
              {tile(t('forecastPage.tUp'), sum.up, 'var(--up)')}
              {tile(t('forecastPage.tDown'), sum.down, 'var(--down)')}
              {tile(t('forecastPage.tNewest'), newest)}
            </div>
            <Card>
              <p className="mb-2 text-sm font-semibold">{t('forecastPage.overall')}</p>
              <LeanBar {...sum} />
            </Card>
            <label className="flex items-center gap-2 text-xs font-semibold">{t('forecastPage.sort')}
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-lg border px-2 py-1.5 text-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <option value="auc">{t('forecastPage.sAcc')}</option><option value="up">{t('forecastPage.sUp')}</option>
                <option value="down">{t('forecastPage.sDown')}</option><option value="name">{t('forecastPage.sName')}</option></select></label>
            <p className="text-xs" style={{ color: 'var(--muted)' }} data-testid="legend">{t('forecastPage.legend')}</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((i) => (
                <li key={i.commodity}>
                  <Link to={`/intelligence?crop=${i.commodity}`} className="block rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: cropBg(i.commodity) }}><CropIcon id={i.commodity} size={36} /></span>
                      <span className="font-display text-lg font-extrabold">{name(i.commodity)}</span>
                    </div>
                    <p className="mb-2 text-sm font-semibold" style={{ color: verdict(i) === 'up' ? 'var(--up)' : verdict(i) === 'down' ? 'var(--down)' : 'var(--muted)' }}>
                      {verdict(i) === 'up' ? '▲ ' : verdict(i) === 'down' ? '▼ ' : ''}{t(`forecastPage.verdict.${verdict(i)}`)}</p>
                    <LeanBar up={i.up} down={i.down} even={i.even} />
                    <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{t('forecastPage.listings', { up: i.up, down: i.down, n: i.up + i.down + i.even })}</p>
                    <p className="mb-1 mt-3 text-xs font-semibold">{t('forecastPage.pastAccuracy')}</p>
                    <AccuracyMeter auc={i.auc} />
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>{t('forecastPage.auc', { auc: Math.round(i.auc * 100), n: i.tests })}</p>
                  </Link>
                </li>))}
            </ul>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('forecastPage.note', { date: ov.data?.evaluated_through })}</p>
          </>)}
      </div>
    </Shell>
  )
}
