import { beforeEach, describe, expect, it, vi } from 'vitest';
import { payAndJoinSeason } from './seasons.payment';
import { SeasonRequestError, type SeasonEntryPayment } from './seasons.types';

const api = vi.hoisted(() => ({
  prepareSeasonEntryPayment: vi.fn(),
  submitSeasonEntryTransaction: vi.fn(),
  getSeasonEntryPayment: vi.fn(),
  joinSeason: vi.fn(),
}));
const signSolanaTransaction = vi.hoisted(() => vi.fn());
vi.mock('./seasons.api', () => api);
vi.mock('@/shared/lib/solana-wallet/sign-transaction', () => ({ signSolanaTransaction }));

const payment: SeasonEntryPayment = {
  paymentId: 'p',
  seasonId: 's',
  status: 'AWAITING_SIGNATURE',
  network: 'devnet',
  lamports: '100000000',
  payerAddress: 'payer',
  recipientAddress: 'creator',
  serializedTransactionBase64: 'AAAA',
  signature: null,
  expiresAt: '2026-10-12T00:01:00.000Z',
};

beforeEach(() => {
  vi.useRealTimers();
  for (const mock of [...Object.values(api), signSolanaTransaction]) mock.mockReset();
});

describe('payAndJoinSeason', () => {
  it('signs the prepared transfer, waits for confirmation and returns the joined detail', async () => {
    vi.useFakeTimers();
    api.prepareSeasonEntryPayment.mockResolvedValue(payment);
    signSolanaTransaction.mockResolvedValue('signed');
    api.submitSeasonEntryTransaction.mockResolvedValue({ ...payment, status: 'SUBMITTED' });
    api.getSeasonEntryPayment.mockResolvedValue({ ...payment, status: 'CONFIRMED' });
    api.joinSeason.mockResolvedValue({ id: 's', isParticipant: true });

    const result = payAndJoinSeason('s', 'payer');
    await vi.runAllTimersAsync();

    await expect(result).resolves.toMatchObject({ isParticipant: true });
    expect(signSolanaTransaction).toHaveBeenCalledWith({
      walletAddress: 'payer',
      network: 'devnet',
      serializedTransactionBase64: 'AAAA',
    });
    expect(api.submitSeasonEntryTransaction).toHaveBeenCalledWith('s', 'p', 'signed');
  });

  it('reports a wallet refusal without submitting the payment', async () => {
    api.prepareSeasonEntryPayment.mockResolvedValue(payment);
    signSolanaTransaction.mockRejectedValue(new Error('User rejected'));

    await expect(payAndJoinSeason('s', 'payer')).rejects.toMatchObject({
      code: 'WALLET_SIGNING_FAILED',
    });
    expect(api.submitSeasonEntryTransaction).not.toHaveBeenCalled();
  });

  it('reads the participant detail when an earlier payment already joined the season', async () => {
    api.prepareSeasonEntryPayment.mockRejectedValue(
      new SeasonRequestError('joined', 'business', 409, 'SEASON_ENTRY_FEE_NOT_REQUIRED')
    );
    api.joinSeason.mockResolvedValue({ id: 's', isParticipant: true });

    await expect(payAndJoinSeason('s', 'payer')).resolves.toMatchObject({ isParticipant: true });
    expect(signSolanaTransaction).not.toHaveBeenCalled();
  });
});
