import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { i18n, i18nReady } from '@/app/i18n/i18n';

beforeEach(async () => {
  await i18nReady;
  await i18n.changeLanguage('ko');
});

afterEach(cleanup);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  }),
});

// jsdom has no layout engine. Scroll behavior is exercised with explicit
// dimensions/observer callbacks in useRouteScroll tests and in browser QA.
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: TestResizeObserver,
});
