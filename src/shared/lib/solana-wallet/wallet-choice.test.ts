import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  forgetWalletChoice,
  rememberedWalletName,
  rememberWalletChoice,
  useRememberedWalletName,
} from './wallet-choice';

const address = 'BhBXZAzWGGx2wZCwbkDC9NDQh5NBreTJ3TvDe2GNW1aD';

afterEach(() => {
  vi.restoreAllMocks();
  forgetWalletChoice();
});

describe('remembered wallet choice', () => {
  it('remembers the wallet used to sign in for that address only', () => {
    rememberWalletChoice(address, 'Solflare');
    expect(rememberedWalletName(address)).toBe('Solflare');
    expect(rememberedWalletName('another-address')).toBeUndefined();
    expect(rememberedWalletName(undefined)).toBeUndefined();

    forgetWalletChoice();
    expect(rememberedWalletName(address)).toBeUndefined();
  });

  it('keeps the choice for this visit when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    rememberWalletChoice(address, 'Backpack');
    expect(rememberedWalletName(address)).toBe('Backpack');
  });

  it('updates the screen when the wallet is remembered or forgotten', () => {
    const { result } = renderHook(() => useRememberedWalletName(address));
    expect(result.current).toBeUndefined();
    act(() => rememberWalletChoice(address, 'Phantom'));
    expect(result.current).toBe('Phantom');
    act(() => forgetWalletChoice());
    expect(result.current).toBeUndefined();
  });
});
