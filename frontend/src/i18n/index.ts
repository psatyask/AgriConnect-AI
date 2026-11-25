import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en'
import hi from '../locales/hi'
import te from '../locales/te'
import es from '../locales/es'

export const SUPPORTED_UI = ['en', 'hi', 'te', 'es'] as const

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    te: { translation: te },
    es: { translation: es },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
