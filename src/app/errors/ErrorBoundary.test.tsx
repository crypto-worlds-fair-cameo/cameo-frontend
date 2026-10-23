import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/app/i18n/i18n';
import { ErrorBoundary } from './ErrorBoundary';

function BrokenPage(): never {
  throw new Error('render failed');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('shows English when the app language is English', async () => {
    await i18n.changeLanguage('en');
    render(
      <ErrorBoundary scope="page">
        <BrokenPage />
      </ErrorBoundary>
    );
    expect(screen.getByRole('heading', { name: "Couldn't display this page" })).toBeTruthy();
    expect(screen.getByText('Refresh and try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go home' }).getAttribute('href')).toBe('/');
  });
});
