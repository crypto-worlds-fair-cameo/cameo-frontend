import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRouteScroll } from './useRouteScroll';

const route = vi.hoisted(() => ({ key: 'a', action: 'POP' }));
vi.mock('react-router', () => ({
  useLocation: () => ({ key: route.key }),
  useNavigationType: () => route.action,
}));

let resize: () => void;
let disconnect: ReturnType<typeof vi.fn>;
let maxScroll: number;
let main: HTMLElement;

beforeEach(() => {
  route.key = 'a';
  route.action = 'POP';
  maxScroll = 2000;
  main = document.createElement('main');
  main.append(document.createElement('div'));
  document.body.append(main);
  main.scrollTo = vi.fn((input?: ScrollToOptions | number, y?: number) => {
    const options = typeof input === 'number' ? { left: input, top: y } : input;
    main.scrollTop = Math.min(options?.top ?? 0, maxScroll);
    main.scrollLeft = options?.left ?? 0;
  });
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  Object.defineProperty(window, 'scrollX', { value: 0, writable: true, configurable: true });
  vi.spyOn(window, 'scrollTo').mockImplementation(
    (input?: ScrollToOptions | number, y?: number) => {
      const options = typeof input === 'number' ? { left: input, top: y } : input;
      Object.defineProperty(window, 'scrollY', {
        value: Math.min(options?.top ?? 0, maxScroll),
        writable: true,
      });
      Object.defineProperty(window, 'scrollX', { value: options?.left ?? 0, writable: true });
    }
  );
  window.history.scrollRestoration = 'auto';
  disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    }
  );
});
afterEach(() => {
  cleanup();
  main.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function move(key: string, action: string, rerender: () => void) {
  route.key = key;
  route.action = action;
  rerender();
}
function scroll(top: number, mode: 'web' | 'mobile') {
  act(() => {
    if (mode === 'mobile') main.scrollTop = top;
    else Object.defineProperty(window, 'scrollY', { value: top, writable: true });
    (mode === 'mobile' ? main : window).dispatchEvent(new Event('scroll'));
  });
}

describe.each(['web', 'mobile'] as const)('%s scroll owner', mode => {
  it('resets new entries and restores separate back/forward entry positions', () => {
    const { rerender } = renderHook(() => useRouteScroll(mode, { current: main }));
    scroll(650, mode);
    move('b', 'PUSH', rerender);
    const position = () => (mode === 'mobile' ? main.scrollTop : window.scrollY);
    expect(position()).toBe(0);
    scroll(300, mode);
    move('a', 'POP', rerender);
    expect(position()).toBe(650);
    move('b', 'POP', rerender);
    expect(position()).toBe(300);
    move('c', 'REPLACE', rerender);
    expect(position()).toBe(0);
    if (mode === 'mobile') expect(window.scrollTo).not.toHaveBeenCalled();
  });
});

it('restores after delayed content grows, and disconnects observers on success', () => {
  const { rerender } = renderHook(() => useRouteScroll('mobile', { current: main }));
  scroll(900, 'mobile');
  move('b', 'PUSH', rerender);
  maxScroll = 50;
  move('a', 'POP', rerender);
  expect(main.scrollTop).toBe(50);
  maxScroll = 2000;
  act(() => resize());
  expect(main.scrollTop).toBe(900);
  expect(disconnect).toHaveBeenCalled();
});

it('user input cancels pending restoration instead of dragging the reader back', () => {
  const { rerender } = renderHook(() => useRouteScroll('mobile', { current: main }));
  scroll(900, 'mobile');
  move('b', 'PUSH', rerender);
  maxScroll = 50;
  move('a', 'POP', rerender);
  main.dispatchEvent(new Event('wheel', { bubbles: true }));
  maxScroll = 2000;
  act(() => resize());
  expect(main.scrollTop).toBe(50);
  expect(disconnect).toHaveBeenCalled();
});

it('preserves initial position and restores native setting and observers on unmount', () => {
  main.scrollTop = 450;
  const { rerender, unmount } = renderHook(() => useRouteScroll('mobile', { current: main }));
  expect(main.scrollTop).toBe(450);
  expect(window.history.scrollRestoration).toBe('manual');
  scroll(900, 'mobile');
  move('b', 'PUSH', rerender);
  maxScroll = 0;
  move('a', 'POP', rerender);
  unmount();
  expect(window.history.scrollRestoration).toBe('auto');
  expect(disconnect).toHaveBeenCalled();
  maxScroll = 2000;
  act(() => resize());
  expect(main.scrollTop).toBe(0);
});

it('retries after lazy content replaces the fallback', async () => {
  const { rerender } = renderHook(() => useRouteScroll('mobile', { current: main }));
  scroll(750, 'mobile');
  move('b', 'PUSH', rerender);
  maxScroll = 0;
  move('a', 'POP', rerender);
  expect(main.scrollTop).toBe(0);
  maxScroll = 2000;
  await act(async () => {
    main.replaceChildren(document.createElement('article'));
  });
  expect(main.scrollTop).toBe(750);
});

it('does not let a previous pending restoration scroll the next page', () => {
  const { rerender } = renderHook(() => useRouteScroll('mobile', { current: main }));
  scroll(700, 'mobile');
  move('b', 'PUSH', rerender);
  maxScroll = 0;
  move('a', 'POP', rerender);
  const staleResize = resize;
  move('c', 'PUSH', rerender);
  maxScroll = 2000;
  act(() => staleResize());
  expect(main.scrollTop).toBe(0);
});

it('bounds saved positions and treats evicted POP entries as uncached', () => {
  const { rerender } = renderHook(() => useRouteScroll('mobile', { current: main }));
  scroll(700, 'mobile');
  for (let index = 0; index < 101; index++) move(`entry-${index}`, 'PUSH', rerender);
  scroll(20, 'mobile');
  move('a', 'POP', rerender);
  expect(main.scrollTop).toBe(0);
});
