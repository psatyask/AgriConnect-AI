import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '../context/AppProviders'
import { BuyerArea, FarmerArea, Login } from '../pages/Account'
import { Route, Routes } from 'react-router-dom'

type Reply = { status?: number; body?: unknown }
function mockApi(routes: Record<string, Reply>) {
  const fn = vi.fn(async (url: string) => {
    const r = routes[url] ?? { status: 404, body: { detail: 'Not found' } }
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body ?? {} } as Response
  })
  vi.stubGlobal('fetch', fn)
  return fn
}
const app = (path: string) => render(
  <AppProviders><MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard/farmer" element={<FarmerArea />} />
      <Route path="/dashboard/buyer" element={<BuyerArea />} />
    </Routes>
  </MemoryRouter></AppProviders>)

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { vi.unstubAllGlobals() })

test('signed-out visitor to a dashboard is sent to login', async () => {
  mockApi({ '/api/auth/me': { status: 401, body: { detail: 'Not signed in' } }, '/api/config': { body: { googleClientId: null } } })
  app('/dashboard/farmer')
  expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
})

test('a buyer cannot see the farmer dashboard', async () => {
  mockApi({ '/api/auth/me': { body: { id: '1', email: 'b@x.com', name: 'B', picture: null, role: 'buyer' } }, '/api/config': { body: { googleClientId: null } } })
  app('/dashboard/farmer')
  expect(await screen.findByRole('alert')).toHaveTextContent(/Farmer/)
})

test('login without Google configured says so and shows no Google button', async () => {
  mockApi({ '/api/auth/me': { status: 401, body: {} }, '/api/config': { body: { googleClientId: null } } })
  app('/login')
  expect(await screen.findByText(/not set up on this server/i)).toBeInTheDocument()
})

test('email login success redirects to the role dashboard; server error text is shown on failure', async () => {
  const user = userEvent.setup()
  mockApi({ '/api/auth/me': { status: 401, body: {} }, '/api/config': { body: { googleClientId: null } }, '/api/auth/login': { status: 401, body: { detail: 'Wrong email or password' } } })
  app('/login')
  await user.type(await screen.findByLabelText(/email/i), 'a@x.com')
  await user.type(screen.getByLabelText(/password/i), 'whatever-pass')
  await user.click(screen.getByRole('button', { name: /^sign in$/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password')
  await waitFor(() => expect(screen.queryByText(/Farmer dashboard/i)).not.toBeInTheDocument())
})
