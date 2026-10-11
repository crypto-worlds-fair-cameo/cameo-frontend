import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { sessionQueryKey } from '@/entities/session';
import { authenticateWallet } from './wallet-auth.api';
import { useLoginMutation } from './wallet-auth.mutations';

vi.mock('./wallet-auth.api', () => ({
  authenticateWallet: vi.fn(),
  logout: vi.fn(),
  setDisplayName: vi.fn(),
}));

describe('useLoginMutation', () => {
  it('caches the wallet that authenticated the session', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const response = {
      user: {
        id: 'user-1',
        displayName: 'GAEMI',
        avatarUrl: null,
        wallets: [
          { chainNamespace: 'solana', address: 'FirstWallet1111' },
          { chainNamespace: 'solana', address: 'ActiveWallet2222' },
        ],
      },
      activeWallet: {
        id: 'wallet-2',
        chainNamespace: 'solana' as const,
        address: 'ActiveWallet2222',
      },
      session: {
        expiresAt: '2026-10-08T00:00:00Z',
        absoluteExpiresAt: '2026-10-14T00:00:00Z',
      },
      isNewUser: false,
    };
    vi.mocked(authenticateWallet).mockResolvedValue(response);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useLoginMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('Test Wallet');
    });

    expect(queryClient.getQueryData(sessionQueryKey)).toEqual({
      user: response.user,
      activeWallet: response.activeWallet,
      session: response.session,
    });
  });
});
