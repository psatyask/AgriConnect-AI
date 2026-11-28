import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders } from '../context/AppProviders'
import Navbar from '../components/Navbar'
import Home from '../pages/Home'
import { listRegions } from '../regions/registry'
import { cropBg } from '../components/art/CropIcon'

describe('illustrations', () => {
  it('every commodity in every country pack has its own icon colour (no silent fallback)', () => {
    const fallback = cropBg('__unknown__')
    for (const r of listRegions()) {
      for (const c of r.commodities) expect(cropBg(c.id), `${r.code}/${c.id}`).not.toBe(fallback)
    }
  })

  it('hero pictures follow the selected country', async () => {
    const user = userEvent.setup()
    render(<AppProviders><MemoryRouter><Navbar /><Home /></MemoryRouter></AppProviders>)
    const srcs = () => [...screen.getByTestId('hero-carousel').querySelectorAll('img')].map((i) => i.getAttribute('src'))
    expect(srcs()).toEqual(['/images/hero/hero-india.webp', '/images/hero/hero-india-2.webp', '/images/hero/hero-in.webp', '/images/hero/hero-section.webp'])
    expect(screen.getByRole('img', { name: /farmers in a field look at crop data/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Country' }))
    await user.click(screen.getByRole('option', { name: /United States/ }))
    expect(srcs()).toEqual(['/images/hero/hero-us.webp', '/images/hero/us-farmer-hero-1.webp', '/images/hero/hero-section.webp'])
    expect(screen.getByRole('img', { name: /cowboy hat/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show picture 2 of 3' }))
    expect(screen.getByRole('img', { name: /walks between crop rows/ })).toBeInTheDocument()
  })
})
