export interface LanguageDef {
  /** BCP 47 code */
  code: string
  english: string
  native: string
  dir: 'ltr' | 'rtl'
  /** true when the static interface has full translations; others fall back to English. */
  uiComplete: boolean
}

/** Extensible catalog: add a row here (and a locale file to mark it uiComplete). */
export const LANGUAGES: LanguageDef[] = [
  { code: 'en', english: 'English', native: 'English', dir: 'ltr', uiComplete: true },
  { code: 'te', english: 'Telugu', native: 'తెలుగు', dir: 'ltr', uiComplete: true },
  { code: 'hi', english: 'Hindi', native: 'हिन्दी', dir: 'ltr', uiComplete: true },
  { code: 'es', english: 'Spanish', native: 'Español', dir: 'ltr', uiComplete: true },
  { code: 'ta', english: 'Tamil', native: 'தமிழ்', dir: 'ltr', uiComplete: false },
  { code: 'kn', english: 'Kannada', native: 'ಕನ್ನಡ', dir: 'ltr', uiComplete: false },
  { code: 'ml', english: 'Malayalam', native: 'മലയാളം', dir: 'ltr', uiComplete: false },
  { code: 'bn', english: 'Bengali', native: 'বাংলা', dir: 'ltr', uiComplete: false },
  { code: 'mr', english: 'Marathi', native: 'मराठी', dir: 'ltr', uiComplete: false },
  { code: 'gu', english: 'Gujarati', native: 'ગુજરાતી', dir: 'ltr', uiComplete: false },
  { code: 'pa', english: 'Punjabi', native: 'ਪੰਜਾਬੀ', dir: 'ltr', uiComplete: false },
  { code: 'ur', english: 'Urdu', native: 'اردو', dir: 'rtl', uiComplete: false },
  { code: 'fr', english: 'French', native: 'Français', dir: 'ltr', uiComplete: false },
  { code: 'de', english: 'German', native: 'Deutsch', dir: 'ltr', uiComplete: false },
  { code: 'pt', english: 'Portuguese', native: 'Português', dir: 'ltr', uiComplete: false },
  { code: 'ar', english: 'Arabic', native: 'العربية', dir: 'rtl', uiComplete: false },
  { code: 'zh', english: 'Chinese', native: '中文', dir: 'ltr', uiComplete: false },
  { code: 'ja', english: 'Japanese', native: '日本語', dir: 'ltr', uiComplete: false },
  { code: 'ko', english: 'Korean', native: '한국어', dir: 'ltr', uiComplete: false },
  { code: 'ru', english: 'Russian', native: 'Русский', dir: 'ltr', uiComplete: false },
]

export function getLanguage(code: string): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]
}

/** Matches English names, native names and codes, ignoring case and accents. */
export function searchLanguages(query: string): LanguageDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return LANGUAGES
  return LANGUAGES.filter(
    (l) =>
      l.english.toLowerCase().includes(q) ||
      l.native.toLowerCase().includes(q) ||
      l.code.toLowerCase().startsWith(q),
  )
}
