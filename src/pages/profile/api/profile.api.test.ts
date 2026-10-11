import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axiosInstance } from '@/shared/api/http-client';
import { getParticipatedSeasons } from './profile.api';

vi.mock('@/shared/api/http-client', () => ({
  axiosInstance: { get: vi.fn(), patch: vi.fn() },
}));

const seasonId = '11111111-1111-4111-8111-111111111111';
const item = {
  seasonId,
  title: 'Night Sky',
  lifecycleStatus: 'ended',
  startsAt: '2026-10-01T00:00:00.000Z',
  endsAt: '2026-10-10T00:00:00.000Z',
  joinedAt: '2026-10-02T00:00:00.000Z',
  ownStrokeCount: 3,
  finalImageUrl: 'https://cdn.example.com/seasons/final.png',
  nft: {
    network: 'devnet',
    availability: 'READY',
    reason: null,
    claim: {
      eligibility: 'ELIGIBLE',
      state: 'UNCLAIMED',
      walletAddress: null,
      activeAttemptId: null,
      assetAddress: null,
      signature: null,
      receiptState: 'NONE',
      claimedAt: null,
    },
  },
} as const;

function envelope(data: unknown) {
  return { data: { statusCode: 200, success: true, data } };
}

beforeEach(() => vi.clearAllMocks());

describe('participated seasons API', () => {
  it('requests the authenticated offset page and returns its validated contract', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue(
      envelope({ items: [item], total: 21, limit: 20, offset: 0 })
    );

    await expect(getParticipatedSeasons(20, 0)).resolves.toMatchObject({
      items: [{ seasonId, lifecycleStatus: 'ended' }],
      total: 21,
    });
    expect(axiosInstance.get).toHaveBeenCalledWith('/seasons/participated', {
      params: { limit: 20, offset: 0 },
      withCredentials: true,
      signal: undefined,
    });
  });

  it.each([
    { ...item, lifecycleStatus: 'finished' },
    { ...item, lifecycleStatus: ['ended'] },
    { ...item, nft: { ...item.nft, network: ['devnet'] } },
    { ...item, ownStrokeCount: -1 },
    { ...item, finalImageUrl: 'javascript:alert(1)' },
    { ...item, nft: { ...item.nft, claim: { ...item.nft.claim, activeAttemptId: 'bad' } } },
  ])('rejects malformed participated-season items', async malformed => {
    vi.mocked(axiosInstance.get).mockResolvedValue(
      envelope({ items: [malformed], total: 1, limit: 20, offset: 0 })
    );
    await expect(getParticipatedSeasons(20, 0)).rejects.toThrow('invalid');
  });

  it.each([
    { items: [item], total: 1, limit: 10, offset: 0 },
    { items: [item], total: 1, limit: 20, offset: 20 },
    { items: [item, item], total: 2, limit: 1, offset: 0 },
  ])('rejects a page that cannot advance the requested offset safely', async page => {
    vi.mocked(axiosInstance.get).mockResolvedValue(envelope(page));
    await expect(getParticipatedSeasons(20, 0)).rejects.toThrow('invalid');
  });

  it('counts title length by Unicode code points like the backend', async () => {
    vi.mocked(axiosInstance.get)
      .mockResolvedValueOnce(
        envelope({ items: [{ ...item, title: '🎨'.repeat(50) }], total: 1, limit: 20, offset: 0 })
      )
      .mockResolvedValueOnce(
        envelope({ items: [{ ...item, title: '🎨'.repeat(51) }], total: 1, limit: 20, offset: 0 })
      );

    await expect(getParticipatedSeasons(20, 0)).resolves.toMatchObject({
      items: [{ title: '🎨'.repeat(50) }],
    });
    await expect(getParticipatedSeasons(20, 0)).rejects.toThrow('invalid');
  });
});
