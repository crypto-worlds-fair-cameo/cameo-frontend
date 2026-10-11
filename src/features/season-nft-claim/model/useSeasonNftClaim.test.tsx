import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionMutationKey, sessionQueryKey, type AuthenticatedSession } from '@/entities/session';
import { claimQueryKeys } from '../api/season-nft.queries';
import {
  SeasonNftRequestError,
  type ClaimAttemptView,
  type SeasonNftView,
} from '../api/season-nft.types';
import { useSeasonNftClaim } from './useSeasonNftClaim';

const api = vi.hoisted(() => ({
  getSeasonNft: vi.fn(),
  getClaimAttempt: vi.fn(),
  createClaimAttempt: vi.fn(),
  submitClaimTransaction: vi.fn(),
}));
const wallet = vi.hoisted(() => ({ signSolanaTransaction: vi.fn(), support: vi.fn() }));
vi.mock('../api/season-nft.api', () => api);
vi.mock('@/shared/lib/solana-wallet/sign-transaction', () => ({
  signSolanaTransaction: wallet.signSolanaTransaction,
}));
vi.mock('@/shared/lib/solana-wallet/use-transaction-signing-support', () => ({
  useTransactionSigningSupport: wallet.support,
}));

const seasonId = '11111111-1111-4111-8111-111111111111';
const attemptId = '22222222-2222-4222-8222-222222222222';
const transactionId = '33333333-3333-4333-8333-333333333333';
const address = '11111111111111111111111111111111';

function session(
  userId = 'user-a',
  walletAddress = address,
  absoluteExpiresAt = '2026-10-11T00:00:00.000Z'
): AuthenticatedSession {
  return {
    user: {
      id: userId,
      displayName: null,
      avatarUrl: null,
      wallets: [{ chainNamespace: 'solana', address: walletAddress }],
    },
    activeWallet: { id: `wallet-${userId}`, chainNamespace: 'solana', address: walletAddress },
    session: {
      expiresAt: '2026-10-10T01:00:00.000Z',
      absoluteExpiresAt,
    },
  };
}

function view(
  activeAttemptId: string | null = attemptId,
  network: SeasonNftView['network'] = 'devnet'
): SeasonNftView {
  return {
    seasonId,
    network,
    availability: 'READY',
    reason: null,
    name: 'Season NFT',
    imageUrl: `https://arweave.net/${'A'.repeat(43)}`,
    metadataUri: `https://arweave.net/${'B'.repeat(43)}`,
    eligibleCount: 2,
    claim: {
      eligibility: 'ELIGIBLE',
      state: 'PROCESSING',
      walletAddress: address,
      activeAttemptId,
      assetAddress: null,
      signature: null,
      receiptState: 'NONE',
      claimedAt: null,
    },
  };
}

function attempt(
  step: ClaimAttemptView['step'] = 'ALLOWLIST_PROOF',
  currentTransactionId = transactionId,
  currentAttemptId = attemptId
): ClaimAttemptView {
  return {
    attemptId: currentAttemptId,
    state: 'AWAITING_SIGNATURE',
    step,
    walletAddress: address,
    network: 'devnet',
    transaction: {
      transactionId: currentTransactionId,
      serializedTransactionBase64: step === 'MINT' ? 'Ag==' : 'AQ==',
      lastValidBlockHeight: '500',
      estimatedCostLamports: '1000',
      estimatedAt: '2026-10-10T00:00:00.000Z',
    },
    errorCode: null,
    retryable: false,
  };
}

function setup(initialSeasonId = seasonId) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(sessionQueryKey, session());
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    ({ currentSeasonId }) => useSeasonNftClaim({ seasonId: currentSeasonId, source: 'detail' }),
    { wrapper, initialProps: { currentSeasonId: initialSeasonId } }
  );
  return { client, hook };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getSeasonNft.mockResolvedValue(view());
  api.getClaimAttempt.mockResolvedValue(attempt());
  api.createClaimAttempt.mockResolvedValue({ attemptId, state: 'QUEUED' });
  api.submitClaimTransaction.mockResolvedValue({
    attemptId,
    state: 'SUBMITTING',
    signature: '4'.repeat(64),
  });
  wallet.support.mockReturnValue({ supported: true });
  wallet.signSolanaTransaction.mockResolvedValue('AQI=');
});

describe('season NFT claim interaction', () => {
  it('keeps a profile summary idle and refreshes detail before creating a claim', async () => {
    const summary = view(null);
    const { network, availability, reason, claim } = summary;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(sessionQueryKey, session());
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = renderHook(
      () =>
        useSeasonNftClaim({
          seasonId,
          source: 'profile',
          initialSummary: { network, availability, reason, claim },
        }),
      { wrapper }
    );
    await act(async () => Promise.resolve());
    expect(api.getSeasonNft).not.toHaveBeenCalled();
    await act(async () => {
      await hook.result.current.startClaim();
    });
    expect(api.getSeasonNft.mock.invocationCallOrder[0]).toBeLessThan(
      api.createClaimAttempt.mock.invocationCallOrder[0]!
    );
  });

  it('never opens the wallet from polling and one concurrent click creates one prompt', async () => {
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt?.state).toBe('AWAITING_SIGNATURE'));
    expect(wallet.signSolanaTransaction).not.toHaveBeenCalled();

    await act(async () => {
      await Promise.all([hook.result.current.sign(), hook.result.current.sign()]);
    });
    expect(wallet.signSolanaTransaction).toHaveBeenCalledTimes(1);
    expect(api.submitClaimTransaction).toHaveBeenCalledTimes(1);
  });

  it('shows signing busy immediately while the wallet promise is pending', async () => {
    let resolveSignature!: (value: string) => void;
    wallet.signSolanaTransaction.mockImplementation(
      () =>
        new Promise<string>(resolve => {
          resolveSignature = resolve;
        })
    );
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt?.state).toBe('AWAITING_SIGNATURE'));
    let signing!: Promise<void>;
    act(() => {
      signing = hook.result.current.sign();
    });
    expect(hook.result.current.isSigning).toBe(true);
    await act(async () => {
      resolveSignature('AQI=');
      await signing;
    });
    expect(hook.result.current.isSigning).toBe(false);
  });

  it('discards a wallet result when the authenticated user changes before it returns', async () => {
    let resolveSignature!: (value: string) => void;
    wallet.signSolanaTransaction.mockImplementation(
      () =>
        new Promise<string>(resolve => {
          resolveSignature = resolve;
        })
    );
    const { client, hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt?.state).toBe('AWAITING_SIGNATURE'));
    let signing!: Promise<void>;
    act(() => {
      signing = hook.result.current.sign();
    });
    await waitFor(() => expect(wallet.signSolanaTransaction).toHaveBeenCalledTimes(1));

    await act(async () => {
      client.setQueryData(sessionQueryKey, session('user-b', '22222222222222222222222222222222'));
      resolveSignature('AQI=');
      await signing;
    });
    expect(api.submitClaimTransaction).not.toHaveBeenCalled();
  });

  it('discards a pending wallet result after a session mutation fails with the same cached session', async () => {
    let resolveSignature!: (value: string) => void;
    wallet.signSolanaTransaction.mockImplementation(
      () =>
        new Promise<string>(resolve => {
          resolveSignature = resolve;
        })
    );
    const { client, hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt?.state).toBe('AWAITING_SIGNATURE'));
    let signing!: Promise<void>;
    act(() => {
      signing = hook.result.current.sign();
    });
    await waitFor(() => expect(wallet.signSolanaTransaction).toHaveBeenCalledTimes(1));

    let rejectSessionChange!: (reason: Error) => void;
    const mutation = client.getMutationCache().build(client, {
      mutationKey: sessionMutationKey,
      mutationFn: () =>
        new Promise<void>((_resolve, reject) => {
          rejectSessionChange = reject;
        }),
    });
    let sessionChange!: Promise<void>;
    act(() => {
      sessionChange = mutation.execute(undefined);
    });
    await waitFor(() => expect(client.isMutating({ mutationKey: sessionMutationKey })).toBe(1));
    await act(async () => {
      rejectSessionChange(new Error('logout failed'));
      await expect(sessionChange).rejects.toThrow('logout failed');
    });
    expect(client.getQueryData(sessionQueryKey)).toEqual(session());

    await act(async () => {
      resolveSignature('AQI=');
      await signing;
    });
    expect(api.submitClaimTransaction).not.toHaveBeenCalled();
  });

  it('does not open the wallet when a session mutation starts before React rerenders', async () => {
    const { client, hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt?.state).toBe('AWAITING_SIGNATURE'));
    let finishSessionChange!: () => void;
    const mutation = client.getMutationCache().build(client, {
      mutationKey: sessionMutationKey,
      mutationFn: () =>
        new Promise<void>(resolve => {
          finishSessionChange = resolve;
        }),
    });
    let sessionChange!: Promise<void>;
    let signing!: Promise<void>;

    act(() => {
      sessionChange = mutation.execute(undefined);
      signing = hook.result.current.sign();
    });

    expect(wallet.signSolanaTransaction).not.toHaveBeenCalled();
    await waitFor(() => expect(finishSessionChange).toBeTypeOf('function'));
    await act(async () => {
      finishSessionChange();
      await Promise.all([sessionChange, signing]);
    });
  });

  it.each([
    ['status', new SeasonNftRequestError('signed out', 'business', 401)],
    [
      'attempt',
      new SeasonNftRequestError('user unavailable', 'business', 403, 'AUTH_USER_UNAVAILABLE'),
    ],
  ] as const)(
    'invalidates the session on a pending %s polling auth rejection',
    async (source, error) => {
      let resolveSignature!: (value: string) => void;
      wallet.signSolanaTransaction.mockImplementation(
        () =>
          new Promise<string>(resolve => {
            resolveSignature = resolve;
          })
      );
      const { client, hook } = setup();
      await waitFor(() => expect(hook.result.current.attempt?.state).toBe('AWAITING_SIGNATURE'));
      let signing!: Promise<void>;
      act(() => {
        signing = hook.result.current.sign();
      });
      await waitFor(() => expect(wallet.signSolanaTransaction).toHaveBeenCalledTimes(1));

      if (source === 'status') {
        api.getSeasonNft.mockRejectedValue(error);
        await act(async () => {
          await hook.result.current.statusQuery.refetch();
        });
      } else {
        api.getClaimAttempt.mockRejectedValue(error);
        await act(async () => {
          await hook.result.current.attemptQuery.refetch();
        });
      }
      await waitFor(() => expect(client.getQueryData(sessionQueryKey)).toBeNull());

      await act(async () => {
        resolveSignature('AQI=');
        await signing;
      });
      expect(api.submitClaimTransaction).not.toHaveBeenCalled();
    }
  );

  it('keeps the session after an ordinary polling 403', async () => {
    const { client, hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt).toBeDefined());
    api.getSeasonNft.mockRejectedValue(
      new SeasonNftRequestError('forbidden', 'business', 403, 'NFT_FORBIDDEN')
    );

    await act(async () => {
      await hook.result.current.statusQuery.refetch();
    });

    expect(client.getQueryData(sessionQueryKey)).toEqual(session());
  });

  it('does not let an old-user polling rejection clear a replacement session', async () => {
    let rejectStatus!: (reason: Error) => void;
    api.getSeasonNft.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectStatus = reject;
        })
    );
    const { client } = setup();
    await waitFor(() => expect(api.getSeasonNft).toHaveBeenCalledTimes(1));
    const replacement = session('user-b', '22222222222222222222222222222222');

    await act(async () => {
      client.setQueryData(sessionQueryKey, replacement);
      rejectStatus(new SeasonNftRequestError('signed out', 'business', 401));
      await Promise.resolve();
    });

    expect(client.getQueryData(sessionQueryKey)).toEqual(replacement);
  });

  it('does not reuse a retained polling 401 after the same wallet logs in again', async () => {
    const { client, hook } = setup();
    await waitFor(() => expect(hook.result.current.statusQuery.data).toEqual(view()));
    api.getSeasonNft.mockRejectedValueOnce(
      new SeasonNftRequestError('signed out', 'business', 401)
    );
    await act(async () => {
      await hook.result.current.statusQuery.refetch();
    });
    await waitFor(() => expect(client.getQueryData(sessionQueryKey)).toBeNull());

    let resolveFreshStatus!: (value: SeasonNftView) => void;
    api.getSeasonNft.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveFreshStatus = resolve;
        })
    );
    const replacement = session('user-a', address, '2026-10-12T00:00:00.000Z');
    const login = client.getMutationCache().build(client, {
      mutationKey: sessionMutationKey,
      mutationFn: async () => replacement,
      onSuccess: nextSession => client.setQueryData(sessionQueryKey, nextSession),
    });
    await act(async () => {
      await login.execute(undefined);
    });
    await waitFor(() => expect(api.getSeasonNft).toHaveBeenCalledTimes(3));

    expect(client.getQueryData(sessionQueryKey)).toEqual(replacement);
    await act(async () => {
      resolveFreshStatus(view());
      await Promise.resolve();
    });
    await waitFor(() => expect(hook.result.current.statusQuery.data).toEqual(view()));
    expect(client.getQueryData(sessionQueryKey)).toEqual(replacement);

    api.getSeasonNft.mockRejectedValueOnce(
      new SeasonNftRequestError('new session expired', 'business', 401)
    );
    await act(async () => {
      await hook.result.current.statusQuery.refetch();
    });

    await waitFor(() => expect(client.getQueryData(sessionQueryKey)).toBeNull());
  });

  it('removes an old pending poll synchronously when a same-wallet login starts', async () => {
    const { client, hook } = setup();
    await waitFor(() => expect(hook.result.current.statusQuery.data).toEqual(view()));
    let rejectOldPoll!: (reason: Error) => void;
    api.getSeasonNft.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectOldPoll = reject;
        })
    );
    let oldPoll!: ReturnType<typeof hook.result.current.statusQuery.refetch>;
    act(() => {
      oldPoll = hook.result.current.statusQuery.refetch();
    });
    await waitFor(() => expect(api.getSeasonNft).toHaveBeenCalledTimes(2));

    let resolveFreshPoll!: (value: SeasonNftView) => void;
    api.getSeasonNft.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveFreshPoll = resolve;
        })
    );
    const replacement = session('user-a', address, '2026-10-12T00:00:00.000Z');
    let finishLogin!: () => void;
    const login = client.getMutationCache().build(client, {
      mutationKey: sessionMutationKey,
      mutationFn: () =>
        new Promise<AuthenticatedSession>(resolve => {
          finishLogin = () => resolve(replacement);
        }),
      onSuccess: nextSession => client.setQueryData(sessionQueryKey, nextSession),
    });
    let loginRequest!: Promise<AuthenticatedSession>;
    act(() => {
      loginRequest = login.execute(undefined);
    });

    expect(client.getQueryState(claimQueryKeys.status('user-a', seasonId))).toBeUndefined();
    await waitFor(() => expect(finishLogin).toBeTypeOf('function'));

    await act(async () => {
      rejectOldPoll(new SeasonNftRequestError('old session expired', 'business', 401));
      await oldPoll;
      finishLogin();
      await loginRequest;
    });

    expect(client.getQueryData(sessionQueryKey)).toEqual(replacement);
    if (resolveFreshPoll) {
      await act(async () => {
        resolveFreshPoll(view());
        await Promise.resolve();
      });
    }
  });

  it('requires a new explicit click when proof polling advances to mint', async () => {
    const { client, hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt?.step).toBe('ALLOWLIST_PROOF'));
    await act(async () => {
      await hook.result.current.sign();
    });
    expect(wallet.signSolanaTransaction).toHaveBeenCalledTimes(1);

    act(() => {
      client.setQueryData(
        claimQueryKeys.attempt('user-a', 'devnet', seasonId, attemptId),
        attempt('MINT', '44444444-4444-4444-8444-444444444444')
      );
    });
    await waitFor(() => expect(hook.result.current.attempt?.step).toBe('MINT'));
    expect(wallet.signSolanaTransaction).toHaveBeenCalledTimes(1);
    await act(async () => {
      await hook.result.current.sign();
    });
    expect(wallet.signSolanaTransaction).toHaveBeenCalledTimes(2);
  });

  it('discards a pending wallet result when the season changes in the same session', async () => {
    let resolveSignature!: (value: string) => void;
    wallet.signSolanaTransaction.mockImplementation(
      () =>
        new Promise<string>(resolve => {
          resolveSignature = resolve;
        })
    );
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt).toBeDefined());
    let signing!: Promise<void>;
    act(() => {
      signing = hook.result.current.sign();
    });
    act(() => {
      hook.rerender({ currentSeasonId: '55555555-5555-4555-8555-555555555555' });
    });
    await act(async () => {
      resolveSignature('AQI=');
      await signing;
    });
    expect(api.submitClaimTransaction).not.toHaveBeenCalled();
  });

  it('discards a pending wallet result when the NFT network changes', async () => {
    let resolveSignature!: (value: string) => void;
    wallet.signSolanaTransaction.mockImplementation(
      () =>
        new Promise<string>(resolve => {
          resolveSignature = resolve;
        })
    );
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt).toBeDefined());
    let signing!: Promise<void>;
    act(() => {
      signing = hook.result.current.sign();
    });
    api.getSeasonNft.mockResolvedValue(view(attemptId, 'mainnet-beta'));
    await act(async () => {
      await hook.result.current.statusQuery.refetch();
    });
    await waitFor(() => expect(hook.result.current.view?.network).toBe('mainnet-beta'));
    await act(async () => {
      resolveSignature('AQI=');
      await signing;
    });
    expect(api.submitClaimTransaction).not.toHaveBeenCalled();
  });

  it('discards a pending wallet result after unmount', async () => {
    let resolveSignature!: (value: string) => void;
    wallet.signSolanaTransaction.mockImplementation(
      () =>
        new Promise<string>(resolve => {
          resolveSignature = resolve;
        })
    );
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt).toBeDefined());
    let signing!: Promise<void>;
    act(() => {
      signing = hook.result.current.sign();
    });
    hook.unmount();
    resolveSignature('AQI=');
    await signing;
    expect(api.submitClaimTransaction).not.toHaveBeenCalled();
  });

  it('drops a late create response after the season changes', async () => {
    let resolveCreate!: (value: { attemptId: string; state: 'QUEUED' }) => void;
    api.createClaimAttempt.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveCreate = resolve;
        })
    );
    const { hook } = setup();
    let starting!: Promise<void>;
    act(() => {
      starting = hook.result.current.startClaim();
    });
    await waitFor(() => expect(api.createClaimAttempt).toHaveBeenCalledTimes(1));
    act(() => {
      hook.rerender({ currentSeasonId: '55555555-5555-4555-8555-555555555555' });
    });
    await act(async () => {
      resolveCreate({ attemptId, state: 'QUEUED' });
      await starting;
    });
    expect(hook.result.current.attempt).toBeUndefined();
  });

  it('allows only one claim start while the preflight request is pending', async () => {
    let resolveDetail!: (value: SeasonNftView) => void;
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.view).toBeDefined());
    api.getSeasonNft.mockClear();
    api.getSeasonNft.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveDetail = resolve;
        })
    );
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = hook.result.current.startClaim();
      second = hook.result.current.startClaim();
    });
    expect(first).toBe(second);
    expect(api.getSeasonNft).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveDetail(view());
      await Promise.all([first, second]);
    });
    expect(api.createClaimAttempt).toHaveBeenCalledTimes(1);
  });

  it('treats an authoritative null status as newer than a stale profile attempt', async () => {
    const summary = view(attemptId);
    const { network, availability, reason, claim } = summary;
    api.getSeasonNft.mockResolvedValue(view(null));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(sessionQueryKey, session());
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = renderHook(
      () =>
        useSeasonNftClaim({
          seasonId,
          source: 'profile',
          initialSummary: { network, availability, reason, claim },
        }),
      { wrapper }
    );

    await waitFor(() => expect(hook.result.current.statusQuery.data).toEqual(view(null)));
    await waitFor(() => expect(hook.result.current.attempt).toBeUndefined());
  });

  it('replaces a local attempt when a newer status reports another active attempt', async () => {
    const replacementAttemptId = '55555555-5555-4555-8555-555555555555';
    api.getSeasonNft.mockResolvedValue(view(null));
    api.getClaimAttempt.mockImplementation((_seasonId: string, requestedAttemptId: string) =>
      Promise.resolve(
        attempt(
          'ALLOWLIST_PROOF',
          requestedAttemptId === replacementAttemptId
            ? '66666666-6666-4666-8666-666666666666'
            : transactionId,
          requestedAttemptId
        )
      )
    );
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.statusQuery.data).toEqual(view(null)));
    await act(async () => {
      await hook.result.current.startClaim();
    });
    await waitFor(() => expect(hook.result.current.attempt?.attemptId).toBe(attemptId));

    api.getSeasonNft.mockResolvedValue(view(replacementAttemptId));
    await act(async () => {
      await hook.result.current.statusQuery.refetch();
    });

    await waitFor(() => expect(hook.result.current.attempt?.attemptId).toBe(replacementAttemptId));
  });

  it('keeps a created attempt when an older in-flight status response returns later', async () => {
    let resolveStaleStatus!: (value: SeasonNftView) => void;
    api.getSeasonNft
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveStaleStatus = resolve;
          })
      )
      .mockResolvedValue(view(null));
    const { hook } = setup();
    await waitFor(() => expect(api.getSeasonNft).toHaveBeenCalledTimes(1));

    await act(async () => {
      await hook.result.current.startClaim();
    });
    await waitFor(() => expect(hook.result.current.attempt?.attemptId).toBe(attemptId));

    await act(async () => {
      resolveStaleStatus(view(null));
      await Promise.resolve();
    });

    expect(hook.result.current.attempt?.attemptId).toBe(attemptId);
  });

  it('surfaces a detail preflight failure without rejecting the click handler', async () => {
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.view).toBeDefined());
    api.getSeasonNft.mockRejectedValueOnce(new Error('offline'));

    await act(async () => {
      await expect(hook.result.current.startClaim()).resolves.toBeUndefined();
    });
    expect(hook.result.current.startError).toMatchObject({ message: 'offline' });
    expect(api.createClaimAttempt).not.toHaveBeenCalled();
  });

  it('clears submit busy state when the season changes during a pending submit', async () => {
    let resolveSubmit!: (value: {
      attemptId: string;
      state: 'SUBMITTING';
      signature: string;
    }) => void;
    api.submitClaimTransaction.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveSubmit = resolve;
        })
    );
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt).toBeDefined());
    let signing!: Promise<void>;
    act(() => {
      signing = hook.result.current.sign();
    });
    await waitFor(() => expect(api.submitClaimTransaction).toHaveBeenCalledTimes(1));
    act(() => {
      hook.rerender({ currentSeasonId: '55555555-5555-4555-8555-555555555555' });
    });
    await waitFor(() => expect(hook.result.current.isSigning).toBe(false));
    resolveSubmit({ attemptId, state: 'SUBMITTING', signature: '4'.repeat(64) });
    await signing;
  });

  it('keeps an ambiguous submit gated until both authoritative refreshes succeed', async () => {
    api.submitClaimTransaction.mockRejectedValueOnce(
      new SeasonNftRequestError('response lost', 'transport')
    );
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt).toBeDefined());
    await act(async () => {
      await hook.result.current.sign();
    });
    expect(hook.result.current.submitError).toBeInstanceOf(SeasonNftRequestError);

    let resolveStatus!: (value: SeasonNftView) => void;
    let resolveAttempt!: (value: ClaimAttemptView) => void;
    api.getSeasonNft.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveStatus = resolve;
        })
    );
    api.getClaimAttempt.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveAttempt = resolve;
        })
    );
    let refreshing!: Promise<void>;
    act(() => {
      refreshing = hook.result.current.refreshAfterError();
    });
    expect(hook.result.current.isRefreshingError).toBe(true);
    expect(hook.result.current.submitError).toBeInstanceOf(SeasonNftRequestError);
    await act(async () => {
      resolveStatus(view());
      resolveAttempt(attempt());
      await refreshing;
    });
    expect(hook.result.current.submitError).toBeNull();
    expect(hook.result.current.isRefreshingError).toBe(false);
  });

  it('retains the uncertainty gate when an authoritative refresh fails', async () => {
    api.submitClaimTransaction.mockRejectedValueOnce(
      new SeasonNftRequestError('response lost', 'transport')
    );
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.attempt).toBeDefined());
    await act(async () => {
      await hook.result.current.sign();
    });
    api.getSeasonNft.mockRejectedValue(new Error('offline'));
    api.getClaimAttempt.mockRejectedValue(new Error('offline'));

    await act(async () => {
      await hook.result.current.refreshAfterError();
    });
    expect(hook.result.current.submitError).toBeInstanceOf(SeasonNftRequestError);
    expect(hook.result.current.isRefreshingError).toBe(false);
  }, 10_000);
});
