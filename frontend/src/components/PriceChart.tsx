import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
/** `band` is the likely range around a forecast point. */
export type Series = { label: string; price: number | null; forecast: number | null; band?: [number, number] | null }[]

/** Solid line = reported, dashed = forecast. Both are DEMO values in Phase 1. */
export default function PriceChart({ data, height = 240, demo = true }: { data: Series; height?: number; demo?: boolean }) {
  const { t } = useTranslation()
  return (
    <div role="img" aria-label={demo ? `${t('home.priceTrend')} (${t('demo.data')})` : t('home.priceTrend')} style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} domain={['auto', 'auto']} width={48} />
          <Tooltip formatter={(v) => (Array.isArray(v) ? `${v[0]} – ${v[1]}` : v)} />
          <Area type="monotone" dataKey="band" name={t('prices.forecast.rangeName')} stroke="none" fill="#65a30d" fillOpacity={0.18} connectNulls={false} isAnimationActive={false} legendType="none" />
          <Line type="monotone" dataKey="price" name={t('home.reported')} stroke="#15803d" strokeWidth={3} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="forecast" name={t('home.forecast')} stroke="#65a30d" strokeWidth={3} strokeDasharray="6 5" dot={(d: { cx?: number; cy?: number; payload?: { band?: unknown }; index?: number }) => (d.payload?.band ? <circle key={d.index} cx={d.cx} cy={d.cy} r={5} fill="#65a30d" stroke="var(--card)" strokeWidth={2} /> : <g key={d.index} />)} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
