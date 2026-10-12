import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { setApiLanguage } from '../api/client'
import { en } from './en'
import type { MessageKey } from './en'
import { id } from './id'
import { I18nContext, interpolate } from './useI18n'
import type { Language, Translate } from './useI18n'

const STORAGE_KEY = 'procurement.language'
const MESSAGES: Record<Language, Record<MessageKey, string>> = { en, id }
const LOCALES: Record<Language, string> = { en: 'en-GB', id: 'id-ID' }

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'id') return saved
  } catch {
    // Storage can be blocked; fall back to the browser language.
  }
  return navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)

  // Set during render (not in an effect) so the very first API calls of child
  // components already send the right Accept-Language header.
  setApiLanguage(language)
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not saved, but still switched for this visit.
    }
    setLanguageState(next)
  }, [])

  const t = useCallback<Translate>(
    (key, vars) => interpolate(MESSAGES[language][key] ?? en[key] ?? key, vars),
    [language],
  )

  const value = useMemo(
    () => ({ language, locale: LOCALES[language], setLanguage, t }),
    [language, setLanguage, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
