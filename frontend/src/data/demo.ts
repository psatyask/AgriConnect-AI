/**
 * DEMONSTRATION DATA ONLY. Nothing here is real market data, news, or a real person.
 * Every screen that uses it shows a DEMO badge. Replaced by live APIs in later phases.
 */
export interface DemoListing {
  id: string
  commodity: string
  variety: string
  grade: string
  place: string
  price: number
  unit: string
  qty: number
}
export interface DemoPriceRow { commodity: string; market: string; min: number; max: number; modal: number; unit: string }
export interface DemoData {
  news: { title: string; source: string; time: string }[]
  listings: DemoListing[]
  prices: DemoPriceRow[]
  series: { label: string; price: number | null; forecast: number | null }[]
  chartCommodity: string
  chartUnit: string
  dashboard: { active: number; inventory: number; sold: number; inquiries: number; unit: string }
  questions: string[]
  graph: { crop: string; disease: string; market: string; soil: string; program: string }
}

function makeSeries(base: number[], fc: number[]) {
  const hist = base.map((p, i) => ({ label: `D-${base.length - i}`, price: p, forecast: i === base.length - 1 ? p : null }))
  const fut = fc.map((p, i) => ({ label: `D+${i + 1}`, price: null, forecast: p }))
  return [...hist, ...fut]
}

export const DEMO: Record<string, DemoData> = {
  IN: {
    news: [
      { title: '[Demo headline] Mandi arrivals update for the week', source: 'Demo source', time: 'Demo time' },
      { title: '[Demo headline] Monsoon outlook for kharif crops', source: 'Demo source', time: 'Demo time' },
      { title: '[Demo headline] Support scheme announcement for small farmers', source: 'Demo source', time: 'Demo time' },
    ],
    listings: [
      { id: 'in1', commodity: 'tomato', variety: 'Hybrid', grade: 'A', place: 'Guntur, Andhra Pradesh', price: 2200, unit: 'quintal', qty: 40 },
      { id: 'in2', commodity: 'onion', variety: 'Red', grade: 'B', place: 'Nashik, Maharashtra', price: 1600, unit: 'quintal', qty: 25 },
      { id: 'in3', commodity: 'maize', variety: 'Yellow', grade: 'A', place: 'Karimnagar, Telangana', price: 2050, unit: 'quintal', qty: 60 },
    ],
    prices: [
      { commodity: 'tomato', market: 'Demo market A', min: 1800, max: 2600, modal: 2200, unit: 'quintal' },
      { commodity: 'onion', market: 'Demo market B', min: 1300, max: 1900, modal: 1600, unit: 'quintal' },
      { commodity: 'rice', market: 'Demo market C', min: 2800, max: 3400, modal: 3100, unit: 'quintal' },
    ],
    series: makeSeries([2000, 2100, 2050, 2250, 2200, 2300], [2320, 2380, 2350, 2420]),
    chartCommodity: 'tomato',
    chartUnit: 'quintal',
    dashboard: { active: 4, inventory: 120, sold: 85, inquiries: 3, unit: 'quintal' },
    questions: ['Where should I sell my tomatoes near Repalle?', 'Find buyers looking for 2,000 kg of onions', 'Explain early blight'],
    graph: { crop: 'Tomato', disease: 'Early blight', market: 'Demo market A', soil: 'Black soil', program: 'Demo scheme' },
  },
  US: {
    news: [
      { title: '[Demo headline] Crop progress report summary', source: 'Demo source', time: 'Demo time' },
      { title: '[Demo headline] Farm program sign-up window announced', source: 'Demo source', time: 'Demo time' },
      { title: '[Demo headline] Grain basis levels vary across the Midwest', source: 'Demo source', time: 'Demo time' },
    ],
    listings: [
      { id: 'us1', commodity: 'corn', variety: 'Yellow #2', grade: 'A', place: 'Story County, Iowa', price: 4.4, unit: 'bushel', qty: 5000 },
      { id: 'us2', commodity: 'soybeans', variety: 'Food grade', grade: 'A', place: 'McLean County, Illinois', price: 10.6, unit: 'bushel', qty: 3000 },
      { id: 'us3', commodity: 'wheat', variety: 'Hard red winter', grade: 'B', place: 'Reno County, Kansas', price: 5.8, unit: 'bushel', qty: 4000 },
    ],
    prices: [
      { commodity: 'corn', market: 'Demo market A', min: 4.1, max: 4.7, modal: 4.4, unit: 'bushel' },
      { commodity: 'soybeans', market: 'Demo market B', min: 10.2, max: 11.0, modal: 10.6, unit: 'bushel' },
      { commodity: 'wheat', market: 'Demo market C', min: 5.4, max: 6.2, modal: 5.8, unit: 'bushel' },
    ],
    series: makeSeries([4.2, 4.3, 4.25, 4.4, 4.35, 4.4], [4.45, 4.5, 4.48, 4.55]),
    chartCommodity: 'corn',
    chartUnit: 'bushel',
    dashboard: { active: 3, inventory: 12000, sold: 6500, inquiries: 2, unit: 'bushel' },
    questions: ['Compare corn prices across Iowa markets', 'Should I sell my crop today or wait?', 'Show agricultural programs available in Alabama'],
    graph: { crop: 'Corn', disease: 'Gray leaf spot', market: 'Demo market A', soil: 'Loam', program: 'Demo program' },
  },
}

/** Regions without demo data (e.g. a newly registered country) show an empty state, never another country's data. */
export function getDemo(code: string): DemoData | null {
  return DEMO[code] ?? null
}
