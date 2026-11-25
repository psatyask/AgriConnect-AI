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
  heroImage: { src: '/images/hero/hero-in.jpg', altKey: 'hero.imageAlt.IN', scene: 'paddy' },
  demoOnly: true,
}
