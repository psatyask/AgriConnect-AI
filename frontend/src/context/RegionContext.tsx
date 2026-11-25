import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DEFAULT_REGION_CODE, getRegion, listRegions } from '../regions/registry'
import type { RegionPack } from '../regions/types'
import { readPref, writePref } from '../utils/storage'

const KEY = 'agri.country'

interface RegionState {
  region: RegionPack
  regions: RegionPack[]
  setCountry: (code: string) => void
}

const RegionContext = createContext<RegionState | null>(null)

function initialCode(): string {
  const saved = readPref(KEY)
  return saved && getRegion(saved) ? saved : DEFAULT_REGION_CODE
}

export function RegionProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string>(initialCode)
  const queryClient = useQueryClient()

  const setCountry = useCallback(
    (next: string) => {
      if (!getRegion(next) || next === code) return
      setCode(next)
      writePref(KEY, next)
      // Drop in-flight and cached data from the previous region so it cannot flash on screen.
      void queryClient.cancelQueries()
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== next })
    },
    [code, queryClient],
  )

  const value = useMemo<RegionState>(
    () => ({ region: getRegion(code) ?? getRegion(DEFAULT_REGION_CODE)!, regions: listRegions(), setCountry }),
    [code, setCountry],
  )

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>
}

export function useRegion(): RegionState {
  const ctx = useContext(RegionContext)
  if (!ctx) throw new Error('useRegion must be used inside RegionProvider')
  return ctx
}
