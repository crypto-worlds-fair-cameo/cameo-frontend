import { useTranslation } from 'react-i18next';
import { languages } from '@/app/i18n/config';

export function LanguageSelect() {
  const { t, i18n } = useTranslation('common');
  return (
    <select
      aria-label={t('language')}
      value={i18n.resolvedLanguage ?? 'en'}
      onChange={event => {
        void i18n.changeLanguage(event.target.value);
      }}
      className="rounded-md border border-input bg-background px-2 py-2 text-sm"
    >
      {languages.map(({ code, label }) => (
        <option key={code} value={code} lang={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
