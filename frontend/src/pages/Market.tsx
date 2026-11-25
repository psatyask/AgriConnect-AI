import { useTranslation } from 'react-i18next'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { getDemo } from '../data/demo'
import { formatMoney, formatNumber } from '../utils/format'
import PriceChart from '../components/PriceChart'
import CropIcon, { cropBg } from '../components/art/CropIcon'
import { Card, DemoBadge, EmptyRegion, btnPrimary } from '../components/ui'

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
  return (
    <Shell title={t('nav.marketplace')}>
      <div className="grid gap-5 md:grid-cols-[240px_1fr]">
        <Card className="h-fit space-y-3">
          <b>{t('pages.filters')}</b>
          {['cropLabel', 'locationLabel'].map((k) => (
            <label key={k} className="flex flex-col gap-1 text-xs font-semibold">{t(`home.${k}`)}
              <input className="min-h-11 rounded-xl border bg-transparent px-3 text-sm font-normal" style={{ borderColor: 'var(--border)' }} /></label>
          ))}
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{region.hierarchy.slice(1).join(' / ')}</p>
        </Card>
        {demo ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {demo.listings.map((l) => (
              <li key={l.id}><Card className="h-full overflow-hidden !p-0 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-20 items-center justify-center" style={{ background: cropBg(l.commodity) }}><CropIcon id={l.commodity} size={48} /></div>
                <div className="p-5"><b>{t(`commodities.${l.commodity}`)} · {l.variety} · {l.grade}</b>
                <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{l.place}</div>
                <div className="mt-3 font-display text-xl font-extrabold text-brand">{money(l.price)} / {t(`units.${l.unit}`)}</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>{formatNumber(l.qty, language.code)} {t(`units.${l.unit}`)} {t('home.available')}</div>
                <button className={`${btnPrimary} mt-3`}>Send inquiry</button></div>
              </Card></li>
            ))}
          </ul>
        ) : <EmptyRegion />}
      </div>
      <p className="mt-6 text-xs" style={{ color: 'var(--muted)' }}>Phone numbers and emails stay hidden until the farmer consents.</p>
    </Shell>
  )
}

export function Intelligence() {
  const { t } = useTranslation()
  const { region, money } = useMoney()
  const demo = getDemo(region.code)
  return (
    <Shell title={t('nav.intelligence')}>
      {demo ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left" style={{ color: 'var(--muted)' }}><th className="py-2">{t('home.cropLabel')}</th><th>Market</th><th>Min</th><th>Max</th><th>Modal</th></tr></thead>
            <tbody>{demo.prices.map((p) => (
              <tr key={p.commodity} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="py-2 font-semibold">{t(`commodities.${p.commodity}`)}</td><td>{p.market}</td>
                <td>{money(p.min)}</td><td>{money(p.max)}</td><td>{money(p.modal)} / {t(`units.${p.unit}`)}</td></tr>))}</tbody>
          </table></div>
          <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>{t('pages.limits')} Data freshness: demo, not live.</p></Card>
          <Card><b>{t('home.priceTrend')}</b><PriceChart data={demo.series} /></Card>
        </div>
      ) : <EmptyRegion />}
    </Shell>
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
