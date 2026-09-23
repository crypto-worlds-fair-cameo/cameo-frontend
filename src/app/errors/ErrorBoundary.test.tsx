import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function BrokenProvider(): never {
  throw new Error('private provider state');
}
it('renders an app recovery screen even without a router or other providers', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(
    <ErrorBoundary scope="app">
      <BrokenProvider />
    </ErrorBoundary>
  );
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByRole('link', { name: '홈으로 이동' }).getAttribute('href')).toBe('/');
  expect(screen.getByRole('button', { name: '새로고침' })).toBeTruthy();
  expect(screen.queryByText('private provider state')).toBeNull();
});
