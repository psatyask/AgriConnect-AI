import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import HeroArt from './HeroArt'

export interface HeroPic { src: string; altKey: string; focus?: string }  // focus = where the subject is, e.g. '20% 50%', kept in view when the frame crops

const SLIDE_MS = 6500

/** Rotating hero pictures for the active country. Fades between slides, pauses on hover/focus, never auto-plays for people who ask for reduced motion.
 * Only the first picture loads eagerly. A picture that fails to load is skipped; if none load, the built-in illustration is shown. */
export default function HeroCarousel({ pics, scene, fallbackAltKey }: { pics: HeroPic[]; scene: string; fallbackAltKey: string }) {
  const { t } = useTranslation()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [bad, setBad] = useState<Set<string>>(new Set())
  const ok = pics.filter((p) => !bad.has(p.src))
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const n = ok.length
  const cur = n ? i % n : 0

  useEffect(() => {
    if (n < 2 || paused || reduce) return
    const id = window.setInterval(() => setI((x) => x + 1), SLIDE_MS)
    return () => window.clearInterval(id)
  }, [n, paused, reduce])

  if (n === 0) return <HeroArt scene={scene} label={t(fallbackAltKey)} src={null} />
  return (
    <div className="relative h-64 overflow-hidden rounded-2xl sm:h-80 md:h-[21rem]" data-testid="hero-carousel" role="group" aria-roledescription="carousel" aria-label={t('hero.carousel')}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {ok.map((p, k) => (
        <img key={p.src} src={p.src} alt={k === cur ? t(p.altKey) : ''} aria-hidden={k !== cur} loading={k === 0 ? 'eager' : 'lazy'} decoding="async"
          onError={() => setBad((b) => new Set(b).add(p.src))}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 motion-reduce:transition-none" style={{ opacity: k === cur ? 1 : 0, objectPosition: p.focus ?? '50% 50%' }} />
      ))}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
      {n > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1">
          {ok.map((p, k) => (
            <button key={p.src} type="button" aria-label={t('hero.showPicture', { n: k + 1, total: n })} aria-current={k === cur}
              onClick={() => setI(k)} className="flex h-6 w-6 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              <span className="block h-2 rounded-full bg-white transition-all" style={{ width: k === cur ? 22 : 8, opacity: k === cur ? 1 : 0.6 }} />
            </button>))}
        </div>)}
    </div>
  )
}
