import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelSeason, createSeason, listSeasons, joinSeason } from './seasons.api';
import { SeasonRequestError, type Season } from './seasons.types';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/shared/api/http-client', () => ({ axiosInstance: { get, post } }));

const season: Season = {
  id: 'c0b73a9f-2649-47af-8bea-736fca6a9d03',
  creatorId: 'b27325db-66a2-4adf-93d1-c5ac41bfe6f1',
  title: 'season',
  description: null,
  width: 1000,
  height: 1000,
  strokeLimitPerUser: null,
  capacity: 20,
  participantCount: 1,
  startsAt: '2026-10-10T00:00:00.000Z',
  endsAt: '2026-10-11T00:00:00.000Z',
  cancelledAt: null,
  forceEndedAt: null,
  createdAt: '2026-10-07T00:00:00.000Z',
  status: 'scheduled',
  isParticipant: true,
  isCreator: true,
  canCancel: true,
  canEnd: false,
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('season API contract', () => {
  it('joins without a body and uses the authoritative participant detail', async () => {
    post.mockResolvedValue({
      data: { success: true, data: { ...season, status: 'active', participantCount: 2 } },
    });
    expect(await joinSeason(season.id)).toMatchObject({ isParticipant: true, participantCount: 2 });
    expect(post).toHaveBeenCalledWith(`/seasons/${season.id}/join`, undefined, {
      withCredentials: true,
    });
  });
  it('omits all status and forwards credentials and AbortSignal', async () => {
    get.mockResolvedValue({
      data: {
        success: true,
        statusCode: 200,
        data: { items: [season], page: 1, limit: 20, hasNext: false },
      },
    });
    const controller = new AbortController();
    await listSeasons({ page: 1, limit: 20 }, controller.signal);
    const [path, options] = get.mock.calls[0];
    expect(path).toBe('/seasons?page=1&limit=20');
    expect(options).toMatchObject({ withCredentials: true, signal: controller.signal });
  });

  it('rejects a 2xx response with an invalid envelope or date', async () => {
    post.mockResolvedValue({
      data: { success: true, data: { ...season, startsAt: 'not-a-date' } },
    });
    await expect(
      createSeason({
        title: 'x',
        width: 1000,
        height: 1000,
        capacity: 20,
        strokeLimitPerUser: 1,
        endsAt: season.endsAt,
      })
    ).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('normalizes business error codes without matching message text', async () => {
    post.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed',
      response: {
        status: 409,
        data: {
          success: false,
          code: 'SEASON_STATE_CONFLICT',
          message: 'changed',
          traceId: 'trace-1',
        },
      },
    });
    await expect(cancelSeason(season.id)).rejects.toEqual(
      expect.objectContaining<Partial<SeasonRequestError>>({
        kind: 'business',
        statusCode: 409,
        code: 'SEASON_STATE_CONFLICT',
        traceId: 'trace-1',
      })
    );
    expect(post).toHaveBeenCalledWith(`/seasons/${season.id}/cancel`, undefined, {
      withCredentials: true,
    });
  });
});
