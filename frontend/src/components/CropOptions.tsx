import { useTranslation } from 'react-i18next'
import type { CommodityDef } from '../regions/types'

/** Crop <option>s grouped by category, so a long crop list stays easy to scan. A single category stays flat. */
export default function CropOptions({ crops }: { crops: CommodityDef[] }) {
  const { t } = useTranslation()
  const order: string[] = []
  for (const c of crops) if (!order.includes(c.categoryKey)) order.push(c.categoryKey)
  const option = (c: CommodityDef) => <option key={c.id} value={c.id}>{t(c.nameKey)}</option>
  if (order.length < 2) return <>{crops.map(option)}</>
  return <>{order.map((k) => <optgroup key={k} label={t(k)}>{crops.filter((c) => c.categoryKey === k).map(option)}</optgroup>)}</>
}
