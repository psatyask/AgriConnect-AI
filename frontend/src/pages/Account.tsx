import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, type SelfRole } from '../context/AuthContext'
import GoogleButton from '../components/GoogleButton'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { useBuyerInquiries, useCreateListing, useFarmerInquiries, useMyListings, useSetListingStatus, type Inquiry, type ListingStatus } from '../api/listings'
import { formatMoney, formatNumber } from '../utils/format'
import { Inbox, ShoppingBag, Sprout } from 'lucide-react'
import CropOptions from '../components/CropOptions'
import { Card, btnGhost, btnPrimary } from '../components/ui'

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

function StatusPill({ status }: { status: ListingStatus }) {
  const { t } = useTranslation()
  const tone = status === 'active' ? 'bg-green-100 text-green-900' : 'bg-gray-200 text-gray-800'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{t(`market.status_${status}`)}</span>
}

function NewListingForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const { region } = useRegion()
  const create = useCreateListing(region.code)
  const first = region.commodities[0]
  const [f, setF] = useState({ commodity: first.id, variety: '', grade: '', place: '', description: '', unit: first.priceUnit, quantity: '', price: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }))
  const input = 'min-h-11 w-full rounded-xl border px-3 text-sm'
  const style = { borderColor: 'var(--border)', background: 'var(--card)' }
  async function submit(e: FormEvent) {
    e.preventDefault()
    try { await create.mutateAsync({ ...f, region_code: region.code, currency: region.currency.code }); onDone() } catch { /* shown below */ }
  }
  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">{t('home.cropLabel')}
          <select className={input} style={style} value={f.commodity} onChange={(e) => { const c = region.commodities.find((x) => x.id === e.target.value); setF((p) => ({ ...p, commodity: e.target.value, unit: c?.priceUnit ?? p.unit })) }}>
            <CropOptions crops={region.commodities} /></select></label>
        <label className="text-sm">{t('market.unit')}
          <select className={input} style={style} value={f.unit} onChange={set('unit')}>
            {region.units.map((u) => <option key={u.id} value={u.id}>{t(`units.${u.id}`)}</option>)}</select></label>
        <label className="text-sm">{t('market.variety')}<input className={input} style={style} value={f.variety} onChange={set('variety')} maxLength={100} /></label>
        <label className="text-sm">{t('market.grade')}<input className={input} style={style} value={f.grade} onChange={set('grade')} maxLength={40} /></label>
        <label className="text-sm">{t('market.quantity')}<input className={input} style={style} type="number" min="0.001" step="any" required value={f.quantity} onChange={set('quantity')} /></label>
        <label className="text-sm">{t('market.price')} ({region.currency.symbol})<input className={input} style={style} type="number" min="0.01" step="0.01" required value={f.price} onChange={set('price')} /></label>
        <label className="text-sm sm:col-span-2">{t('market.place')}<input className={input} style={style} value={f.place} onChange={set('place')} maxLength={200} /></label>
        <label className="text-sm sm:col-span-2">{t('market.description')}<textarea className={`${input} min-h-20 py-2`} style={style} value={f.description} onChange={set('description')} maxLength={2000} /></label>
        {create.error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{create.error.message}</p>}
        <div className="sm:col-span-2"><button className={btnPrimary} disabled={create.isPending}>{t('market.publish')}</button></div>
      </form>
    </Card>
  )
}

function InquiryList({ items, empty }: { items: Inquiry[]; empty: string }) {
  const { t } = useTranslation()
  if (items.length === 0) return <p className="text-sm" style={{ color: 'var(--muted)' }}>{empty}</p>
  return (
    <ul className="space-y-3">{items.map((i) => (
      <li key={i.id} className="border-t pt-3 text-sm" style={{ borderColor: 'var(--border)' }}>
        <b>{t(`commodities.${i.commodity}`, { defaultValue: i.commodity })}</b> · {i.buyer_name} · <span style={{ color: 'var(--muted)' }}>{new Date(i.created_at).toLocaleDateString()}</span>
        <p className="mt-1">{i.message}</p></li>))}</ul>
  )
}

export function FarmerDashboard() {
  const { t } = useTranslation()
  const { region } = useRegion()
  const { language } = useLanguage()
  const { user } = useAuth()
  const mine = useMyListings(region.code, !!user)
  const inq = useFarmerInquiries(region.code, !!user)
  const setStatus = useSetListingStatus(region.code)
  const [adding, setAdding] = useState(false)
  const items = mine.data?.items ?? []
  const stats: [typeof Sprout, string, number][] = [
    [Sprout, t('pages.activeListings'), items.filter((l) => l.status === 'active').length],
    [ShoppingBag, t('market.soldLabel'), items.filter((l) => l.status === 'sold').length],
    [Inbox, t('market.inquiriesLabel'), inq.data?.items.length ?? 0],
  ]
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold">{t('pages.farmerDashboard')}</h1>
        <button className={`${btnPrimary} ml-auto`} onClick={() => setAdding(!adding)}>+ {t('pages.newListing')}</button>
      </div>
      {adding && <NewListingForm onDone={() => setAdding(false)} />}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(([Icon, k, v]) => <Card key={k}><Icon className="mb-2 text-brand" size={20} aria-hidden /><div className="text-sm" style={{ color: 'var(--muted)' }}>{k}</div><div className="font-display text-2xl font-extrabold text-brand">{formatNumber(v, language.code)}</div></Card>)}
      </div>
      {mine.isError && <p role="alert" className="text-sm text-red-600">{t('market.loadFail')}</p>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2"><b>{t('market.myListings')}</b>
          {mine.isSuccess && items.length === 0 && <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{t('market.nothingYet')}</p>}
          <ul className="mt-2">{items.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-3 text-sm" style={{ borderColor: 'var(--border)' }}>
              <span className="font-semibold">{t(`commodities.${l.commodity}`, { defaultValue: l.commodity })}</span>{l.variety && <span>{l.variety}</span>}
              <span>{formatNumber(l.quantity, language.code)} {t(`units.${l.unit}`, { defaultValue: l.unit })}</span>
              <span>{formatMoney(l.price, region, language.code)}</span><StatusPill status={l.status} />
              <span style={{ color: 'var(--muted)' }}>{formatNumber(l.inquiry_count, language.code)} {t('market.inquiriesLabel')}</span>
              {l.status === 'active' && (
                <span className="ml-auto flex gap-2">
                  <button className={`${btnGhost} !min-h-9 !px-3`} onClick={() => setStatus.mutate({ id: l.id, status: 'sold' })}>{t('market.markSold')}</button>
                  <button className={`${btnGhost} !min-h-9 !px-3`} onClick={() => setStatus.mutate({ id: l.id, status: 'closed' })}>{t('market.closeListing')}</button>
                </span>)}
            </li>))}</ul></Card>
        <Card><b>{t('market.inquiriesReceived')}</b><div className="mt-2"><InquiryList items={inq.data?.items ?? []} empty={t('market.noInquiries')} /></div></Card>
      </div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('pages.limits')}</p>
    </main>
  )
}

export function BuyerDashboard() {
  const { t } = useTranslation()
  const { region } = useRegion()
  const { user } = useAuth()
  const sent = useBuyerInquiries(region.code, !!user)
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold">{t('pages.buyer')}</h1>
      <Link to="/marketplace" className={`${btnPrimary} inline-flex`}>{t('nav.marketplace')}</Link>
      {sent.isError && <p role="alert" className="text-sm text-red-600">{t('market.loadFail')}</p>}
      <Card><b>{t('market.inquiriesSent')}</b><div className="mt-2"><InquiryList items={sent.data?.items ?? []} empty={t('market.noInquiries')} /></div></Card>
    </main>
  )
}
