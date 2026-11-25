import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import i18n from '../i18n'
import { getLanguage, LANGUAGES, type LanguageDef } from '../config/languages'
import { readPref, writePref } from '../utils/storage'

const KEY = 'agri.lang'

interface LanguageState {
  language: LanguageDef
  languages: LanguageDef[]
  /** True when the chosen language has no complete UI translation and English is shown. */
  usingFallback: boolean
  setLanguage: (code: string) => void
}

const LanguageContext = createContext<LanguageState | null>(null)

function initialCode(): string {
  const saved = readPref(KEY)
  return saved && LANGUAGES.some((l) => l.code === saved) ? saved : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string>(initialCode)
  const language = getLanguage(code)

  // Language never touches the region: country and language are independent axes.
  useEffect(() => {
    void i18n.changeLanguage(language.uiComplete ? language.code : 'en')
    document.documentElement.lang = language.code
    document.documentElement.dir = language.dir
  }, [language])

  const setLanguage = useCallback((next: string) => {
    if (!LANGUAGES.some((l) => l.code === next)) return
    setCode(next)
    writePref(KEY, next)
  }, [])

  const value = useMemo<LanguageState>(
    () => ({ language, languages: LANGUAGES, usingFallback: !language.uiComplete, setLanguage }),
    [language, setLanguage],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageState {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
