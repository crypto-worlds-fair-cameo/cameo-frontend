import { act, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { i18nOptions } from '@/app/i18n/config';
import { menuConfig } from '@/app/menu/Menu.data';
import HeaderNav from './HeaderNav';

describe.each([false, true])('HeaderNav stacked=%s', stacked => {
  it('starts in English and updates menu labels when the language changes', async () => {
    const i18n = createInstance();
    await i18n.init(i18nOptions);

    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <HeaderNav menuItems={menuConfig} stacked={stacked} />
        </MemoryRouter>
      </I18nextProvider>
    );

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'UI Catalog' }).getAttribute('href')).toBe('/ui');
    expect(screen.getByRole('link', { name: 'Main Canvas' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Season Canvas' }).getAttribute('href')).toBe(
      '/season-canvas'
    );

    await act(() => i18n.changeLanguage('ko'));

    expect(screen.getByRole('navigation', { name: '주 메뉴' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '공통 UI' }).getAttribute('href')).toBe('/ui');
    expect(screen.getByRole('link', { name: '메인 캔버스' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: '시즌 캔버스' }).getAttribute('href')).toBe(
      '/season-canvas'
    );
  });
});
