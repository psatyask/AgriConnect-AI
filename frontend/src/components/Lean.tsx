import { useTranslation } from 'react-i18next'

/** Up is blue-teal, down is orange (colour-blind safe), and every bar also carries arrows and numbers, so colour is never the only cue. */

export function LeanBar({ up, down, even }: { up: number; down: number; even: number }) {
  const { t } = useTranslation()
  const n = up + down + even
  if (!n) return null
  const w = (v: number) => `${(v / n) * 100}%`
  return (
    <div>
      <div role="img" aria-label={t('lean.barLabel', { up, down, even })} className="flex h-3 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
        <span style={{ width: w(up), background: 'var(--up)' }} />
        <span style={{ width: w(even), background: 'color-mix(in srgb, var(--muted) 45%, transparent)' }} />
        <span style={{ width: w(down), background: 'var(--down)' }} />
      </div>
      <div className="mt-1 flex justify-between text-xs font-semibold tabular-nums">
        <span style={{ color: 'var(--up)' }}>▲ {up}</span>
        {even > 0 && <span style={{ color: 'var(--muted)' }}>– {even}</span>}
        <span style={{ color: 'var(--down)' }}>▼ {down}</span>
      </div>
    </div>
  )
}

/** Tested accuracy on a 50% (guessing) to 100% scale. */
export function AccuracyMeter({ auc }: { auc: number }) {
  const { t } = useTranslation()
  const pct = Math.max(0, Math.min(1, (auc - 0.5) / 0.5)) * 100
  return (
    <div role="img" aria-label={t('lean.accuracyLabel', { pct: Math.round(auc * 100) })}>
      <div className="relative h-2 rounded-full" style={{ background: 'var(--border)' }}>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: 'var(--link)' }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}><span>50%</span><span className="font-semibold tabular-nums" style={{ color: 'var(--fg)' }}>{Math.round(auc * 100)}%</span><span>100%</span></div>
    </div>
  )
}

/** Where the chance of "up" sits between down (0) and up (100). The middle band means no real lean. */
export function ProbGauge({ pUp }: { pUp: number }) {
  const { t } = useTranslation()
  const pos = Math.max(0, Math.min(1, pUp)) * 100
  const lean = pUp >= 0.6 ? 'var(--up)' : pUp <= 0.4 ? 'var(--down)' : 'var(--muted)'
  return (
    <div role="img" aria-label={t('lean.gaugeLabel', { pct: Math.round(pUp * 100) })} className="mt-2">
      <div className="relative h-3 rounded-full" style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--down) 55%, transparent) 0 40%, var(--border) 40% 60%, color-mix(in srgb, var(--up) 55%, transparent) 60% 100%)' }}>
        <span className="absolute left-1/2 top-[-3px] h-[18px] w-px" style={{ background: 'var(--muted)' }} />
        <span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow" style={{ left: `${pos}%`, background: lean, borderColor: 'var(--card)' }} />
      </div>
      <div className="mt-1 flex justify-between text-xs font-semibold"><span style={{ color: 'var(--down)' }}>▼ {t('lean.down')}</span><span style={{ color: 'var(--muted)' }}>{t('lean.noLean')}</span><span style={{ color: 'var(--up)' }}>▲ {t('lean.up')}</span></div>
    </div>
  )
}
