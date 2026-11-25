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

  it('hero illustration follows the selected country', async () => {
    const user = userEvent.setup()
    render(<AppProviders><MemoryRouter><Navbar /><Home /></MemoryRouter></AppProviders>)
    expect(screen.getByRole('img', { name: /Indian farmland/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Country' }))
    await user.click(screen.getByRole('option', { name: /United States/ }))
    expect(screen.getByRole('img', { name: /American farm/ })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Indian farmland/ })).toBeNull()
  })
})
