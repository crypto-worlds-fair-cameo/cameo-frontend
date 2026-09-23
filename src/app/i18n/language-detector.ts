import LanguageDetector from 'i18next-browser-languagedetector';
import { languageStorageKey } from './config';

export function createLanguageDetector() {
  const detector = new LanguageDetector();
  detector.addDetector({
    name: 'savedLanguage',
    lookup() {
      try {
        return window.localStorage.getItem(languageStorageKey) ?? undefined;
      } catch {
        return undefined;
      }
    },
    cacheUserLanguage(language) {
      try {
        window.localStorage.setItem(languageStorageKey, language);
      } catch {
        // Language switching still works when persistence is unavailable.
      }
    },
  });
  return detector;
}
