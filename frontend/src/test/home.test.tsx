import { describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders } from '../context/AppProviders'
import Navbar from '../components/Navbar'
import NewsTicker from '../components/NewsTicker'
import Home from '../pages/Home'

const setup = () =>
  render(
    <AppProviders>
      <MemoryRouter>
        <Navbar />
        <NewsTicker />
        <Home />
      </MemoryRouter>
    </AppProviders>,
  )

describe('homepage regional behavior', () => {
  it('shows India data first, then US data after switching country, with no India listings left', async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.getAllByText(/Guntur/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Country' }))
    await user.click(screen.getByRole('option', { name: /United States/ }))
    expect(screen.queryByText(/Guntur/)).toBeNull()
    expect(screen.getAllByText(/Iowa/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\$4\.40/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/bushel/).length).toBeGreaterThan(0)
  })

  it('language switch changes text but not the region data', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Language' }))
    await user.type(screen.getByLabelText('Search languages'), 'తెలు')
    await user.click(screen.getByRole('option', { name: /Telugu/ }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('కలిసి'))
    expect(screen.getAllByText(/Guntur/).length).toBeGreaterThan(0)
  })

  it('labels demo content and offers a pause control for the ticker', async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.getAllByText(/demo/i).length).toBeGreaterThan(2)
    const pause = screen.getByRole('button', { name: /Pause news ticker/ })
    await user.click(pause)
    expect(screen.getByRole('button', { name: /Resume news ticker/ })).toBeInTheDocument()
    expect(within(document.body).getAllByRole('list').length).toBeGreaterThan(0)
    void act
  })
})
