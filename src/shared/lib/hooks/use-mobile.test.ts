import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useIsMobile } from './use-mobile';

it('tracks breakpoint changes and unsubscribes on unmount', () => {
    let matches = false;
    const listeners = new Set<() => void>();
    vi.spyOn(window, 'matchMedia').mockImplementation((media) => ({
        media,
        get matches() { return matches; },
        onchange: null,
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
            listeners.add(listener as () => void);
        },
        removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
            listeners.delete(listener as () => void);
        },
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
    const { result, unmount } = renderHook(useIsMobile);
    expect(result.current).toBe(false);
    act(() => {
        matches = true;
        listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe(true);
    act(() => {
        matches = false;
        listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe(false);
    unmount();
    expect(listeners.size).toBe(0);
});
