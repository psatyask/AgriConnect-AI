import type { RegionPack } from './types'
import { IN } from './in'
import { US } from './us'

/**
 * The registry is the only place that knows which countries exist.
 * To add a country: create a pack in this folder and register it below
 * (or call registerRegion at startup). No shared code needs to change.
 */
const packs = new Map<string, RegionPack>()

export function registerRegion(pack: RegionPack): void {
  packs.set(pack.code, pack)
}

export function unregisterRegion(code: string): void {
  packs.delete(code)
}

export function listRegions(): RegionPack[] {
  return Array.from(packs.values())
}

export function getRegion(code: string): RegionPack | undefined {
  return packs.get(code)
}

export const DEFAULT_REGION_CODE = 'IN'

registerRegion(IN)
registerRegion(US)
