/**
 * @file i18n/I18nContext.tsx
 * @description React Context and Hook for internationalization in VayuPulse AI.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { LanguageCode, LanguageConfig, Translations } from './types';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from './translations';

interface I18nContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: Translations;
  dir: 'ltr' | 'rtl';
  availableLanguages: readonly LanguageConfig[];
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function getInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem('vayupulse_language');
    if (saved && saved in TRANSLATIONS) {
      return saved as LanguageCode;
    }
  } catch {
    // Ignore storage restrictions
  }
  return 'en';
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);

  const activeConfig =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) ?? SUPPORTED_LANGUAGES[0]!;

  const dir = activeConfig.dir;
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const setLanguage = (newLang: LanguageCode) => {
    if (newLang in TRANSLATIONS) {
      setLanguageState(newLang);
      try {
        window.localStorage.setItem('vayupulse_language', newLang);
      } catch {
        // Ignore storage restrictions
      }
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = dir;
    }
  }, [language, dir]);

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        dir,
        availableLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      <div dir={dir} className="w-full h-full flex flex-col flex-1">
        {children}
      </div>
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback if rendered outside provider (e.g. isolated test)
    return {
      language: 'en',
      setLanguage: () => {},
      t: TRANSLATIONS.en,
      dir: 'ltr',
      availableLanguages: SUPPORTED_LANGUAGES,
    };
  }
  return ctx;
}
