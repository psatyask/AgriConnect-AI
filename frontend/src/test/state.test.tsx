import { describe, expect, it, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { AppProviders } from '../context/AppProviders'
import { useRegion } from '../context/RegionContext'
import { useLanguage } from '../context/LanguageContext'
import { registerRegion, unregisterRegion, listRegions } from '../regions/registry'
import { US } from '../regions/us'
import { IN } from '../regions/in'
import type { RegionPack } from '../regions/types'
import { searchLanguages } from '../config/languages'
import { convertQuantity, formatMoney } from '../utils/format'

function Probe() {
  const { region, regions, setCountry } = useRegion()
  const { language, setLanguage, usingFallback } = useLanguage()
  const { t } = useTranslation()
  return (
    <div>
      <p data-testid="country">{region.code}</p>
      <p data-testid="currency">{region.currency.code}</p>
      <p data-testid="lang">{language.code}</p>
      <p data-testid="dir">{document.documentElement.dir}</p>
      <p data-testid="fallback">{String(usingFallback)}</p>
      <p data-testid="countries">{regions.map((r) => r.code).join(',')}</p>
      <p data-testid="title">{t('hero.title')}</p>
      <p data-testid="corn">{t('commodities.corn')}</p>
      <button onClick={() => setCountry('US')}>us</button>
      <button onClick={() => setCountry('ZZ')}>zz</button>
      <button onClick={() => setLanguage('te')}>te</button>
      <button onClick={() => setLanguage('ar')}>ar</button>
    </div>
  )
}

const click = (name: string) => act(() => screen.getByText(name).click())

describe('region and language state', () => {
  it('US + Telugu: American context with Telugu text, USD, and no currency change from language', async () => {
    render(<AppProviders><Probe /></AppProviders>)
    expect(screen.getByTestId('country').textContent).toBe('IN')
    click('us')
    click('te')
    expect(screen.getByTestId('country').textContent).toBe('US')
    expect(screen.getByTestId('currency').textContent).toBe('USD')
    expect(screen.getByTestId('title').textContent).toBe('కలిసి పండిద్దాం. తెలివిగా వ్యాపారం చేద్దాం.')
    expect(screen.getByTestId('corn').textContent).toBe('మొక్కజొన్న')
  })

  it('language change does not change the country', () => {
    render(<AppProviders><Probe /></AppProviders>)
    click('te')
    expect(screen.getByTestId('country').textContent).toBe('IN')
    expect(screen.getByTestId('currency').textContent).toBe('INR')
  })

  it('ignores unknown countries and persists the choice', () => {
    render(<AppProviders><Probe /></AppProviders>)
    click('zz')
    expect(screen.getByTestId('country').textContent).toBe('IN')
    click('us')
    expect(window.localStorage.getItem('agri.country')).toBe('US')
  })

  it('RTL language sets dir and flags the English fallback for untranslated UI', () => {
    render(<AppProviders><Probe /></AppProviders>)
    click('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(screen.getByTestId('fallback').textContent).toBe('true')
    expect(screen.getByTestId('title').textContent).toBe('Growing Together. Trading Smarter.')
  })
})

describe('modular regions', () => {
  const DUMMY: RegionPack = { ...IN, code: 'ZZ', nameKey: 'regions.IN', currency: { code: 'EUR', symbol: '€' } }
  afterEach(() => unregisterRegion('ZZ'))

  it('a third country registered at runtime appears and works with no shared-code change', () => {
    registerRegion(DUMMY)
    render(<AppProviders><Probe /></AppProviders>)
    expect(screen.getByTestId('countries').textContent).toBe('IN,US,ZZ')
    click('zz')
    expect(screen.getByTestId('country').textContent).toBe('ZZ')
    expect(screen.getByTestId('currency').textContent).toBe('EUR')
    expect(formatMoney(10, DUMMY, 'en')).toContain('€')
    expect(listRegions().length).toBe(3)
  })
})

describe('language search', () => {
  it('matches English names, native script and codes', () => {
    expect(searchLanguages('tel').map((l) => l.code)).toContain('te')
    expect(searchLanguages('తెలుగు').map((l) => l.code)).toEqual(['te'])
    expect(searchLanguages('हिन्दी').map((l) => l.code)).toEqual(['hi'])
    expect(searchLanguages('xx')).toEqual([])
  })
})

describe('units', () => {
  it('uses commodity-specific bushel weights and never a universal factor', () => {
    const corn = convertQuantity(1, 'bushel', 'lb', US, 'corn')
    const soy = convertQuantity(1, 'bushel', 'lb', US, 'soybeans')
    expect(corn).toBeCloseTo(56, 5)
    expect(soy).toBeCloseTo(60, 5)
    expect(() => convertQuantity(1, 'bushel', 'lb', US)).toThrow()
    expect(() => convertQuantity(1, 'bushel', 'lb', US, 'tomato')).toThrow()
  })

  it('converts India units', () => {
    expect(convertQuantity(2, 'quintal', 'kg', IN)).toBe(200)
    expect(convertQuantity(1, 'tonne', 'quintal', IN)).toBe(10)
  })
})
