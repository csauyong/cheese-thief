import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { en } from './en'
import { zhTW } from './zh-TW'
import type { DictKey, Dictionary } from './zh-TW'

export type Lang = 'zh-TW' | 'en'

const DICTS: Record<Lang, Dictionary> = { 'zh-TW': zhTW, en }
const HTML_LANG: Record<Lang, string> = { 'zh-TW': 'zh-Hant', en: 'en' }
const STORAGE_KEY = 'cheese-thief:lang'

export type Vars = Record<string, string | number>

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

export interface Translator {
  lang: Lang
  setLang: (lang: Lang) => void
  /** A single line. */
  t: (key: DictKey, vars?: Vars) => string
  /** A list of lines, for the rules pages and discussion prompts. */
  tl: (key: DictKey) => string[]
  /** Joins names the way the current language does. */
  list: (parts: string[]) => string
}

const I18nContext = createContext<Translator | null>(null)

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'zh-TW') return stored
  } catch {
    // Private mode, blocked storage — fall through to the default.
  }
  return 'zh-TW'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang]
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not being able to remember the choice is not worth breaking over.
    }
  }, [])

  const value = useMemo<Translator>(() => {
    const dict = DICTS[lang]
    const t = (key: DictKey, vars?: Vars): string => {
      const entry = dict[key]
      const template = Array.isArray(entry) ? entry.join(' ') : (entry as string)
      return interpolate(template, vars)
    }
    return {
      lang,
      setLang,
      t,
      tl: (key) => {
        const entry = dict[key]
        return Array.isArray(entry) ? [...entry] : [entry as string]
      },
      list: (parts) => parts.join(t('common.and')),
    }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): Translator {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>')
  return ctx
}

export type { DictKey }
