/**
 * @file LanguageSelector.tsx
 * @description Accessible atmospheric language picker supporting English, Hindi, Kannada, Tamil, Telugu, Arabic, Urdu, and Spanish.
 */

import React from 'react';
import { Globe } from 'lucide-react';
import { useI18n } from '../../lib/i18n/I18nContext';
import { LanguageCode } from '../../lib/i18n/types';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, availableLanguages } = useI18n();

  return (
    <div className="relative inline-flex items-center">
      <label htmlFor="vayu-language-select" className="sr-only">
        Select Language
      </label>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 transition-colors focus-within:ring-2 focus-within:ring-cyan-500/50">
        <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
        <select
          id="vayu-language-select"
          aria-label="Select Application Language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          className="bg-transparent border-none text-slate-200 text-xs font-medium focus:outline-none cursor-pointer pr-1"
        >
          {availableLanguages.map((lang) => (
            <option key={lang.code} value={lang.code} className="bg-slate-950 text-slate-200 py-1">
              {lang.nativeName} ({lang.label})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
