import type { InitOptions } from 'i18next';
import commonKo from '@/shared/i18n/locales/ko.json';
import commonEn from '@/shared/i18n/locales/en.json';
import notFoundKo from '@/pages/not-found/config/locales/ko.json';
import notFoundEn from '@/pages/not-found/config/locales/en.json';

export const languages = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
] as const;
export const languageStorageKey = 'app.language';
export const resources = {
  ko: { common: commonKo, notFound: notFoundKo },
  en: { common: commonEn, notFound: notFoundEn },
};

export const i18nOptions = {
  resources,
  supportedLngs: languages.map(({ code }) => code),
  fallbackLng: 'ko',
  load: 'languageOnly',
  defaultNS: 'common',
  ns: ['common', 'notFound'],
  initAsync: false,
  interpolation: { escapeValue: false },
  detection: {
    order: ['savedLanguage', 'navigator'],
    caches: ['savedLanguage'],
  },
} satisfies InitOptions;
