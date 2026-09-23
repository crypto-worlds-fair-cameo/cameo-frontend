import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigationType } from 'react-router';

type Position = { top: number; left: number };
const MAX_ENTRIES = 100;
const SCROLL_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'PageUp',
    'PageDown',
    'Home',
    'End',
    ' ',
]);

/** Layout owns the scroll surface; pages do not need to know which preset is active. */
export function useRouteScroll(mode: 'web' | 'mobile', mainRef: RefObject<HTMLElement | null>) {
    const { key } = useLocation();
    const navigationType = useNavigationType();
    const positions = useRef(new Map<string, Position>());
    const initialEntry = useRef(true);

    useLayoutEffect(() => {
        const previous = window.history.scrollRestoration;
        window.history.scrollRestoration = 'manual';
        return () => {
            window.history.scrollRestoration = previous;
        };
    }, []);

    useLayoutEffect(() => {
        const main = mainRef.current;
        if (!main) return;
        const owner = mode === 'mobile' ? main : window;
        const read = (): Position =>
            mode === 'mobile'
                ? { top: main.scrollTop, left: main.scrollLeft }
                : { top: window.scrollY, left: window.scrollX };
        const remember = () => {
            const cache = positions.current;
            cache.delete(key);
            cache.set(key, read());
            if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
        };
        const target =
            navigationType === 'POP'
                ? (positions.current.get(key) ??
                  (initialEntry.current ? undefined : { top: 0, left: 0 }))
                : { top: 0, left: 0 };
        initialEntry.current = false;
        let pending = Boolean(target);
        let resizeObserver: ResizeObserver | undefined;
        let mutationObserver: MutationObserver | undefined;

        const stopRestoring = () => {
            pending = false;
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
            owner.removeEventListener('wheel', cancel);
            owner.removeEventListener('touchstart', cancel);
            owner.removeEventListener('pointerdown', cancel);
            window.removeEventListener('keydown', onKeyDown);
        };
        const cancel = () => {
            stopRestoring();
            remember();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (SCROLL_KEYS.has(event.key)) cancel();
        };
        const restore = () => {
            if (!pending || !target) return;
            // "instant" also overrides a project's CSS scroll-behavior: smooth.
            owner.scrollTo({ ...target, behavior: 'instant' });
            const current = read();
            if (
                Math.abs(current.top - target.top) < 1 &&
                Math.abs(current.left - target.left) < 1
            ) {
                stopRestoring();
                remember();
            }
        };
        const onScroll = () => {
            if (!pending) remember();
        };
        owner.addEventListener('scroll', onScroll, { passive: true });

        if (target) {
            // A Suspense fallback may be too short. Retry when real content mounts/grows,
            // until restoration succeeds, the user takes control, or navigation changes.
            resizeObserver = new ResizeObserver(restore);
            const observeContent = () => {
                resizeObserver?.disconnect();
                resizeObserver?.observe(main);
                if (main.firstElementChild) resizeObserver?.observe(main.firstElementChild);
                if (mode === 'web') resizeObserver?.observe(document.documentElement);
            };
            mutationObserver = new MutationObserver(() => {
                if (!pending) return;
                observeContent();
                restore();
            });
            observeContent();
            mutationObserver.observe(main, { childList: true, subtree: true });
            owner.addEventListener('wheel', cancel, { passive: true });
            owner.addEventListener('touchstart', cancel, { passive: true });
            owner.addEventListener('pointerdown', cancel, { passive: true });
            window.addEventListener('keydown', onKeyDown);
            restore();
        } else {
            // Preserve the browser's position on the initial POP/reload.
            remember();
        }

        return () => {
            // Scroll events retain the old entry before React replaces/clamps its DOM.
            // Do not overwrite a pending target with a short fallback's clamped position.
            stopRestoring();
            owner.removeEventListener('scroll', onScroll);
        };
    }, [key, navigationType, mode, mainRef]);
}
