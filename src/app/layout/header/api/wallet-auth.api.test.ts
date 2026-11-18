import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetWalletChoice, rememberedWalletName } from '@/shared/lib/solana-wallet/wallet-choice';

const http = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/shared/api/http-client', () => ({ axiosInstance: { post: http.post } }));
vi.mock('../lib/wallet-standard', () => ({
  getWalletForSignIn: (name: string) => ({ name }),
  signInWithWallet: async () => ({ address, signedMessage: 'bWVzc2FnZQ==', signature: 'c2ln' }),
}));

import { authenticateWallet } from './wallet-auth.api';

const address = 'BhBXZAzWGGx2wZCwbkDC9NDQh5NBreTJ3TvDe2GNW1aD';

afterEach(() => {
  http.post.mockReset();
  forgetWalletChoice();
});

describe('wallet sign-in', () => {
  it('remembers the wallet only after the server accepts the sign-in', async () => {
    http.post.mockResolvedValueOnce({
      data: { data: { challengeId: 'challenge-1', signInInput: {} } },
    });
    http.post.mockRejectedValueOnce(new Error('signature rejected'));
    await expect(authenticateWallet('Backpack')).rejects.toThrow('signature rejected');
    expect(rememberedWalletName(address)).toBeUndefined();

    http.post.mockResolvedValueOnce({
      data: { data: { challengeId: 'challenge-2', signInInput: {} } },
    });
    http.post.mockResolvedValueOnce({
      data: { data: { activeWallet: { address }, isNewUser: false } },
    });
    await authenticateWallet('Backpack');
    expect(rememberedWalletName(address)).toBe('Backpack');
  });
});
