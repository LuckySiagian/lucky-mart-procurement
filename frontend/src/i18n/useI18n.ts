import { createContext, useContext } from 'react'
import type { MessageKey } from './en'

export type Language = 'en' | 'id'

export const LANGUAGES: { code: Language; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'id', label: 'Bahasa Indonesia', short: 'ID' },
]

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

export interface I18nState {
  language: Language
  /** BCP 47 locale for Intl number and date formatting. */
  locale: string
  setLanguage: (language: Language) => void
  t: Translate
}

export const I18nContext = createContext<I18nState | null>(null)

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

export function interpolate(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}
