import type { RegionPack } from './types'

const LB = 0.45359237

export const US: RegionPack = {
  code: 'US',
  nameKey: 'regions.US',
  flag: '🇺🇸',
  currency: { code: 'USD', symbol: '$' },
  defaultLanguage: 'en',
  suggestedLanguages: ['en', 'es'],
  units: [
    { id: 'lb', labelKey: 'lb', toKg: LB },
    { id: 'short_ton', labelKey: 'short_ton', toKg: 2000 * LB },
    // Bushel has no single kg value: it depends on the commodity (see bushelWeightKg).
    { id: 'bushel', labelKey: 'bushel' },
  ],
  // Standard USDA test weights per bushel: corn 56 lb, soybeans 60 lb, wheat 60 lb.
  bushelWeightKg: {
    corn: 56 * LB,
    soybeans: 60 * LB,
    wheat: 60 * LB,
  },
  hierarchy: ['country', 'state', 'county', 'locality'],
  commodities: [
    { id: 'corn', nameKey: 'commodities.corn', categoryKey: 'categories.grains', priceUnit: 'bushel' },
    { id: 'soybeans', nameKey: 'commodities.soybeans', categoryKey: 'categories.oilseeds', priceUnit: 'bushel' },
    { id: 'wheat', nameKey: 'commodities.wheat', categoryKey: 'categories.grains', priceUnit: 'bushel' },
  ],
  heroImage: { src: null, altKey: 'hero.imageAlt.US' },
  demoOnly: true,
}
