import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '../context/AppProviders'
import { Marketplace } from '../pages/Market'

const LISTING = { id: 'l1', region_code: 'IN', commodity: 'tomato', variety: 'Hybrid', grade: 'A', place: 'Guntur', description: '',
  unit: 'quintal', quantity: 40, price: 2200, currency: 'INR', status: 'active', created_at: '2026-01-01T00:00:00Z', farmer_name: 'Fay' }
const BUYER = { id: 'b', email: 'b@x.com', name: 'B', picture: null, role: 'buyer' }

function mockApi(opts: { me: unknown | null; items: unknown[]; posted?: string[] }) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response
    if (url === '/api/auth/me') return opts.me ? reply(200, opts.me) : reply(401, {})
    if (url === '/api/config') return reply(200, { googleClientId: null })
    if (url.startsWith('/api/listings?')) return reply(200, { total: opts.items.length, items: opts.items })
    if (url.endsWith('/inquiries') && init?.method === 'POST') { opts.posted?.push(String(init.body)); return reply(201, {}) }
    return reply(404, {})
  }))
}
const page = () => render(<AppProviders><MemoryRouter><Marketplace /></MemoryRouter></AppProviders>)

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

test('real listings are shown without any demo label', async () => {
  mockApi({ me: null, items: [LISTING] })
  page()
  expect(await screen.findByText(/Guntur/)).toBeInTheDocument()
  expect(screen.queryByText(/Example listings/i)).not.toBeInTheDocument()
})

test('with no real listings the page says so and labels the examples as demo', async () => {
  mockApi({ me: null, items: [] })
  page()
  expect(await screen.findByText(/No listings yet/i)).toBeInTheDocument()
  expect(screen.getByText(/Example listings \(demo, not real\)/i)).toBeInTheDocument()
})

test('a buyer can send an inquiry; signed-out visitors are sent to login', async () => {
  const posted: string[] = []
  mockApi({ me: BUYER, items: [LISTING], posted })
  const user = userEvent.setup()
  page()
  await user.click(await screen.findByRole('button', { name: /send inquiry/i }))
  await user.type(screen.getByRole('textbox', { name: /send inquiry/i }), 'Is 20 quintals available?')
  await user.click(screen.getAllByRole('button', { name: /send inquiry/i }).at(-1)!)
  expect(await screen.findByText(/Inquiry sent/i)).toBeInTheDocument()
  expect(JSON.parse(posted[0])).toEqual({ message: 'Is 20 quintals available?' })
})

test('signed-out visitor sees a sign-in link instead of the inquiry button', async () => {
  mockApi({ me: null, items: [LISTING] })
  page()
  expect(await screen.findByRole('link', { name: /sign in as a buyer/i })).toHaveAttribute('href', '/login')
  expect(screen.queryByRole('button', { name: /send inquiry/i })).not.toBeInTheDocument()
})
