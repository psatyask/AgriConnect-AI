import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function DemoBadge({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <span className="inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-900">
      {label ?? t('demo.data')}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${className}`} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      {children}
    </div>
  )
}

export function Section({ title, badge, children }: { title: string; badge?: boolean; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-display text-2xl font-extrabold">{title}</h2>
        {badge && <DemoBadge />}
      </div>
      {children}
    </section>
  )
}

export function EmptyRegion() {
  const { t } = useTranslation()
  return <p className="rounded-xl border border-dashed p-6 text-sm" style={{ color: 'var(--muted)' }}>{t('demo.notice')}</p>
}

export const btnPrimary =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime'
export const btnGhost =
  'inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-brand px-5 text-sm font-semibold text-brand hover:bg-brand/10'
