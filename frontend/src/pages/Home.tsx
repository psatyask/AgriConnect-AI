import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BarChart3, Globe, MessageCircle, Search, Sparkles, Sprout, Store, TrendingUp, Users } from 'lucide-react'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { getDemo } from '../data/demo'
import { formatMoney, formatNumber } from '../utils/format'
import PriceChart from '../components/PriceChart'
import HeroArt from '../components/art/HeroArt'
import { FieldBand, HeroPattern, MiniGraph } from '../components/art/Decor'
import { LANGUAGES } from '../config/languages'
import CropIcon, { cropBg } from '../components/art/CropIcon'
import { Card, DemoBadge, EmptyRegion, Section, btnGhost, btnPrimary } from '../components/ui'

const STEPS: [typeof Sprout, string][] = [[Sprout, 'Farmers list their crops'], [Search, 'Buyers search and compare'], [MessageCircle, 'Chat and agree directly'], [BarChart3, 'Use market data and AI to decide']]
const BENEFITS: [string, string][] = [
  ['Farmers', 'Reach buyers directly, see reported market prices, and get evidence-based suggestions.'],
  ['Buyers', 'Find crops by region, compare farmers, and post what you need.'],
]
const FAQ = [
  ['Are the prices guaranteed?', 'No. Market prices are reports from public sources, not guaranteed selling prices.'],
  ['Is this live data?', 'Not yet. Everything marked DEMO is sample content used to show the layout.'],
]

export default function Home() {
  const { t } = useTranslation()
  const { region, regions } = useRegion()
  const { language } = useLanguage()
  const demo = getDemo(region.code)
  const money = (n: number) => formatMoney(n, region, language.code)

  return (
    <>
      <section className="mx-auto mt-6 max-w-6xl px-4">
        <div className="relative grid items-center gap-8 overflow-hidden rounded-3xl bg-forest p-8 text-white md:grid-cols-2 md:p-14">
          <HeroPattern />
          <div className="relative">
            <h1 className="font-display text-4xl font-extrabold leading-tight md:text-5xl">{t('hero.title')}</h1>
            <p className="mt-4 max-w-lg text-lg text-green-100">{t('hero.subtitle')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/marketplace" className="inline-flex min-h-12 items-center rounded-xl bg-lime px-6 font-bold text-forest">{t('hero.explore')}</Link>
              <Link to="/assistant" className="inline-flex min-h-12 items-center rounded-xl border-2 border-white px-6 font-semibold">{t('hero.ask')}</Link>
            </div>
          </div>
          <div className="relative">
            <HeroArt key={region.code} scene={region.heroImage.scene} label={t(region.heroImage.altKey)} src={region.heroImage.src} />
            <span className="absolute -left-3 top-6 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-forest shadow-lg"><Store size={14} className="text-brand" aria-hidden />Direct from farmers</span>
            <span className="absolute -right-2 top-24 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-forest shadow-lg"><TrendingUp size={14} className="text-brand" aria-hidden />Market prices</span>
            <span className="absolute -bottom-3 left-8 flex items-center gap-2 rounded-xl bg-lime px-3 py-2 text-xs font-bold text-forest shadow-lg"><Sparkles size={14} aria-hidden />AI insights</span>
            <p className="mt-5 text-center text-xs text-green-100/80">{t('hero.imageSlot')}</p>
          </div>
        </div>
      </section>

      <form className="relative z-10 mx-auto -mt-7 flex max-w-4xl flex-wrap items-end gap-3 rounded-2xl border p-4 shadow-lg"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }} onSubmit={(e) => e.preventDefault()}>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-semibold">{t('home.cropLabel')}
          <input className="min-h-11 rounded-xl border bg-transparent px-3 text-sm font-normal" style={{ borderColor: 'var(--border)' }}
            placeholder={region.commodities.slice(0, 3).map((c) => t(c.nameKey)).join(', ')} />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-semibold">{t('home.locationLabel')}
          <input className="min-h-11 rounded-xl border bg-transparent px-3 text-sm font-normal" style={{ borderColor: 'var(--border)' }}
            placeholder={region.hierarchy.slice(1).join(' / ')} />
        </label>
        <button className={`${btnPrimary} gap-2`}><Search size={16} aria-hidden />{t('home.search')}</button>
      </form>

      <ul className="mx-auto mt-10 grid max-w-6xl grid-cols-2 gap-3 px-4 md:grid-cols-4">
        {([[Globe, `${regions.length}`, 'Countries'], [Sprout, `${region.commodities.length}`, 'Crops in this region'],
          [Users, `${LANGUAGES.length}`, 'Languages listed'], [Store, `${demo?.listings.length ?? 0}`, 'Demo listings']] as const).map(([Icon, n, label]) => (
          <li key={label}><Card className="flex items-center gap-3 !p-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon size={22} aria-hidden /></span>
            <div><div className="font-display text-xl font-extrabold">{n}</div><div className="text-xs" style={{ color: 'var(--muted)' }}>{label}</div></div></Card></li>
        ))}
      </ul>

      <Section title={t('home.featuredCrops')}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {region.commodities.map((c) => (
            <li key={c.id}><Card className="flex h-full items-center gap-3 transition hover:-translate-y-0.5 hover:shadow-md">
              <CropIcon id={c.id} /><div><b>{t(c.nameKey)}</b>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>{t(c.categoryKey)}</div></div></Card></li>
          ))}
        </ul>
      </Section>

      <Section title={t('home.featuredListings')} badge>
        {demo ? (
          <ul className="grid gap-4 md:grid-cols-3">
            {demo.listings.map((l) => (
              <li key={l.id}><Card className="h-full overflow-hidden !p-0 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-24 items-center justify-center" style={{ background: cropBg(l.commodity) }}><CropIcon id={l.commodity} size={56} /></div>
                <div className="p-5"><b className="text-lg">{t(`commodities.${l.commodity}`)} · {l.variety} · {l.grade}</b>
                <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{l.place}</div>
                <div className="mt-3 font-display text-xl font-extrabold text-brand">{money(l.price)} / {t(`units.${l.unit}`)}</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>{formatNumber(l.qty, language.code)} {t(`units.${l.unit}`)} {t('home.available')}</div></div>
              </Card></li>
            ))}
          </ul>
        ) : <EmptyRegion />}
      </Section>

      <Section title={t('home.priceDashboard')} badge>
        {demo ? (
          <Card><div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left" style={{ color: 'var(--muted)' }}>
              <th className="py-2">{t('home.cropLabel')}</th><th>Market</th><th>Min</th><th>Max</th><th>Modal</th></tr></thead>
            <tbody>{demo.prices.map((p) => (
              <tr key={p.commodity} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="py-2 font-semibold">{t(`commodities.${p.commodity}`)}</td><td>{p.market}</td>
                <td>{money(p.min)}</td><td>{money(p.max)}</td><td>{money(p.modal)} / {t(`units.${p.unit}`)}</td></tr>))}</tbody>
          </table></div>
          <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>{t('pages.limits')}</p></Card>
        ) : <EmptyRegion />}
      </Section>

      <Section title={t('home.priceTrend')} badge>
        {demo ? <Card><PriceChart data={demo.series} />
          <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{t(`commodities.${demo.chartCommodity}`)} · {region.currency.code} / {t(`units.${demo.chartUnit}`)}</p></Card> : <EmptyRegion />}
      </Section>

      <Section title={t('home.aiPreview')} badge>
        <Card className="grid items-center gap-6 md:grid-cols-2">
          <div className="space-y-3 text-sm">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-forest px-4 py-3 text-white">{demo?.questions[0]}</div>
            <div className="flex gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand"><Sparkles size={16} aria-hidden /></span>
              <div className="rounded-2xl rounded-bl-sm p-3" style={{ background: 'var(--bg)' }}><p>{t('pages.shell')}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Market data · Forecast · Verified sources</p></div></div>
          </div>
          <div><p className="text-sm" style={{ color: 'var(--muted)' }}>{t('pages.limits')}</p>
            <Link to="/assistant" className={`${btnGhost} mt-4`}>{t('hero.ask')}</Link></div>
        </Card>
      </Section>

      <Section title={t('home.knowledgePreview')} badge>
        <Card className="grid items-center gap-4 md:grid-cols-2">
          {demo && <MiniGraph center={demo.graph.crop} nodes={[demo.graph.disease, demo.graph.market, demo.graph.soil, demo.graph.program]} />}
          <div><p className="text-sm" style={{ color: 'var(--muted)' }}>{demo ? `${demo.graph.crop} → ${demo.graph.disease}, ${demo.graph.market}, ${demo.graph.soil}, ${demo.graph.program}` : ''}</p>
            <Link to="/knowledge" className={`${btnGhost} mt-4`}>{t('nav.knowledge')}</Link></div>
        </Card>
      </Section>

      <FieldBand />
      <Section title={t('home.howItWorks')}>
        <ol className="grid gap-3 md:grid-cols-4">{STEPS.map(([Icon, s], i) => <li key={s}><Card className="h-full"><span className="flex items-center gap-2 font-bold text-brand"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10"><Icon size={18} aria-hidden /></span>{i + 1}</span><p className="mt-2 text-sm">{s}</p></Card></li>)}</ol>
      </Section>

      <Section title={t('home.benefits')}>
        <div className="grid gap-4 md:grid-cols-2">{BENEFITS.map(([h, p]) => <Card key={h}><span className="flex items-center gap-2">{h === 'Farmers' ? <Sprout className="text-brand" size={20} aria-hidden /> : <Users className="text-brand" size={20} aria-hidden />}<b>{h}</b></span><p className="mt-2 text-sm">{p}</p></Card>)}</div>
      </Section>

      <Section title={t('home.faq')}>
        <div className="space-y-2">{FAQ.map(([q, a]) => (
          <details key={q} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-2 text-sm">{a}</p></details>))}</div>
      </Section>

      <FieldBand />
      <footer className="bg-forest px-4 py-8 text-sm text-green-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <span className="font-display font-bold text-white">{t('brand.name')} · {t('brand.tagline')}</span>
          <span className="flex items-center gap-2"><DemoBadge label={t('demo.badge')} />{t('demo.notice')}</span>
        </div>
      </footer>
    </>
  )
}
