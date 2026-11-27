import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '../context/AppProviders'
import { Intelligence } from '../pages/Market'

const TREE = { as_of: '2026-11-26', states: [{ state: 'Test State', districts: [{ district: 'Test District A', markets: ['Test Mandi 1'] }] }] }
const ROW = { state: 'Test State', district: 'Test District A', market: 'Test Mandi 1', variety: 'Local', grade: 'FAQ', date: '2026-11-26',
  min: 1800, max: 2600, modal: 2200, unit: 'quintal', currency: 'INR', period: 'daily', source: 'agmarknet', source_label: 'Agmarknet (Government of India)' }
const HIST = { basis: 'modal', unit: 'quintal', needs: null, points: [] }
const TERMINAL = { as_of: '2026-11-23', states: [{ state: 'Test State One', districts: [{ district: '', markets: ['Test Terminal Market'] }] }] }
const TBASE = { state: 'Test State One', district: '', market: 'Test Terminal Market', variety: 'ROUND TYPE', grade: '', date: '2026-11-23', modal: null, currency: 'USD', period: 'daily',
  source: 'ams', source_label: 'USDA AMS Market News, terminal markets' }

interface Mock { rows: unknown[]; tree?: unknown; total?: number; checked?: string | null; history?: (url: string) => unknown; forecast?: unknown; signal?: unknown }
function mock({ rows, tree = TREE, total, checked = null, history = () => HIST, forecast = { status: 'no_forecast', reason: 'too_little_history', horizon_days: 7 }, signal = { status: 'none', reason: 'no_evidence' } }: Mock) {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url)
    const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response
    if (url === '/api/auth/me') return reply(401, {})
    if (url === '/api/config') return reply(200, { googleClientId: null })
    if (url.startsWith('/api/prices/locations')) return reply(200, tree)
    if (url.startsWith('/api/prices/forecast')) return reply(200, forecast)
    if (url.startsWith('/api/prices/signal')) return reply(200, signal)
    if (url.startsWith('/api/prices/history')) return reply(200, history(url))
    if (url.startsWith('/api/prices?')) return reply(200, { total: total ?? rows.length, checked_at: checked, items: rows })
    return reply(404, {})
  }))
  return urls
}
const page = () => render(<AppProviders><MemoryRouter><Intelligence /></MemoryRouter></AppProviders>)
beforeEach(() => window.localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

test('reported prices show market, date, source and no demo label', async () => {
  mock({ rows: [ROW] })
  page()
  expect(await screen.findByText(/Test Mandi 1, Test State/)).toBeInTheDocument()
  expect(screen.getByText(/Agmarknet \(Government of India\)/)).toBeInTheDocument()
  expect(screen.getByText(/Latest report: 2026-11-26/)).toBeInTheDocument()
  expect(screen.queryByText(/Live prices for .* are not connected/)).not.toBeInTheDocument()
})

test('with no stored prices the page says so and labels the demo table', async () => {
  mock({ rows: [], tree: { as_of: null, states: [] } })
  page()
  expect(await screen.findByText(/No reported prices for this selection yet/)).toBeInTheDocument()
  expect(screen.getByText(/No live prices have been loaded/)).toBeInTheDocument()
})

test('state, district and market pickers cascade, filter the request, and can be cleared', async () => {
  const urls = mock({ rows: [ROW] })
  const user = userEvent.setup()
  page()
  await screen.findByText(/Test Mandi 1, Test State/)
  const state = screen.getByLabelText('State'), district = screen.getByLabelText('District'), market = screen.getByLabelText('Market')
  expect(district).toBeDisabled(); expect(market).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  await user.selectOptions(state, 'Test State')
  expect(district).toBeEnabled()
  await user.selectOptions(district, 'Test District A')
  await user.selectOptions(market, 'Test Mandi 1')
  await waitFor(() => expect(urls.some((u) => u.includes('state=Test+State') && u.includes('district=Test+District+A') && u.includes('market=Test+Mandi+1'))).toBe(true))
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(state).toHaveValue(''); expect(market).toBeDisabled()
})

test('prices with a modal show the range, the modal and a marker; the chart follows the modal history', async () => {
  mock({ rows: [ROW], history: () => ({ ...HIST, points: [{ date: '2026-11-20', price: 2100, reports: 3 }, { date: '2026-11-26', price: 2200, reports: 3 }] }) })
  page()
  const line = await screen.findByRole('button', { name: /Local/ })
  expect(within(line).getByText(/₹1,800 – ₹2,600/)).toBeInTheDocument()
  expect(within(line).getByText(/Modal/)).toBeInTheDocument()
  expect(await screen.findByText(/Up ₹100 since 2026-11-20/)).toBeInTheDocument()
  expect(screen.getByText(/Daily average of reported modal prices/)).toBeInTheDocument()
})

test('US state-level monthly prices: one line per state, no district or market pickers, month shown', async () => {
  window.localStorage.setItem('agri.country', 'US')
  const US_ROW = { state: 'Test State One', district: '', market: 'State average', variety: '', grade: '', date: '2026-10-01', min: null, max: null, modal: 4.1,
    unit: 'bushel', currency: 'USD', period: 'monthly', source: 'nass', source_label: 'USDA NASS, prices received by farmers' }
  mock({ rows: [US_ROW], tree: { as_of: '2026-10-01', states: [{ state: 'Test State One', districts: [{ district: '', markets: ['State average'] }] }] } })
  page()
  expect(await screen.findByRole('button', { name: /Test State One/ })).toHaveTextContent('$4.10')
  expect(screen.getByRole('option', { name: 'Corn' })).toBeInTheDocument() // US crops, so the US pack is active
  expect(screen.getByText(/Latest report: 2026-10$/)).toBeInTheDocument()
  expect(screen.getByText('1 line at $4.10')).toBeInTheDocument()  // singular, and no pointless "$4.10 to $4.10" range
  expect(screen.getByText('Showing 1 of 1 price line')).toBeInTheDocument()
  expect(screen.getByText(/USDA NASS/)).toBeInTheDocument()
  expect(screen.queryByLabelText('District')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Market')).not.toBeInTheDocument()
  expect(screen.queryByText(/Min \/ Max/)).not.toBeInTheDocument()
})

test('US terminal markets: mixed packages default to one per-lb scale, and "As reported" restores the packages; market picker works without districts', async () => {
  window.localStorage.setItem('agri.country', 'US')
  const urls = mock({ rows: [{ ...TBASE, grade: 'large', min: 20, max: 24, unit: '25 lb cartons' }, { ...TBASE, grade: 'large · organic', min: 30, max: 34, unit: '20 lb cartons' }], tree: TERMINAL })
  const user = userEvent.setup()
  page()
  expect(await screen.findByRole('heading', { name: 'Per lb' })).toBeInTheDocument()  // both packages state a weight: one scale
  expect(screen.getByRole('button', { name: /\$0\.80 – \$0\.96/ })).toBeInTheDocument()  // $20-$24 per 25 lb
  expect(screen.getByRole('button', { name: /\$1\.50 – \$1\.70/ })).toBeInTheDocument()  // $30-$34 per 20 lb
  expect(screen.getByText(/converted to per lb using the weight in each package name/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'As reported' }))
  expect(screen.getByRole('heading', { name: '25 lb cartons' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '20 lb cartons' })).toBeInTheDocument()  // as reported, packages never share a scale
  expect(screen.getByText('large · organic')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /\$20 – \$24/ })).toBeInTheDocument()
  expect(screen.queryByText(/Modal/)).not.toBeInTheDocument()
  expect(screen.getByText(/Prices are per the package named above each group/)).toBeInTheDocument()
  expect(screen.getByText(/Min \/ Max = the lowest and highest price/)).toBeInTheDocument()
  expect(screen.queryByLabelText('District')).not.toBeInTheDocument()
  const market = screen.getByLabelText('Market')
  expect(market).toBeDisabled()
  await user.selectOptions(screen.getByLabelText('State'), 'Test State One')
  expect(market).toBeEnabled()
  await user.selectOptions(market, 'Test Terminal Market')
  await waitFor(() => expect(urls.some((u) => u.includes('market=Test+Terminal+Market'))).toBe(true))
})

test('packages with no stated weight are never converted: they stay in their own group with a note', async () => {
  window.localStorage.setItem('agri.country', 'US')
  mock({ rows: [{ ...TBASE, min: 20, max: 24, unit: '25 lb cartons' }, { ...TBASE, variety: 'VINE RIPES', min: 50, max: 52, unit: 'cartons 2 layer' }], tree: TERMINAL })
  page()
  expect(await screen.findByRole('heading', { name: 'Per lb' })).toBeInTheDocument()
  const layer = screen.getByRole('heading', { name: 'cartons 2 layer' }).closest('section') as HTMLElement
  expect(within(layer).getByText('No weight in the package name, so these cannot be shown per lb.')).toBeInTheDocument()
  expect(within(layer).getByRole('button', { name: /\$50 – \$52/ })).toBeInTheDocument()  // exactly as reported, not a guessed per-lb price
})

test('India: a quintal price can be shown per kg, converted exactly (1 quintal = 100 kg)', async () => {
  const user = userEvent.setup()
  mock({ rows: [ROW] })
  page()
  expect(await screen.findByRole('button', { name: /₹1,800 – ₹2,600/ })).toBeInTheDocument()  // one package: stays as reported by default
  await user.click(screen.getByRole('button', { name: 'Per kg' }))
  const line = screen.getByRole('button', { name: /Local/ })
  expect(within(line).getByText(/₹18 – ₹26/)).toBeInTheDocument()
  expect(within(line).getByText(/₹22/)).toBeInTheDocument()  // the modal, 2200 / 100
})

test('long lists: each package shows its first 8 lines with a per-group expander, the variety filter works, and a server cut-off is disclosed', async () => {
  window.localStorage.setItem('agri.country', 'US')
  const lines = Array.from({ length: 45 }, (_, i) => ({ ...TBASE, variety: i % 2 ? 'VINE RIPES' : 'ROMA TYPE', grade: `size ${String(i).padStart(2, '0')}`, min: 10 + i, max: 12 + i, unit: i < 40 ? '25 lb cartons' : '10 lb cartons' }))
  mock({ rows: lines, total: 60, tree: TERMINAL })
  const user = userEvent.setup()
  page()
  await user.click(await screen.findByRole('button', { name: 'As reported' }))
  const big = (await screen.findByRole('heading', { name: '25 lb cartons' })).closest('section') as HTMLElement
  const small = screen.getByRole('heading', { name: '10 lb cartons' }).closest('section') as HTMLElement
  expect(within(big).getAllByText(/^size \d\d$/)).toHaveLength(8)
  expect(big).toHaveAccessibleName('25 lb cartons')  // the group is labelled by its heading
  expect(within(small).getAllByText(/^size \d\d$/)).toHaveLength(5)  // a small group is shown whole
  expect(screen.getByText(/the source has 60 lines in total, only the first 45 were loaded/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Show 32 more lines' }))
  expect(within(big).getAllByText(/^size \d\d$/)).toHaveLength(40)
  await user.click(screen.getByRole('button', { name: 'Show fewer lines' }))
  expect(within(big).getAllByText(/^size \d\d$/)).toHaveLength(8)
  await user.selectOptions(screen.getByLabelText('Variety'), 'ROMA TYPE')
  expect(await screen.findByText(/Showing 23 of 23 price lines/)).toBeInTheDocument()
})

test('the chart follows the line you pick, in the same unit as the list, and states its basis and the change', async () => {
  window.localStorage.setItem('agri.country', 'US')
  const urls = mock({
    rows: [{ ...TBASE, min: 20, max: 24, unit: '25 lb cartons' }, { ...TBASE, min: 9, max: 10, unit: '10 lb cartons' }], tree: TERMINAL,
    history: (url) => ({ basis: 'midpoint', needs: null, unit: new URL(url, 'http://x').searchParams.get('unit'), points: [{ date: '2026-11-16', price: 20, reports: 2 }, { date: '2026-11-20', price: 22, reports: 1 }] }),
  })
  const user = userEvent.setup()
  page()
  expect(await screen.findByText(/Midpoint of the reported low–high range, per lb/)).toBeInTheDocument()  // list and chart share one scale
  expect(screen.getByText(/Up \$0\.08 since 2026-11-16/)).toBeInTheDocument()  // $20 -> $22 per 25 lb package = $0.80 -> $0.88 per lb
  expect(urls.some((u) => u.startsWith('/api/prices/history') && u.includes('unit=25+lb+cartons') && u.includes('variety=ROUND+TYPE'))).toBe(true)  // the server still gets the reported package
  await user.click(screen.getByRole('button', { name: /\$0\.90 – \$1/ }))  // the 10 lb line
  expect(await screen.findByText(/Up \$0\.20 since 2026-11-16/)).toBeInTheDocument()
  expect(urls.some((u) => u.startsWith('/api/prices/history') && u.includes('unit=10+lb+cartons'))).toBe(true)
  await user.click(screen.getByRole('button', { name: 'As reported' }))
  expect(await screen.findByText(/Midpoint of the reported low–high range, per 10 lb cartons/)).toBeInTheDocument()
  expect(screen.getByText(/Up \$2 since 2026-11-16/)).toBeInTheDocument()  // back in the reported package
  expect(screen.getByText(/10 lb cartons · 1 line$/)).toBeInTheDocument()
})

test('shows when prices were last checked, and warns when the data has gone stale', async () => {
  mock({ rows: [ROW], checked: new Date().toISOString() })
  const first = page()
  expect(await screen.findByText(/Last checked:/)).toBeInTheDocument()
  expect(screen.queryByText(/may not be running/)).not.toBeInTheDocument()
  first.unmount()
  mock({ rows: [ROW], checked: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() })
  page()
  expect(await screen.findByText(/automatic refresh may not be running/)).toBeInTheDocument()
})

test('a loading page announces itself instead of showing an empty screen', async () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  page()
  expect(await screen.findByText('Loading prices')).toBeInTheDocument()
})

test('while the history loads the chart card shows a placeholder, never a wrong "not enough days" message', async () => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    const reply = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: async () => body } as Response)
    if (url === '/api/auth/me') return reply(401, {})
    if (url === '/api/config') return reply(200, { googleClientId: null })
    if (url.startsWith('/api/prices/locations')) return reply(200, TREE)
    if (url.startsWith('/api/prices/forecast')) return reply(200, { status: 'no_forecast', reason: 'too_little_history', horizon_days: 7 })
    if (url.startsWith('/api/prices/history')) return new Promise(() => {})  // never answers
    if (url.startsWith('/api/prices?')) return reply(200, { total: 1, checked_at: null, items: [ROW] })
    return reply(404, {})
  }))
  page()
  await screen.findByRole('button', { name: /Local/ })
  expect(screen.queryByText(/Not enough days of reports/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Daily average of reported modal prices/)).not.toBeInTheDocument()
})


const TWO_DAYS = { basis: 'modal', unit: 'quintal', needs: null, points: [{ date: '2026-11-25', price: 2100, reports: 1 }, { date: '2026-11-26', price: 2200, reports: 1 }] }

test('a forecast that passed its tests is shown with its range and the evidence behind it', async () => {
  mock({ rows: [ROW], history: () => TWO_DAYS, forecast: { status: 'ok', model: 'trend', value: 2300, low: 2200, high: 2450, target_date: '2026-12-03', holdout_skill: 0.18, holdout_tests: 12, horizon_days: 7 } })
  page()
  const box = await screen.findByTestId('forecast')
  expect(await within(box).findByText(/Expected around .*2,300.* on 2026-12-03 \(likely .*2,200.*2,450.*\)/)).toBeInTheDocument()
  expect(within(box).getByText(/the recent trend \(damped\) came 18% closer than simply assuming the price stays at the latest report \(12 tests\)/)).toBeInTheDocument()
})

test('when no method beat the baseline the page says so and shows no forecast number', async () => {
  mock({ rows: [ROW], history: () => TWO_DAYS, forecast: { status: 'no_forecast', reason: 'not_better_than_baseline', horizon_days: 7 } })
  page()
  const box = await screen.findByTestId('forecast')
  expect(await within(box).findByText(/No forecast: on past dates, no method predicted this line better/)).toBeInTheDocument()
  expect(within(box).queryByText(/Expected around/)).not.toBeInTheDocument()
})

test('monthly prices are not forecast and the page does not ask the server', async () => {
  const urls = mock({ rows: [{ ...ROW, period: 'monthly' }], history: () => TWO_DAYS })
  page()
  const box = await screen.findByTestId('forecast')
  expect(within(box).getByText('Forecasts are only offered for daily prices.')).toBeInTheDocument()
  expect(urls.some((u) => u.startsWith('/api/prices/forecast'))).toBe(false)
})

async function pickMarket() {
  const user = userEvent.setup()
  await screen.findByRole('option', { name: 'Test State' })
  await user.selectOptions(screen.getByLabelText('State'), 'Test State')
  await user.selectOptions(screen.getByLabelText('District'), 'Test District A')
  await user.selectOptions(screen.getByLabelText('Market'), 'Test Mandi 1')
}

const SIGNAL = { status: 'ok', p_up: 0.72, lines: 1, as_of: '2026-11-26', other_markets_change: 0.031, evidence: { auc: 0.71, auc_low: 0.66, auc_high: 0.75, tests: 900, through: '2026-11-26' } }

test('a direction signal is shown with what it does and does not say, only when the server returns one', async () => {
  mock({ rows: [ROW], history: () => TWO_DAYS, signal: SIGNAL })
  page()
  await pickMarket()
  const box = await screen.findByTestId('signal')
  expect(within(box).getByText(/more likely to go up \(72% chance\)/)).toBeInTheDocument()
  expect(within(box).getByText(/does not say whether the price will move/)).toBeInTheDocument()
  expect(within(box).getByText(/\+3\.1% over the last 7 days/)).toBeInTheDocument()
})

test('no direction signal card when the product has no proven evidence', async () => {
  mock({ rows: [ROW], history: () => TWO_DAYS })
  page()
  await pickMarket()
  await screen.findByTestId('forecast')
  expect(screen.queryByTestId('signal')).not.toBeInTheDocument()
})
