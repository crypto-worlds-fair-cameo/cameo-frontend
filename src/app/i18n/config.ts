import type { InitOptions } from 'i18next';
import commonKo from '@/shared/i18n/locales/ko.json';
import commonEn from '@/shared/i18n/locales/en.json';
import notFoundKo from '@/pages/not-found/config/locales/ko.json';
import notFoundEn from '@/pages/not-found/config/locales/en.json';
import walletKo from '../layout/header/config/locales/ko.json';
import walletEn from '../layout/header/config/locales/en.json';
import navigationKo from '../menu/config/locales/ko.json';
import navigationEn from '../menu/config/locales/en.json';
import mainCanvasKo from '@/pages/main-canvas/config/locales/ko.json';
import mainCanvasEn from '@/pages/main-canvas/config/locales/en.json';
import seasonCanvasKo from '@/pages/season-canvas/config/locales/ko.json';
import seasonCanvasEn from '@/pages/season-canvas/config/locales/en.json';
import profileKo from '@/pages/profile/config/locales/ko.json';
import profileEn from '@/pages/profile/config/locales/en.json';

export const languages = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
] as const;
export const languageStorageKey = 'app.language';
export const resources = {
  ko: {
    common: commonKo,
    notFound: notFoundKo,
    wallet: walletKo,
    navigation: navigationKo,
    mainCanvas: mainCanvasKo,
    seasonCanvas: seasonCanvasKo,
    profile: profileKo,
  },
  en: {
    common: commonEn,
    notFound: notFoundEn,
    wallet: walletEn,
    navigation: navigationEn,
    mainCanvas: mainCanvasEn,
    seasonCanvas: seasonCanvasEn,
    profile: profileEn,
  },
};

export const i18nOptions = {
  resources,
  lng: 'en',
  supportedLngs: languages.map(({ code }) => code),
  fallbackLng: 'en',
  load: 'languageOnly',
  defaultNS: 'common',
  ns: ['common', 'notFound', 'wallet', 'navigation', 'mainCanvas', 'seasonCanvas', 'profile'],
  initAsync: false,
  interpolation: { escapeValue: false },
  detection: {
    order: ['savedLanguage'],
    caches: ['savedLanguage'],
  },
} satisfies InitOptions;
