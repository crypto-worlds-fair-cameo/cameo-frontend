import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const registry = vi.hoisted(() => {
  const listeners = { register: new Set<() => void>(), unregister: new Set<() => void>() };
  return { wallets: [] as unknown[], listeners };
});
vi.mock('@wallet-standard/app', () => ({
  getWallets: () => ({
    get: () => registry.wallets,
    on: (event: 'register' | 'unregister', listener: () => void) => {
      registry.listeners[event].add(listener);
      return () => registry.listeners[event].delete(listener);
    },
  }),
}));

import { useTransactionSigningSupport } from './use-transaction-signing-support';

const address = '11111111111111111111111111111111';
function wallet(withSigning: boolean) {
  let change: (() => void) | undefined;
  const account = {
    address,
    publicKey: new Uint8Array(32),
    chains: ['solana:devnet'],
    features: ['solana:signTransaction'],
  };
  const value = {
    name: 'Wallet',
    icon: 'data:image/svg+xml,<svg/>',
    version: '1.0.0',
    chains: ['solana:devnet'],
    accounts: [account],
    features: {
      'standard:events': {
        version: '1.0.0',
        on: (_event: string, listener: () => void) => {
          change = listener;
          return () => {
            change = undefined;
          };
        },
      },
      ...(withSigning
        ? {
            'solana:signTransaction': {
              version: '1.0.0',
              supportedTransactionVersions: ['legacy'],
              signTransaction: vi.fn(),
            },
          }
        : {}),
    },
  };
  return { value, emitChange: () => change?.() };
}

describe('useTransactionSigningSupport', () => {
  it('refreshes support when wallets register and when an account-change event fires', () => {
    const unsupported = wallet(false);
    registry.wallets = [unsupported.value];
    const hook = renderHook(() => useTransactionSigningSupport(address, 'devnet'));
    expect(hook.result.current).toEqual({
      supported: false,
      reason: 'SIGN_TRANSACTION_UNSUPPORTED',
    });

    const supported = wallet(true);
    act(() => {
      registry.wallets = [supported.value];
      for (const listener of registry.listeners.register) listener();
    });
    expect(hook.result.current).toEqual({ supported: true });

    act(() => {
      registry.wallets = [];
      supported.emitChange();
    });
    expect(hook.result.current).toEqual({ supported: false, reason: 'ACCOUNT_NOT_FOUND' });
  });
});
