import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '../context/AppProviders'
import { Intelligence } from '../pages/Market'

const TREE = { as_of: '2026-11-26', states: [{ state: 'Test State', districts: [{ district: 'Test District A', markets: ['Test Mandi 1'] }] }] }
const ROW = { state: 'Test State', district: 'Test District A', market: 'Test Mandi 1', variety: 'Local', grade: 'FAQ', date: '2026-11-26',
  min: 1800, max: 2600, modal: 2200, unit: 'quintal', currency: 'INR', source: 'agmarknet', source_label: 'Agmarknet (Government of India)' }

function mock(rows: unknown[], tree: unknown = TREE) {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url)
    const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response
    if (url === '/api/auth/me') return reply(401, {})
    if (url === '/api/config') return reply(200, { googleClientId: null })
    if (url.startsWith('/api/prices/locations')) return reply(200, tree)
    if (url.startsWith('/api/prices/history')) return reply(200, { points: [] })
    if (url.startsWith('/api/prices?')) return reply(200, { items: rows })
    return reply(404, {})
  }))
  return urls
}
const page = () => render(<AppProviders><MemoryRouter><Intelligence /></MemoryRouter></AppProviders>)
beforeEach(() => window.localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

test('reported prices show market, date, source and no demo label', async () => {
  mock([ROW])
  page()
  expect(await screen.findByText('Test Mandi 1')).toBeInTheDocument()
  expect(screen.getByText(/Agmarknet \(Government of India\)/)).toBeInTheDocument()
  expect(screen.getByText(/Latest report: 2026-11-26/)).toBeInTheDocument()
  expect(screen.queryByText(/Live prices for .* are not connected/)).not.toBeInTheDocument()
})

test('with no stored prices the page says so and labels the demo table', async () => {
  mock([], { as_of: null, states: [] })
  page()
  expect(await screen.findByText(/No reported prices for this selection yet/)).toBeInTheDocument()
  expect(screen.getByText(/No live prices have been loaded/)).toBeInTheDocument()
})

test('state, district and market pickers cascade and filter the request', async () => {
  const urls = mock([ROW])
  const user = userEvent.setup()
  page()
  await screen.findByText('Test Mandi 1')
  const state = screen.getByLabelText('State'), district = screen.getByLabelText('District'), market = screen.getByLabelText('Market')
  expect(district).toBeDisabled(); expect(market).toBeDisabled()
  await user.selectOptions(state, 'Test State')
  expect(district).toBeEnabled()
  await user.selectOptions(district, 'Test District A')
  await user.selectOptions(market, 'Test Mandi 1')
  await waitFor(() => expect(urls.some((u) => u.includes('state=Test+State') && u.includes('district=Test+District+A') && u.includes('market=Test+Mandi+1'))).toBe(true))
})

test('US state-level monthly prices: no district/market pickers, no empty Min/Max columns, month shown', async () => {
  window.localStorage.setItem('agri.country', 'US')
  const US_ROW = { state: 'Test State One', district: '', market: 'State average', variety: '', grade: '', date: '2026-10-01', min: null, max: null, modal: 4.1,
    unit: 'bushel', currency: 'USD', period: 'monthly', source: 'nass', source_label: 'USDA NASS, prices received by farmers' }
  mock([US_ROW], { as_of: '2026-10-01', states: [{ state: 'Test State One', districts: [{ district: '', markets: ['State average'] }] }] })
  page()
  expect(await screen.findByText('State average')).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Corn' })).toBeInTheDocument() // US crops, so the US pack is active
  expect(screen.getByText('2026-10')).toBeInTheDocument()
  expect(screen.getByText(/USDA NASS/)).toBeInTheDocument()
  expect(screen.queryByLabelText('District')).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Min' })).not.toBeInTheDocument()
})

test('US terminal markets: package shown per row, low-high only, market picker works without districts', async () => {
  window.localStorage.setItem('agri.country', 'US')
  const base = { state: 'Test State One', district: '', market: 'Test Terminal Market', variety: 'ROUND TYPE', date: '2026-11-23', modal: null, currency: 'USD', period: 'daily',
    source: 'ams', source_label: 'USDA AMS Market News, terminal markets' }
  const urls = mock([{ ...base, grade: 'large', min: 20, max: 24, unit: '25 lb cartons' }, { ...base, grade: 'large · organic', min: 30, max: 34, unit: '20 lb cartons' }],
    { as_of: '2026-11-23', states: [{ state: 'Test State One', districts: [{ district: '', markets: ['Test Terminal Market'] }] }] })
  const user = userEvent.setup()
  page()
  expect(await screen.findAllByText('Test Terminal Market')).not.toHaveLength(0)
  expect(screen.getByRole('columnheader', { name: 'Unit' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '25 lb cartons' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '20 lb cartons' })).toBeInTheDocument()
  expect(screen.getByText('large · organic')).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: /Modal/ })).not.toBeInTheDocument()
  expect(screen.getByText(/Prices are per the package shown in the Unit column/)).toBeInTheDocument()
  expect(screen.getByText(/Min \/ Max = the lowest and highest price/)).toBeInTheDocument()
  expect(screen.queryByLabelText('District')).not.toBeInTheDocument()
  const market = screen.getByLabelText('Market')
  expect(market).toBeDisabled()
  await user.selectOptions(screen.getByLabelText('State'), 'Test State One')
  expect(market).toBeEnabled()
  await user.selectOptions(market, 'Test Terminal Market')
  await waitFor(() => expect(urls.some((u) => u.includes('market=Test+Terminal+Market'))).toBe(true))
})

test('long terminal-market lists: first 40 lines, filters, show-all, and an honest note when the server cut the list', async () => {
  window.localStorage.setItem('agri.country', 'US')
  const base = { state: 'Test State One', district: '', market: 'Test Terminal Market', date: '2026-11-23', modal: null, currency: 'USD', period: 'daily',
    source: 'ams', source_label: 'USDA AMS Market News, terminal markets' }
  const lines = Array.from({ length: 45 }, (_, i) => ({ ...base, variety: i % 2 ? 'VINE RIPES' : 'ROMA TYPE', grade: `size ${String(i).padStart(2, '0')}`, min: 10 + i, max: 12 + i, unit: i < 40 ? '25 lb cartons' : '10 lb cartons' }))
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url)
    const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response
    if (url === '/api/auth/me') return reply(401, {})
    if (url === '/api/config') return reply(200, { googleClientId: null })
    if (url.startsWith('/api/prices/locations')) return reply(200, { as_of: '2026-11-23', states: [{ state: 'Test State One', districts: [{ district: '', markets: ['Test Terminal Market'] }] }] })
    if (url.startsWith('/api/prices/history')) return reply(200, { points: [] })
    if (url.startsWith('/api/prices?')) return reply(200, { total: 60, items: lines })
    return reply(404, {})
  }))
  const user = userEvent.setup()
  page()
  expect(await screen.findByText(/Showing 40 of 45 price lines/)).toBeInTheDocument()
  expect(screen.getByText(/the source has 60 lines in total, only the first 45 were loaded/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Show all 45 price lines' }))
  expect(await screen.findByText(/Showing 45 of 45 price lines/)).toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Unit'), '10 lb cartons')
  expect(await screen.findByText(/Showing 5 of 5 price lines/)).toBeInTheDocument()
})

test('history for range-only prices asks for one package, then draws the midpoint chart with its basis explained', async () => {
  window.localStorage.setItem('agri.country', 'US')
  const base = { state: 'Test State One', district: '', market: 'Test Terminal Market', variety: 'ROUND TYPE', grade: '', date: '2026-11-23', modal: null, currency: 'USD', period: 'daily',
    source: 'ams', source_label: 'USDA AMS Market News, terminal markets' }
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url)
    const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response
    if (url === '/api/auth/me') return reply(401, {})
    if (url === '/api/config') return reply(200, { googleClientId: null })
    if (url.startsWith('/api/prices/locations')) return reply(200, { as_of: '2026-11-23', states: [{ state: 'Test State One', districts: [{ district: '', markets: ['Test Terminal Market'] }] }] })
    if (url.startsWith('/api/prices/history')) {
      return url.includes('unit=') ? reply(200, { basis: 'midpoint', unit: '25 lb cartons', needs: null, points: [{ date: '2026-11-16', price: 22, reports: 2 }, { date: '2026-11-20', price: 24, reports: 1 }] })
        : reply(200, { basis: 'midpoint', unit: null, needs: 'unit', points: [] })
    }
    if (url.startsWith('/api/prices?')) return reply(200, { total: 2, items: [{ ...base, min: 20, max: 24, unit: '25 lb cartons' }, { ...base, min: 9, max: 10, unit: '10 lb cartons' }] })
    return reply(404, {})
  }))
  const user = userEvent.setup()
  page()
  expect(await screen.findByText(/Pick one package in the Unit filter/)).toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Unit'), '25 lb cartons')
  expect(await screen.findByText(/Midpoint of the reported low–high range, per 25 lb cartons/)).toBeInTheDocument()
  expect(screen.queryByText(/Pick one package/)).not.toBeInTheDocument()
  expect(urls.some((u) => u.startsWith('/api/prices/history') && u.includes('unit=25+lb+cartons'))).toBe(true)
})
