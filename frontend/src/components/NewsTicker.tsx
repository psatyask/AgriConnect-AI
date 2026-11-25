import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pause, Play } from 'lucide-react'
import { useRegion } from '../context/RegionContext'
import { getDemo } from '../data/demo'

/**
 * Demo ticker. Phase 4 swaps the demo source for real ingested articles.
 * Pauses on hover/focus and via the button; reduced-motion users get a static, scrollable row.
 */
export default function NewsTicker() {
  const { t } = useTranslation()
  const { region } = useRegion()
  const [paused, setPaused] = useState(false)
  const demo = getDemo(region.code)

  return (
    <div className="sticky top-[57px] z-30 border-b bg-forest text-sm text-white" aria-label={t('demo.news')}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <span className="shrink-0 rounded-md bg-lime px-2 py-0.5 text-[11px] font-bold uppercase text-forest">
          {t('demo.news')} · {region.code}
        </span>
        <div className="ticker-viewport min-w-0 flex-1 overflow-hidden motion-reduce:overflow-x-auto" tabIndex={-1}>
          {demo ? (
            <ul className="ticker-track flex w-max gap-10" data-paused={paused} style={{ animationPlayState: paused ? 'paused' : undefined }}>
              {[...demo.news, ...demo.news].map((n, i) => (
                <li key={i} className="whitespace-nowrap" aria-hidden={i >= demo.news.length}>
                  <a href="#" onClick={(e) => e.preventDefault()} tabIndex={i >= demo.news.length ? -1 : 0}
                    className="underline-offset-2 hover:underline focus-visible:underline">
                    {n.title} — {n.source} · {n.time}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <span>{t('demo.notice')}</span>
          )}
        </div>
        <button className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-white/30"
          onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? 'Resume news ticker' : 'Pause news ticker'}>
          {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
        </button>
      </div>
    </div>
  )
}
