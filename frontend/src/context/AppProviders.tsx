import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RegionProvider } from './RegionContext'
import { LanguageProvider } from './LanguageContext'
import { ThemeProvider } from './ThemeContext'
import '../i18n'

/** Order matters: Region needs the QueryClient to purge stale regional data on switch. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }))
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <LanguageProvider>
          <RegionProvider>{children}</RegionProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
