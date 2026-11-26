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
