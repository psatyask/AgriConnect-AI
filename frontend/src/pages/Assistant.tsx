import { useTranslation } from 'react-i18next'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { getDemo } from '../data/demo'
import { Card, DemoBadge, EmptyRegion, btnPrimary } from '../components/ui'

export function Assistant() {
  const { t } = useTranslation()
  const { region } = useRegion()
  const { language } = useLanguage()
  const demo = getDemo(region.code)
  const q = demo?.questions ?? []
  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 md:grid-cols-[240px_1fr]">
      <Card className="h-fit space-y-2">
        <button className={`${btnPrimary} w-full`}>+ {t('pages.newChat')}</button>
        {q.slice(0, 2).map((s) => <div key={s} className="truncate rounded-lg bg-brand/10 px-3 py-2 text-sm">{s}</div>)}
      </Card>
      <Card className="flex min-h-[520px] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg border px-2 py-1" style={{ borderColor: 'var(--border)' }}>{region.flag} {region.code}</span>
          <span className="rounded-lg border px-2 py-1" style={{ borderColor: 'var(--border)' }}>{language.native}</span><DemoBadge label={t('demo.badge')} />
        </div>
        {demo ? (
          <>
            <div className="self-end rounded-2xl bg-forest px-4 py-3 text-sm text-white">{q[0]}</div>
            <div className="max-w-[85%] rounded-2xl p-4 text-sm" style={{ background: 'var(--bg)' }}>
              <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>▸ Market Agent retrieved reports · ▸ Forecast Agent called the model · ▸ Verification Agent checked freshness</p>
              <p>{t('pages.shell')}</p>
              <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{t('pages.limits')} Sources and uncertainty appear here.</p>
            </div>
          </>
        ) : <EmptyRegion />}
        <div className="mt-auto flex flex-wrap gap-2">{q.map((s) => <span key={s} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border)' }}>{s}</span>)}</div>
        <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
          <input className="min-h-11 flex-1 rounded-xl border bg-transparent px-3 text-sm" style={{ borderColor: 'var(--border)' }}
            placeholder={t('pages.askPlaceholder')} aria-label={t('pages.askPlaceholder')} />
          <button className={btnPrimary}>{t('pages.send')}</button>
        </form>
      </Card>
    </main>
  )
}

export function Knowledge() {
  const { t } = useTranslation()
  const { region } = useRegion()
  const g = getDemo(region.code)?.graph
  const nodes = g ? [[g.disease, 'AFFECTED_BY'], [g.market, 'SOLD_AT'], [g.soil, 'SUITABLE_FOR'], [g.program, 'APPLIES_TO']] : []
  const pos = [[110, 70], [490, 70], [110, 270], [490, 270]]
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex items-center gap-3"><h1 className="font-display text-3xl font-extrabold">{t('nav.knowledge')}</h1><DemoBadge /></div>
      {g ? (
        <Card>
          <svg viewBox="0 0 600 340" className="w-full" role="img" aria-label={`${g.crop}: ${nodes.map((n) => n[0]).join(', ')}`}>
            {nodes.map(([name, rel], i) => (
              <g key={name}>
                <line x1="300" y1="170" x2={pos[i][0]} y2={pos[i][1]} stroke="currentColor" opacity=".4" />
                <text x={(300 + pos[i][0]) / 2} y={(170 + pos[i][1]) / 2 - 4} textAnchor="middle" fontSize="10" fill="currentColor" opacity=".7">{rel}</text>
                <circle cx={pos[i][0]} cy={pos[i][1]} r="38" fill="#1d4ed8" opacity=".85" />
                <text x={pos[i][0]} y={pos[i][1] + 4} textAnchor="middle" fontSize="11" fill="#fff">{name}</text>
              </g>
            ))}
            <circle cx="300" cy="170" r="46" fill="#15803d" /><text x="300" y="175" textAnchor="middle" fontSize="13" fill="#fff">{g.crop}</text>
          </svg>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Demo graph, not from the knowledge base. Real nodes will show sources, page numbers and confidence.</p>
        </Card>
      ) : <EmptyRegion />}
    </main>
  )
}
