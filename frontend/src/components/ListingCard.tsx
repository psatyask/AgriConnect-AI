import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { useSendInquiry, type Listing } from '../api/listings'
import { formatMoney, formatNumber } from '../utils/format'
import CropIcon, { cropBg } from './art/CropIcon'
import { Card, btnGhost, btnPrimary } from './ui'

/** A real listing from the API. Buyers can send an inquiry; contact details are never shown. */
export default function ListingCard({ l }: { l: Listing }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { region } = useRegion()
  const { language } = useLanguage()
  const send = useSendInquiry(region.code)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try { await send.mutateAsync({ id: l.id, message }); setDone(true); setOpen(false); setMessage('') } catch { /* error shown below */ }
  }
  return (
    <Card className="h-full overflow-hidden !p-0 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex h-20 items-center justify-center" style={{ background: cropBg(l.commodity) }}><CropIcon id={l.commodity} size={48} /></div>
      <div className="p-5">
        <b>{t(`commodities.${l.commodity}`, { defaultValue: l.commodity })}{l.variety && ` · ${l.variety}`}{l.grade && ` · ${l.grade}`}</b>
        <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{l.place} · {t('market.byFarmer', { name: l.farmer_name })}</div>
        <div className="mt-3 font-display text-xl font-extrabold text-brand">{formatMoney(l.price, region, language.code)} / {t(`units.${l.unit}`, { defaultValue: l.unit })}</div>
        <div className="text-sm" style={{ color: 'var(--muted)' }}>{formatNumber(l.quantity, language.code)} {t(`units.${l.unit}`, { defaultValue: l.unit })} {t('home.available')}</div>
        {l.description && <p className="mt-2 text-sm">{l.description}</p>}
        {user?.role === 'buyer' && !open && !done && <button className={`${btnPrimary} mt-3`} onClick={() => setOpen(true)}>{t('market.sendInquiry')}</button>}
        {done && <p role="status" className="mt-3 text-sm font-semibold text-brand">{t('market.inquirySent')}</p>}
        {!user && <Link to="/login" className={`${btnGhost} mt-3 inline-flex`}>{t('market.signInToInquire')}</Link>}
        {open && (
          <form onSubmit={submit} className="mt-3 space-y-2">
            <textarea required minLength={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} aria-label={t('market.sendInquiry')}
              placeholder={t('market.inquiryPlaceholder')} className="min-h-20 w-full rounded-xl border bg-transparent p-3 text-sm" style={{ borderColor: 'var(--border)' }} />
            {send.error && <p role="alert" className="text-sm text-red-600">{send.error.message}</p>}
            <button className={btnPrimary} disabled={send.isPending}>{t('market.sendInquiry')}</button>
          </form>
        )}
      </div>
    </Card>
  )
}
