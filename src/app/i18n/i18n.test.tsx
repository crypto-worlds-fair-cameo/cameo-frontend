import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { createLanguageDetector } from './language-detector';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import { LanguageSelect } from '../layout/header/LanguageSelect';
import NotFoundPage from '@/pages/not-found/NotFoundPage';
import { i18n } from './i18n';
import { i18nOptions, languageStorageKey, resources } from './config';

it('updates translated UI, document language and saved preference together', async () => {
    render(
        <I18nextProvider i18n={i18n}>
            <MemoryRouter>
                <LanguageSelect />
                <NotFoundPage />
            </MemoryRouter>
        </I18nextProvider>,
    );
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: '언어' }), 'en');
    await waitFor(() => expect(screen.getByRole('heading').textContent).toBe(resources.en.notFound.title));
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem(languageStorageKey)).toBe('en');
    const fresh = createInstance().use(createLanguageDetector());
    await fresh.init(i18nOptions);
    expect(fresh.resolvedLanguage).toBe('en');
});

it.each([
    ['en-US', 'en'],
    ['ko-KR', 'ko'],
    ['fr-FR', 'ko'],
])('detects %s as %s without a saved preference', async (browserLanguage, expected) => {
    localStorage.removeItem(languageStorageKey);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([browserLanguage]);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue(browserLanguage);
    const instance = createInstance().use(createLanguageDetector());
    await instance.init(i18nOptions);
    expect(instance.resolvedLanguage).toBe(expected);
});

it('works when browser storage access is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const instance = createInstance().use(createLanguageDetector());
    await expect(instance.init(i18nOptions)).resolves.toBeDefined();
    await expect(instance.changeLanguage('en')).resolves.toBeDefined();
});

function keys(value: object, prefix = ''): string[] {
    return Object.entries(value).flatMap(([key, entry]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof entry === 'object' && entry !== null ? keys(entry, path) : [path];
    }).sort();
}

it('keeps translation keys aligned between supported languages', () => {
    expect(keys(resources.en)).toEqual(keys(resources.ko));
});
