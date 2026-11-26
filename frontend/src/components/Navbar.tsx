import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Menu, Moon, Search, Sun, X } from 'lucide-react'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { searchLanguages } from '../config/languages'

/** Closes a popover on outside click or Escape. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return { open, setOpen, ref }
}

const pill = 'flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-sm font-medium'
const menuBox = 'absolute right-0 top-12 z-50 w-64 rounded-xl border p-1 shadow-lg'

export function RegionSelector() {
  const { t } = useTranslation()
  const { region, regions, setCountry } = useRegion()
  const { open, setOpen, ref } = usePopover()
  return (
    <div className="relative" ref={ref}>
      <button className={pill} style={{ borderColor: 'var(--border)' }} aria-haspopup="listbox" aria-expanded={open}
        aria-label={t('selectors.country')} onClick={() => setOpen(!open)}>
        <span aria-hidden>{region.flag}</span>{region.code} · {region.currency.symbol}<ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <ul role="listbox" className={menuBox} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {regions.map((r) => (
            <li key={r.code} role="presentation">
              <button role="option" aria-selected={r.code === region.code} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-brand/10"
                onClick={() => { setCountry(r.code); setOpen(false) }}>
                <span aria-hidden>{r.flag}</span><span className="flex-1">{t(r.nameKey)}</span>
                <span style={{ color: 'var(--muted)' }}>{r.currency.symbol}</span>
                {r.code === region.code && <Check size={16} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function LanguageSelector() {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  const { open, setOpen, ref } = usePopover()
  const [query, setQuery] = useState('')
  const results = searchLanguages(query)
  return (
    <div className="relative" ref={ref}>
      <button className={pill} style={{ borderColor: 'var(--border)' }} aria-haspopup="listbox" aria-expanded={open}
        aria-label={t('selectors.language')} onClick={() => setOpen(!open)}>
        {language.native}<ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className={menuBox} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <label className="flex min-h-11 items-center gap-2 border-b px-3" style={{ borderColor: 'var(--border)' }}>
            <Search size={16} aria-hidden />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={t('selectors.searchLanguage')} aria-label={t('selectors.searchLanguage')}
              className="w-full bg-transparent text-sm outline-none" />
          </label>
          <ul role="listbox" className="max-h-72 overflow-auto">
            {results.length === 0 && <li className="p-3 text-sm">{t('selectors.noLanguage')}</li>}
            {results.map((l) => (
              <li key={l.code} role="presentation">
                <button role="option" aria-selected={l.code === language.code} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-brand/10"
                  onClick={() => { setLanguage(l.code); setOpen(false); setQuery('') }}>
                  <span className="flex-1">{l.english} — {l.native}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{l.code}</span>
                  {l.code === language.code && <Check size={16} aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  return (
    <button className={pill} style={{ borderColor: 'var(--border)' }} onClick={toggleTheme}
      aria-label={`${t('selectors.theme')}: ${theme === 'dark' ? t('selectors.dark') : t('selectors.light')}`}>
      {theme === 'dark' ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
    </button>
  )
}

const LINKS: [string, string][] = [
  ['/', 'nav.home'], ['/marketplace', 'nav.marketplace'], ['/intelligence', 'nav.intelligence'],
  ['/forecasting', 'nav.forecasting'], ['/assistant', 'nav.assistant'], ['/knowledge', 'nav.knowledge'],
]

export default function Navbar() {
  const { t } = useTranslation()
  const { usingFallback } = useLanguage()
  const { user, logout } = useAuth()
  const [drawer, setDrawer] = useState(false)
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])

  const link = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium ${isActive ? '!border-brand text-brand' : ''}`
  return (
    <header className="sticky top-0 z-40 border-b" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <Link to="/" className="whitespace-nowrap font-display text-lg font-extrabold" style={{ color: 'var(--fg)' }}>
          AgriConnect <span className="text-brand">AI</span>
        </Link>
        <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          <RegionSelector /><LanguageSelector /><ThemeToggle />
          {user ? (
            <>
              <Link to={`/dashboard/${user.role === 'buyer' ? 'buyer' : 'farmer'}`} className="hidden min-h-11 items-center px-2 text-sm font-semibold sm:flex">{user.name || user.email}</Link>
              <button className="hidden min-h-11 items-center rounded-xl border px-3 text-sm font-semibold sm:flex" style={{ borderColor: 'var(--border)' }} onClick={() => { void logout() }}>{t('auth.signOut')}</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden min-h-11 items-center px-2 text-sm font-semibold sm:flex">{t('nav.login')}</Link>
              <Link to="/login" className="hidden min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white sm:flex">{t('nav.register')}</Link>
            </>
          )}
          <button className={`${pill} lg:hidden`} style={{ borderColor: 'var(--border)' }} aria-label={t('nav.menu')}
            aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={18} aria-hidden /></button>
        </div>
      </div>
      <div className="hidden border-t lg:block" style={{ borderColor: 'var(--border)' }}>
        <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center gap-2 px-4">
          {LINKS.map(([to, key]) => <NavLink key={to} to={to} end={to === '/'} className={link}>{t(key)}</NavLink>)}
        </nav>
      </div>
      {usingFallback && <p role="status" className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">{t('selectors.fallbackNotice')}</p>}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('nav.menu')}>
          <button className="absolute inset-0 bg-black/40" aria-label={t('nav.close')} onClick={() => setDrawer(false)} />
          <div className="absolute right-0 top-0 h-full w-72 p-4" style={{ background: 'var(--card)' }}>
            <button className={`${pill} mb-3 ml-auto`} style={{ borderColor: 'var(--border)' }} aria-label={t('nav.close')}
              onClick={() => setDrawer(false)}><X size={18} aria-hidden /></button>
            <nav className="flex flex-col">
              {[...LINKS, ['/login', 'nav.login'], ['/login', 'nav.register']].map(([to, key]) => (
                <NavLink key={key} to={to} end={to === '/'} onClick={() => setDrawer(false)}
                  className="flex min-h-12 items-center rounded-lg px-3 text-base font-medium hover:bg-brand/10">{t(key)}</NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
