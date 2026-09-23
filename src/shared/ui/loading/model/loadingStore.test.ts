import { afterEach, describe, expect, it } from 'vitest';
import { useLoadingStore } from './loadingStore';

afterEach(() => useLoadingStore.setState(useLoadingStore.getInitialState(), true));

describe('global loading ownership', () => {
    it('keeps the overlay active until every concurrent task completes', () => {
        const { show, hide } = useLoadingStore.getState();
        const first = show();
        const second = show();
        hide(first);
        expect(useLoadingStore.getState().isLoading).toBe(true);
        hide(second);
        expect(useLoadingStore.getState().isLoading).toBe(false);
    });
    it('does not let duplicate completion hide a different task', () => {
        const { show, hide } = useLoadingStore.getState();
        const first = show();
        const second = show();
        expect(first).not.toBe(second);
        hide(first);
        hide(first);
        expect(useLoadingStore.getState().isLoading).toBe(true);
        hide(second);
        expect(useLoadingStore.getState().isLoading).toBe(false);
    });
});
