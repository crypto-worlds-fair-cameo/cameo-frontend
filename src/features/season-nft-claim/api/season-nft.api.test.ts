import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axiosInstance } from '@/shared/api/http-client';
import {
  createClaimAttempt,
  getClaimAttempt,
  getSeasonNft,
  submitClaimTransaction,
} from './season-nft.api';

vi.mock('@/shared/api/http-client', () => ({
  axiosInstance: { get: vi.fn(), post: vi.fn() },
}));

const claim = {
  eligibility: 'ELIGIBLE',
  state: 'UNCLAIMED',
  walletAddress: '11111111111111111111111111111111',
  activeAttemptId: null,
  assetAddress: null,
  signature: null,
  receiptState: 'NONE',
  claimedAt: null,
} as const;
const view = {
  seasonId: '11111111-1111-4111-8111-111111111111',
  network: 'devnet',
  availability: 'READY',
  reason: null,
  name: 'Cameo Season #1',
  imageUrl: `https://arweave.net/${'A'.repeat(43)}`,
  metadataUri: `https://arweave.net/${'B'.repeat(43)}`,
  eligibleCount: 2,
  claim,
} as const;
function envelope<T>(data: T) {
  return { data: { statusCode: 200, success: true, data } };
}

beforeEach(() => vi.clearAllMocks());

describe('season NFT API contract', () => {
  it('uses the existing API base once and authenticated cookie requests', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue(envelope(view));
    vi.mocked(axiosInstance.post)
      .mockResolvedValueOnce(
        envelope({ attemptId: '22222222-2222-4222-8222-222222222222', state: 'QUEUED' })
      )
      .mockResolvedValueOnce(
        envelope({
          attemptId: '22222222-2222-4222-8222-222222222222',
          state: 'SUBMITTING',
          signature: '3'.repeat(64),
        })
      );
    await getSeasonNft(view.seasonId);
    await createClaimAttempt(view.seasonId);
    await submitClaimTransaction(view.seasonId, '22222222-2222-4222-8222-222222222222', {
      transactionId: '33333333-3333-4333-8333-333333333333',
      signedTransactionBase64: 'AQ==',
    });
    expect(axiosInstance.get).toHaveBeenCalledWith(`/seasons/${view.seasonId}/nft`, {
      withCredentials: true,
      signal: undefined,
    });
    expect(axiosInstance.post).toHaveBeenNthCalledWith(
      1,
      `/seasons/${view.seasonId}/nft/claim-attempts`,
      undefined,
      { withCredentials: true }
    );
    expect(axiosInstance.post).toHaveBeenNthCalledWith(
      2,
      `/seasons/${view.seasonId}/nft/claim-attempts/22222222-2222-4222-8222-222222222222/transactions`,
      { transactionId: '33333333-3333-4333-8333-333333333333', signedTransactionBase64: 'AQ==' },
      { withCredentials: true }
    );
  });

  it.each([
    `http://arweave.net/${'A'.repeat(43)}`,
    `https://example.com/${'A'.repeat(43)}`,
    `https://arweave.net/${'A'.repeat(42)}`,
    `https://arweave.net/${'A'.repeat(43)}?download=1`,
    `https://user@arweave.net/${'A'.repeat(43)}`,
  ])('rejects a non-canonical permanent URI: %s', async badUrl => {
    vi.mocked(axiosInstance.get).mockResolvedValue(envelope({ ...view, imageUrl: badUrl }));
    await expect(getSeasonNft(view.seasonId)).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('accepts only a complete attempt transaction and exact decimal strings', async () => {
    const attempt = {
      attemptId: '22222222-2222-4222-8222-222222222222',
      state: 'AWAITING_SIGNATURE',
      step: 'MINT',
      walletAddress: claim.walletAddress,
      network: 'devnet',
      transaction: {
        transactionId: '33333333-3333-4333-8333-333333333333',
        serializedTransactionBase64: 'AQ==',
        lastValidBlockHeight: '1234',
        estimatedCostLamports: '1000000001',
        estimatedAt: '2026-10-10T00:00:00.000Z',
      },
      errorCode: null,
      retryable: false,
    };
    vi.mocked(axiosInstance.get).mockResolvedValue(envelope(attempt));
    await expect(getClaimAttempt(view.seasonId, attempt.attemptId)).resolves.toMatchObject({
      state: 'AWAITING_SIGNATURE',
      step: 'MINT',
    });
    vi.mocked(axiosInstance.get).mockResolvedValue(
      envelope({
        ...attempt,
        transaction: {
          ...attempt.transaction,
          lastValidBlockHeight: '12.5',
          estimatedCostLamports: 'free',
        },
      })
    );
    await expect(getClaimAttempt(view.seasonId, attempt.attemptId)).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });

  it('rejects impossible create-result state and attempt-id pairs', async () => {
    vi.mocked(axiosInstance.post)
      .mockResolvedValueOnce(envelope({ attemptId: null, state: 'QUEUED' }))
      .mockResolvedValueOnce(
        envelope({ attemptId: '22222222-2222-4222-8222-222222222222', state: 'CLAIMED' })
      );

    await expect(createClaimAttempt(view.seasonId)).rejects.toMatchObject({
      kind: 'invalid-response',
    });
    await expect(createClaimAttempt(view.seasonId)).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });

  it('accepts a transaction only while awaiting signature and requires one in that state', async () => {
    const attempt = {
      attemptId: '22222222-2222-4222-8222-222222222222',
      state: 'AWAITING_SIGNATURE',
      step: 'MINT',
      walletAddress: claim.walletAddress,
      network: 'devnet',
      transaction: {
        transactionId: '33333333-3333-4333-8333-333333333333',
        serializedTransactionBase64: 'AQ==',
        lastValidBlockHeight: '1234',
        estimatedCostLamports: '10',
        estimatedAt: '2026-10-10T00:00:00.000Z',
      },
      errorCode: null,
      retryable: false,
    };
    vi.mocked(axiosInstance.get)
      .mockResolvedValueOnce(envelope({ ...attempt, transaction: null }))
      .mockResolvedValueOnce(envelope({ ...attempt, state: 'CONFIRMING' }));

    await expect(getClaimAttempt(view.seasonId, attempt.attemptId)).rejects.toMatchObject({
      kind: 'invalid-response',
    });
    await expect(getClaimAttempt(view.seasonId, attempt.attemptId)).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });

  it('rejects oversized decoded transactions and non-canonical UTC timestamps', async () => {
    const transaction = {
      transactionId: '33333333-3333-4333-8333-333333333333',
      serializedTransactionBase64: btoa(String.fromCharCode(...new Uint8Array(1233))),
      lastValidBlockHeight: '1234',
      estimatedCostLamports: '10',
      estimatedAt: '2026-10-10T00:00:00.000Z',
    };
    const attempt = {
      attemptId: '22222222-2222-4222-8222-222222222222',
      state: 'AWAITING_SIGNATURE',
      step: 'MINT',
      walletAddress: claim.walletAddress,
      network: 'devnet',
      transaction,
      errorCode: null,
      retryable: false,
    };
    vi.mocked(axiosInstance.get)
      .mockResolvedValueOnce(envelope(attempt))
      .mockResolvedValueOnce(
        envelope({
          ...attempt,
          transaction: {
            ...transaction,
            serializedTransactionBase64: 'AQ==',
            estimatedAt: '2026-10-10T09:00:00+09:00',
          },
        })
      );

    await expect(getClaimAttempt(view.seasonId, attempt.attemptId)).rejects.toMatchObject({
      kind: 'invalid-response',
    });
    await expect(getClaimAttempt(view.seasonId, attempt.attemptId)).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });
});
