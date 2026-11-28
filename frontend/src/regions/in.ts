import type { RegionPack } from './types'

export const IN: RegionPack = {
  code: 'IN',
  nameKey: 'regions.IN',
  flag: '🇮🇳',
  currency: { code: 'INR', symbol: '₹' },
  defaultLanguage: 'en',
  suggestedLanguages: ['hi', 'te', 'en'],
  units: [
    { id: 'kg', labelKey: 'kg', toKg: 1 },
    { id: 'quintal', labelKey: 'quintal', toKg: 100 },
    { id: 'tonne', labelKey: 'tonne', toKg: 1000 },
  ],
  hierarchy: ['country', 'state', 'district', 'locality'],
  commodities: [
    { id: 'tomato', nameKey: 'commodities.tomato', categoryKey: 'categories.vegetables', priceUnit: 'quintal' },
    { id: 'onion', nameKey: 'commodities.onion', categoryKey: 'categories.vegetables', priceUnit: 'quintal' },
    { id: 'rice', nameKey: 'commodities.rice', categoryKey: 'categories.cereals', priceUnit: 'quintal' },
    { id: 'chilli', nameKey: 'commodities.chilli', categoryKey: 'categories.spices', priceUnit: 'quintal' },
    { id: 'maize', nameKey: 'commodities.maize', categoryKey: 'categories.cereals', priceUnit: 'quintal' },
  ],
  heroImages: [
    { src: '/images/hero/hero-india.webp', altKey: 'hero.alts.inGroup', focus: '40% 50%' },
    { src: '/images/hero/hero-india-2.webp', altKey: 'hero.alts.inPhone', focus: '18% 50%' },
    { src: '/images/hero/hero-in.webp', altKey: 'hero.alts.inField', focus: '18% 50%' },
    { src: '/images/hero/hero-section.webp', altKey: 'hero.alts.sapling', focus: '45% 50%' },
  ],
  heroScene: 'paddy',
  demoOnly: true,
}
