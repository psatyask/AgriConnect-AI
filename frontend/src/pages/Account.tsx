import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, type SelfRole } from '../context/AuthContext'
import GoogleButton from '../components/GoogleButton'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { getDemo } from '../data/demo'
import { formatMoney, formatNumber } from '../utils/format'
import { Inbox, Package, ShoppingBag, Sprout } from 'lucide-react'
import PriceChart from '../components/PriceChart'
import { Card, DemoBadge, EmptyRegion, btnGhost, btnPrimary } from '../components/ui'

export function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, googleClientId, signInWithGoogle, login, register } = useAuth()
  const [role, setRole] = useState<SelfRole>('farmer')
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (user) navigate(`/dashboard/${user.role === 'buyer' ? 'buyer' : 'farmer'}`, { replace: true }) }, [user, navigate])

  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : t('auth.backendDown')), [t])
  const onGoogle = useCallback((credential: string) => { setError(''); signInWithGoogle(credential, role).catch(fail) }, [signInWithGoogle, role, fail])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(''); setBusy(true)
    try { await (mode === 'signin' ? login(email, password) : register(email, password, name, role)) }
    catch (err) { fail(err) }
    finally { setBusy(false) }
  }

  const input = 'min-h-11 w-full rounded-xl border bg-transparent px-3 text-sm'
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Card className="space-y-4">
        <h1 className="font-display text-2xl font-extrabold">{t('auth.title')}</h1>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t('auth.iAm')}</legend>
          <div className="grid grid-cols-2 gap-3" role="radiogroup">
            {(['farmer', 'buyer'] as const).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)}
                className={role === r ? btnPrimary : btnGhost}>{t(`pages.${r}`)}</button>
            ))}
          </div>
        </fieldset>
        {googleClientId
          ? <GoogleButton clientId={googleClientId} onCredential={onGoogle} onError={setError} />
          : <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('auth.google')}</p>}
        <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>{t('auth.or')}</p>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <label className="block text-sm">{t('auth.name')}
              <input className={input} style={{ borderColor: 'var(--border)' }} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>)}
          <label className="block text-sm">{t('auth.email')}
            <input className={input} style={{ borderColor: 'var(--border)' }} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label className="block text-sm">{t('auth.password')}
            <input className={input} style={{ borderColor: 'var(--border)' }} type="password" required minLength={mode === 'register' ? 10 : 1} value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
            {mode === 'register' && <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('auth.passwordHint')}</span>}</label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button className={`${btnPrimary} w-full`} disabled={busy}>{mode === 'signin' ? t('auth.signIn') : t('auth.createAccount')}</button>
        </form>
        <button type="button" className="w-full text-sm underline" onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setError('') }}>
          {mode === 'signin' ? t('auth.noAccount') : t('auth.haveAccount')}</button>
      </Card>
    </main>
  )
}

/** Shows the page only to signed-in users with the right role. The server enforces the same rule on every API call. */
function RequireRole({ role, children }: { role: 'farmer' | 'buyer'; children: ReactNode }) {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  if (loading) return <main className="mx-auto max-w-md px-4 py-12"><p role="status">{t('auth.checking')}</p></main>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role && user.role !== 'admin') {
    return <main className="mx-auto max-w-md px-4 py-12"><p role="alert">{t('auth.wrongRole', { role: t(`pages.${role}`) })}</p></main>
  }
  return <>{children}</>
}

export function FarmerArea() { return <RequireRole role="farmer"><FarmerDashboard /></RequireRole> }
export function BuyerArea() { return <RequireRole role="buyer"><BuyerDashboard /></RequireRole> }

export function FarmerDashboard() {
  const { t } = useTranslation()
  const { region } = useRegion()
  const { language } = useLanguage()
  const demo = getDemo(region.code)
  if (!demo) return <main className="mx-auto max-w-6xl px-4 py-8"><EmptyRegion /></main>
  const d = demo.dashboard
  const stats: [typeof Sprout, string, string][] = [
    [Sprout, t('pages.activeListings'), formatNumber(d.active, language.code)],
    [Package, t('pages.inventory'), `${formatNumber(d.inventory, language.code)} ${t(`units.${d.unit}`)}`],
    [ShoppingBag, 'Sold', `${formatNumber(d.sold, language.code)} ${t(`units.${d.unit}`)}`],
    [Inbox, t('pages.inquiries'), formatNumber(d.inquiries, language.code)],
  ]
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold">{t('pages.farmerDashboard')}</h1><DemoBadge />
        <button className={`${btnPrimary} ml-auto`}>+ {t('pages.newListing')}</button>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([Icon, k, v]) => <Card key={k}><Icon className="mb-2 text-brand" size={20} aria-hidden /><div className="text-sm" style={{ color: 'var(--muted)' }}>{k}</div><div className="font-display text-2xl font-extrabold text-brand">{v}</div></Card>)}
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
