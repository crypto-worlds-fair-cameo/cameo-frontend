import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { useSupportedWallets } from './supported-wallets';

function wallet(name: string, options?: { signIn?: boolean; chains?: string[] }) {
  return {
    name,
    icon: `data:image/svg+xml,<svg data-wallet="${name}"/>`,
    version: '1.0.0',
    chains: options?.chains ?? ['solana:mainnet', 'solana:devnet'],
    accounts: [],
    features: options?.signIn === false ? {} : { 'solana:signIn': { version: '1.0.0' } },
  };
}

beforeEach(() => {
  registry.wallets = [];
  registry.listeners.register.clear();
  registry.listeners.unregister.clear();
});

describe('supported wallets', () => {
  it('lists Phantom, Solflare and Backpack and marks the installed ones with their own icons', () => {
    registry.wallets = [
      wallet('Solflare'),
      // 솔라나 로그인을 지원하지 않거나 솔라나가 아닌 지갑은 설치되지 않은 것으로 본다.
      wallet('Backpack', { signIn: false }),
      wallet('Phantom', { chains: ['ethereum:1'] }),
      wallet('Unknown Wallet'),
    ];
    const { result } = renderHook(() => useSupportedWallets());
    expect(result.current.map(({ name, installed }) => [name, installed])).toEqual([
      ['Phantom', false],
      ['Solflare', true],
      ['Backpack', false],
    ]);
    expect(result.current[1]?.icon).toContain('Solflare');
    expect(result.current[0]?.installUrl).toBe('https://phantom.com/download');
  });

  it('notices a wallet extension that registers after the page opened', () => {
    const { result } = renderHook(() => useSupportedWallets());
    expect(result.current.every(option => !option.installed)).toBe(true);

    registry.wallets = [wallet('Backpack')];
    act(() => {
      for (const listener of registry.listeners.register) listener();
    });
    expect(result.current.find(option => option.name === 'Backpack')?.installed).toBe(true);
  });
});
