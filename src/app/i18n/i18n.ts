import { createInstance } from 'i18next';
import { createLanguageDetector } from './language-detector';
import { initReactI18next } from 'react-i18next';
import { i18nOptions } from './config';

export const i18n = createInstance();

function syncDocumentLanguage() {
  const language = i18n.resolvedLanguage ?? 'ko';
  document.documentElement.lang = language;
  document.documentElement.dir = i18n.dir(language);
}

i18n.on('languageChanged', syncDocumentLanguage);
// Resources are bundled; initialize before the first React render.
export const i18nReady = i18n
  .use(createLanguageDetector())
  .use(initReactI18next)
  .init(i18nOptions)
  .then(syncDocumentLanguage);

if (import.meta.hot) {
  import.meta.hot.dispose(() => i18n.off('languageChanged', syncDocumentLanguage));
}
