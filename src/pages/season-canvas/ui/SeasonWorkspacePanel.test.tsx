import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { useSeasonWorkspace } from '../model/useSeasonWorkspace';
import { SeasonWorkspacePanel } from './SeasonWorkspacePanel';

const api = vi.hoisted(() => ({ listSeasonHolders: vi.fn() }));
vi.mock('../api/seasons.api', async original => ({
  ...(await original<typeof import('../api/seasons.api')>()),
  listSeasonHolders: api.listSeasonHolders,
}));

const collectionAddress = 'BhBXZAzWGGx2wZCwbkDC9NDQh5NBreTJ3TvDe2GNW1aD';

function workspace(status: 'active' | 'ended', scope: Record<string, unknown> = {}) {
  return {
    season: {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Night Sky',
      participantCount: 2,
      capacity: 20,
      entryRule: 'anyone',
      entryFeeLamports: '0',
      width: 100,
      height: 100,
      strokeLimitPerUser: 1,
      startsAt: '2026-10-01T00:00:00.000Z',
      endsAt: '2026-10-10T00:00:00.000Z',
      forceEndedAt: null,
      cancelledAt: null,
    },
    ready: null,
    status,
    boundary: null,
    isParticipant: true,
    canDraw: false,
    canJoin: false,
    query: { isLoading: false, isError: false, refetch: vi.fn() },
    scope: {
      session: { user: { id: 'user-1' } },
      sessionQuery: { isError: false, refetch: vi.fn() },
      resetVersion: 0,
      ...scope,
    },
    realtime: {
      connection: { status: 'ready', connectionCount: 1, notice: null },
      retryRecovery: vi.fn(),
      sync: { status: 'ready', error: null, retry: false, submissionStatus: 'idle' },
    },
    join: { isJoining: false, join: vi.fn(), error: null },
  } as unknown as ReturnType<typeof useSeasonWorkspace>;
}

function renderPanel(model: ReturnType<typeof useSeasonWorkspace>) {
  // 패널의 조기 종료·참가자 목록 기능이 서버 상태 캐시를 사용하므로 QueryClient로 감싼다.
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <SeasonWorkspacePanel model={model} mode="live" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  api.listSeasonHolders.mockResolvedValue({
    items: [],
    page: 1,
    limit: 4,
    total: 0,
    collection: null,
  });
});

describe('SeasonWorkspacePanel', () => {
  it('shows the season title without the drawing-room extras', () => {
    renderPanel(workspace('ended'));
    expect(screen.getByRole('heading', { name: 'Night Sky' })).toBeTruthy();
    expect(screen.queryByText(/NFT/)).toBeNull();
  });

  it('opens the participant list in an ended room and links the ready collection', async () => {
    api.listSeasonHolders.mockResolvedValue({
      items: [],
      page: 1,
      limit: 4,
      total: 0,
      collection: { network: 'devnet', address: collectionAddress },
    });
    renderPanel(workspace('ended', { sessionKey: 'guest', isReady: true, resetVersion: 0 }));

    const explorer = await screen.findByRole('link', { name: '익스플로러에서 보기' });
    expect(explorer.getAttribute('href')).toBe(
      `https://explorer.solana.com/address/${collectionAddress}?cluster=devnet`
    );
    expect(explorer.getAttribute('target')).toBe('_blank');
    expect(screen.queryByText(/관람 모드입니다/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '참가자 보기' }));
    expect(screen.getByRole('dialog', { name: 'NFT 보유자 · Night Sky' })).toBeTruthy();
    expect(await screen.findByText('아직 참가자가 없습니다.')).toBeTruthy();
  });

  it('hides the explorer until the season NFT is ready and skips the list in a live room', async () => {
    const ended = renderPanel(
      workspace('ended', { sessionKey: 'guest', isReady: true, resetVersion: 0 })
    );
    expect(screen.getByRole('button', { name: '참가자 보기' })).toBeTruthy();
    await vi.waitFor(() => expect(api.listSeasonHolders).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('link', { name: '익스플로러에서 보기' })).toBeNull();
    ended.unmount();

    api.listSeasonHolders.mockClear();
    renderPanel(workspace('active', { sessionKey: 'guest', isReady: true, resetVersion: 0 }));
    expect(screen.queryByRole('button', { name: '참가자 보기' })).toBeNull();
    expect(api.listSeasonHolders).not.toHaveBeenCalled();
  });

  it('confirms a paid entry fee before joining from inside the room', async () => {
    let finish!: (result: { status: 'joined' }) => void;
    const join = vi.fn(
      () =>
        new Promise<{ status: 'joined' }>(resolve => {
          finish = resolve;
        })
    );
    const model = workspace('active', { resetVersion: 0, isReady: true });
    model.isParticipant = false;
    model.canJoin = true;
    model.season = { ...model.season!, entryFeeLamports: '10000000' };
    model.join = { isJoining: false, join };

    renderPanel(model);
    fireEvent.click(screen.getByRole('button', { name: '0.01 SOL 내고 참가' }));
    expect(screen.getByRole('dialog', { name: '입장료' })).toBeTruthy();
    expect(join).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '0.01 SOL 결제' }));
    expect(join).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ status: 'joined' });
    });
    expect(screen.getByRole('dialog', { name: '참가했습니다!' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: '캔버스 입장' })).toBeNull();
  });
});
