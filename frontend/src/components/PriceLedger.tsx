import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PriceRow } from '../api/prices'

/** A price line; `srcUnit` is the package it was reported in when its price has been converted to a common unit. */
export type LedgerRow = PriceRow & { srcUnit?: string }
export interface Group { unit: string; rows: LedgerRow[]; lo: number; hi: number; latest: string }
const srcOf = (r: LedgerRow) => r.srcUnit ?? r.unit
export interface Line { variety: string; unit: string }

const VISIBLE = 8
const valuesOf = (r: LedgerRow) => [r.min, r.max, r.modal].filter((v): v is number => v != null)

/** Price lines grouped by the package they are quoted per: prices in different packages are never put on one scale. */
export function groupRows(rows: LedgerRow[]): Group[] {
  const by = new Map<string, LedgerRow[]>()
  for (const r of rows) by.set(r.unit, [...(by.get(r.unit) ?? []), r])
  return [...by.entries()].map(([unit, list]) => {
    const vals = list.flatMap(valuesOf)
    const sorted = [...list].sort((a, b) => a.variety.localeCompare(b.variety) || a.grade.localeCompare(b.grade) || a.market.localeCompare(b.market))
    return { unit, rows: sorted, lo: Math.min(...vals), hi: Math.max(...vals), latest: list.reduce((m, r) => (r.date > m ? r.date : m), '') }
  }).sort((a, b) => b.rows.length - a.rows.length || a.unit.localeCompare(b.unit))
}

function RangeBar({ row, lo, hi }: { row: LedgerRow; lo: number; hi: number }) {
  if (hi === lo) return null  // one price, or all the same: a bar on a one-point scale says nothing
  const span = hi - lo
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / span) * 100))
  const a = row.min ?? row.max ?? row.modal, b = row.max ?? row.min ?? row.modal
  if (a == null || b == null) return null
  const left = pct(a), width = Math.max(pct(b) - left, 2.5)
  return (
    <span aria-hidden className="relative block h-2.5 w-full rounded-full" style={{ background: 'var(--border)' }}>
      <span className="absolute top-0 h-full rounded-full bg-brand" style={{ left: `${Math.min(left, 100 - width)}%`, width: `${width}%` }} />
      {row.modal != null && row.min != null && row.max != null && (
        <span className="absolute -top-0.5 h-3.5 w-0.5 rounded-sm" style={{ left: `${pct(row.modal)}%`, background: 'var(--fg)' }} />)}
    </span>)
}

interface Props {
  groups: Group[]
  selected: Line | null
  onSelect: (line: Line) => void
  money: (n: number) => string
  unitLabel: (u: string) => string
  showMarket: boolean
  /** The common unit prices were converted to, if any: groups in other units get a note that they could not be. */
  convertedTo?: string
}

export default function PriceLedger({ groups, selected, onSelect, money, unitLabel, showMarket, convertedTo }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const uid = useId()
  const priceText = (r: LedgerRow) => {
    if (r.min != null && r.max != null) return r.min === r.max ? money(r.min) : `${money(r.min)} – ${money(r.max)}`
    const one = r.min ?? r.max ?? r.modal
    return one != null ? money(one) : '—'
  }
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g, gi) => {
        const expanded = open.has(g.unit)
        const list = expanded ? g.rows : g.rows.slice(0, VISIBLE)
        return (
          <section key={g.unit} aria-labelledby={`${uid}-g${gi}`}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
              <h3 id={`${uid}-g${gi}`} className="font-display text-base font-extrabold">{g.unit === convertedTo ? t('prices.perBase', { unit: unitLabel(g.unit) }) : unitLabel(g.unit)}</h3>
              <p className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{g.lo === g.hi ? t('prices.groupSame', { count: g.rows.length, lo: money(g.lo) }) : t('prices.groupSummary', { count: g.rows.length, lo: money(g.lo), hi: money(g.hi) })}</p>
            </div>
            {convertedTo && g.unit !== convertedTo && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{t('prices.noWeight', { unit: unitLabel(convertedTo) })}</p>}
            <ul className="flex flex-col">
              {list.map((r) => {
                const on = selected?.variety === r.variety && selected.unit === srcOf(r)
                return (
                  <li key={`${r.market}-${r.variety}-${r.grade}-${srcOf(r)}`}>
                    <button type="button" aria-pressed={on} onClick={() => onSelect({ variety: r.variety, unit: srcOf(r) })}
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-lg border-l-4 px-3 py-2.5 text-left hover:bg-brand/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand sm:grid-cols-[minmax(0,1fr)_6rem_8.5rem]"
                      style={{ borderColor: on ? 'var(--color-brand)' : 'transparent', background: on ? 'color-mix(in srgb, var(--color-brand) 9%, transparent)' : undefined }}>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{r.variety || (r.market === 'State average' ? r.state : r.market)}</span>
                        {r.grade && <span className="block text-xs" style={{ color: 'var(--muted)' }}>{r.grade}</span>}
                        {showMarket && r.variety && <span className="block text-xs font-semibold" style={{ color: 'var(--muted)' }}>{r.market}, {r.state}</span>}
                        {r.date < g.latest && <span className="block text-xs font-semibold" style={{ color: 'var(--warn)' }}>{t('prices.lastReported', { date: r.period === 'monthly' ? r.date.slice(0, 7) : r.date })}</span>}
                      </span>
                      <span className="text-right text-sm font-semibold tabular-nums sm:order-3">
                        {priceText(r)}
                        {r.modal != null && r.min != null && r.max != null && <span className="block text-xs font-normal" style={{ color: 'var(--muted)' }}>{t('prices.modal')} {money(r.modal)}</span>}
                      </span>
                      <span className="col-span-2 sm:col-span-1 sm:order-2"><RangeBar row={r} lo={g.lo} hi={g.hi} /></span>
                    </button>
                  </li>)
              })}
            </ul>
            {g.rows.length > VISIBLE && (
              <button type="button" className="mt-1 min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-brand/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" style={{ color: 'var(--link)' }}
                aria-expanded={expanded} onClick={() => setOpen((p) => { const n = new Set(p); if (expanded) n.delete(g.unit); else n.add(g.unit); return n })}>
                {expanded ? t('prices.showFewer') : t('prices.showMoreLines', { count: g.rows.length - VISIBLE })}
              </button>)}
          </section>)
      })}
    </div>)
}
