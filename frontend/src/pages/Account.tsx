import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { getDemo } from '../data/demo'
import { formatMoney, formatNumber } from '../utils/format'
import PriceChart from '../components/PriceChart'
import { Card, DemoBadge, EmptyRegion, btnGhost, btnPrimary } from '../components/ui'

/** Phase 1 has no backend: this screen only demonstrates the flow. Real Google sign-in comes in Phase 2. */
export function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Card className="space-y-4">
        <div className="flex items-center gap-3"><h1 className="font-display text-2xl font-extrabold">{t('nav.login')}</h1><DemoBadge label={t('demo.badge')} /></div>
        <button className={`${btnGhost} w-full`} disabled title="Available in Phase 2">Google (Phase 2)</button>
        <p className="text-sm font-semibold">{t('pages.chooseRole')}</p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('pages.loginDemo')}. {t('demo.notice')}</p>
        <div className="grid grid-cols-2 gap-3">
          <button className={btnPrimary} onClick={() => navigate('/dashboard/farmer')}>{t('pages.farmer')}</button>
          <button className={btnGhost} onClick={() => navigate('/dashboard/buyer')}>{t('pages.buyer')}</button>
        </div>
      </Card>
    </main>
  )
}

export function FarmerDashboard() {
  const { t } = useTranslation()
  const { region } = useRegion()
  const { language } = useLanguage()
  const demo = getDemo(region.code)
  if (!demo) return <main className="mx-auto max-w-6xl px-4 py-8"><EmptyRegion /></main>
  const d = demo.dashboard
  const stats: [string, string][] = [
    [t('pages.activeListings'), formatNumber(d.active, language.code)],
    [t('pages.inventory'), `${formatNumber(d.inventory, language.code)} ${t(`units.${d.unit}`)}`],
    ['Sold', `${formatNumber(d.sold, language.code)} ${t(`units.${d.unit}`)}`],
    [t('pages.inquiries'), formatNumber(d.inquiries, language.code)],
  ]
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold">{t('pages.farmerDashboard')}</h1><DemoBadge />
        <button className={`${btnPrimary} ml-auto`}>+ {t('pages.newListing')}</button>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([k, v]) => <Card key={k}><div className="text-sm" style={{ color: 'var(--muted)' }}>{k}</div><div className="font-display text-2xl font-extrabold text-brand">{v}</div></Card>)}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2"><b>{t('home.featuredListings')}</b>
          <table className="mt-2 w-full text-sm"><tbody>{demo.listings.map((l) => (
            <tr key={l.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
              <td className="py-2 font-semibold">{t(`commodities.${l.commodity}`)}</td><td>{l.variety}</td>
              <td>{formatNumber(l.qty, language.code)} {t(`units.${l.unit}`)}</td>
              <td>{formatMoney(l.price, region, language.code)}</td></tr>))}</tbody></table></Card>
        <Card><b>{t('home.priceTrend')}</b><PriceChart data={demo.series} height={180} /></Card>
      </div>
      <Card><b>{t('home.aiPreview')}</b> <DemoBadge label={t('demo.badge')} />
        <p className="mt-2 text-sm">{t('pages.shell')}</p><p className="text-xs" style={{ color: 'var(--muted)' }}>{t('pages.limits')}</p></Card>
    </main>
  )
}

export function BuyerDashboard() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center gap-3"><h1 className="font-display text-3xl font-extrabold">{t('pages.buyer')}</h1><DemoBadge /></div>
      <Card className="mt-5"><p className="text-sm">{t('pages.shell')}</p></Card>
    </main>
  )
}
