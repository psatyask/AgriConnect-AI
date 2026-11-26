/**
 * A "country pack" describes everything country-specific. Shared code must only
 * read these objects through the registry and never branch on a country code.
 */
export interface UnitDef {
  id: string
  /** i18n key suffix under `units.*` */
  labelKey: string
  /**
   * Weight of one unit in kilograms. Omitted for commodity-specific units
   * (e.g. a bushel), which are resolved through `commoditySpecificUnits`.
   */
  toKg?: number
}

export interface CommodityDef {
  /** Canonical, language-independent identifier shared across countries. */
  id: string
  /** i18n key suffix under `commodities.*` */
  nameKey: string
  categoryKey: string
  /** Default unit id for prices of this commodity in this country. */
  priceUnit: string
  /** Shown on the home page. The full list stays available in every picker. */
  featured?: boolean
}

export interface RegionPack {
  code: string
  nameKey: string
  flag: string
  currency: { code: string; symbol: string }
  /** Locale used for number/date formatting when the UI language has no preference. */
  defaultLanguage: string
  suggestedLanguages: string[]
  units: UnitDef[]
  /** Pounds (or kg) per bushel by canonical commodity id. Never a universal factor. */
  bushelWeightKg?: Record<string, number>
  hierarchy: string[]
  commodities: CommodityDef[]
  /** Hero image slot. Placeholder until licensed photos are supplied. */
  heroImage: { src: string | null; altKey: string; scene: string }
  /** Marks every datum in this pack as demonstration data (Phase 1 only). */
  demoOnly: boolean
}
