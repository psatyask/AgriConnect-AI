import type { RegionPack } from '../regions/types'

/** Formats money with the region's currency and the UI language's number style. */
export function formatMoney(amount: number, region: RegionPack, language: string): string {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: region.currency.code,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language).format(value)
}

export function formatDate(date: Date | string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(date))
}

/** Kilograms in one unit for a given commodity, or null if it cannot be determined. */
export function kgPerUnit(region: RegionPack, unitId: string, commodityId?: string): number | null {
  const unit = region.units.find((u) => u.id === unitId)
  if (!unit) return null
  if (unit.toKg !== undefined) return unit.toKg
  if (unitId === 'bushel' && commodityId) return region.bushelWeightKg?.[commodityId] ?? null
  return null
}

/**
 * Converts a quantity between units of one region. Commodity-specific units
 * (bushel) require a known commodity and never fall back to a universal factor:
 * unknown combinations throw instead of guessing.
 */
export function convertQuantity(
  value: number,
  from: string,
  to: string,
  region: RegionPack,
  commodityId?: string,
): number {
  const fromKg = kgPerUnit(region, from, commodityId)
  const toKg = kgPerUnit(region, to, commodityId)
  if (fromKg === null || toKg === null) {
    throw new Error(`No conversion rule for ${from} -> ${to}` + (commodityId ? ` (${commodityId})` : ''))
  }
  return (value * fromKg) / toKg
}
