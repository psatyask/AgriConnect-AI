import type { RegionPack } from '../regions/types'
import { kgPerUnit } from './format'

const LB = 0.45359237
const SIMPLE: Record<string, number> = { lb: LB, lbs: LB, pound: LB, pounds: LB, kg: 1, kgs: 1, kilogram: 1, kilograms: 1, cwt: 100 * LB, quintal: 100 }
const WEIGHT = /\b(\d+(?:\.\d+)?)\s*-?\s*(lbs?|pounds?|kgs?|kilograms?)\b/g

/**
 * Kilograms in one reported package, or null when the name does not say. Never guesses:
 * "25 lb cartons loose" -> 11.34, "5 kg/11 lb flats" -> 11 lb, but "cartons 2 layer", "flats 12 1-pint cups",
 * "40-50 lb" (a range) and "2 5 lb bags" (a count) stay null.
 */
export function kgPerPackage(unit: string, region: RegionPack, commodityId?: string): number | null {
  const u = unit.trim().toLowerCase()
  if (u in SIMPLE) return SIMPLE[u]
  const known = kgPerUnit(region, u, commodityId)  // the region's own units, e.g. a bushel of corn
  if (known != null) return known
  const lbs = new Set<number>(), kgs = new Set<number>()
  for (const m of u.matchAll(WEIGHT)) {
    const value = Number(m[1])
    if (!(value > 0) || /\d\s*[x×*\-–/]?\s*$/.test(u.slice(0, m.index))) return null  // preceded by a count or a range
    ;(m[2].startsWith('lb') || m[2].startsWith('pound') ? lbs : kgs).add(value)
  }
  if (lbs.size === 1) return [...lbs][0] * LB  // a stated pound weight wins ("5 kg/11 lb")
  if (lbs.size === 0 && kgs.size === 1) return [...kgs][0]
  return null
}
