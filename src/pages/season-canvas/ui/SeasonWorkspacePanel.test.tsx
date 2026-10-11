import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { useSeasonWorkspace } from '../model/useSeasonWorkspace';
import { SeasonWorkspacePanel } from './SeasonWorkspacePanel';

vi.mock('@/features/season-nft-claim', () => ({
  SeasonNftClaimCard: ({ seasonId, source }: { seasonId: string; source: string }) => (
    <div data-testid="workspace-nft">
      {seasonId}:{source}
    </div>
  ),
}));

describe('SeasonWorkspacePanel', () => {
  it('mounts the shared NFT claim entry for the current season', () => {
    const model = {
      season: {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Night Sky',
        participantCount: 2,
        capacity: 20,
        width: 100,
        height: 100,
        strokeLimitPerUser: 1,
        startsAt: '2026-10-01T00:00:00.000Z',
        endsAt: '2026-10-10T00:00:00.000Z',
        forceEndedAt: null,
        cancelledAt: null,
      },
      ready: null,
      status: 'ended',
      boundary: null,
      isParticipant: true,
      canDraw: false,
      canJoin: false,
      query: { isLoading: false, isError: false, refetch: vi.fn() },
      scope: {
        session: { user: { id: 'user-1' } },
        sessionQuery: { isError: false, refetch: vi.fn() },
      },
      realtime: {
        connection: { status: 'ready', connectionCount: 1, notice: null },
        retryRecovery: vi.fn(),
        sync: { status: 'ready', error: null, retry: false, submissionStatus: 'idle' },
      },
      join: { isJoining: false, join: vi.fn(), error: null },
    } as unknown as ReturnType<typeof useSeasonWorkspace>;

    // 패널의 조기 종료 기능이 서버 상태 캐시를 사용하므로 QueryClient로 감싼다.
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SeasonWorkspacePanel model={model} mode="live" />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('workspace-nft').textContent).toBe(
      '11111111-1111-4111-8111-111111111111:workspace'
    );
  });
});
