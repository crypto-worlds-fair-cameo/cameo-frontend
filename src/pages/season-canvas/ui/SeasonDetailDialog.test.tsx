import { useRef, useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeasonNftClaimState } from '@/features/season-nft-claim';
import type { Season } from '../api/seasons.types';
import type { SeasonManageAction } from '../model/useSeasonDetail';
import { SeasonDetailDialog } from './SeasonDetailDialog';
import { MemoryRouter } from 'react-router';

const nft = vi.hoisted(() => ({ state: null as SeasonNftClaimState | null }));
vi.mock('@/features/season-nft-claim', () => ({
  SeasonNftClaimCard: ({ seasonId, autoStart }: { seasonId: string; autoStart?: boolean }) => (
    <div data-testid={`nft-${seasonId}`}>{autoStart ? 'NFT claim started' : 'NFT claim'}</div>
  ),
  useSeasonNftClaimState: (_seasonId: string | undefined, enabled: boolean) =>
    enabled ? nft.state : null,
  useSeasonNftPreview: () => null,
  useSeasonNftMinted: () => false,
}));

beforeEach(() => {
  nft.state = null;
});
vi.mock('../model/useSeasonSnapshotPreview', () => ({ useSeasonSnapshotPreview: () => null }));
vi.mock('@/features/canvas-workspace', () => ({
  CanvasLivePreview: ({
    canvasKey,
    requiresSession,
  }: {
    canvasKey: string;
    requiresSession: boolean;
  }) => <div data-testid="live-preview">{`${canvasKey} ${requiresSession}`}</div>,
}));

const season: Season = {
  id: 'season-1',
  creatorId: 'user-1',
  title: '예약 시즌',
  description: null,
  width: 1000,
  height: 1000,
  strokeLimitPerUser: 1,
  capacity: 20,
  entryRule: 'anyone',
  entryFeeLamports: '0',
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

function queryOf(data: Season) {
  return {
    data,
    error: null,
    isLoading: false,
    isError: false,
    isRefetchError: false,
    isFetching: false,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<Season, Error>;
}

function DetailHarness({
  data = season,
  isManaging = false,
  onJoin = vi.fn(),
  onBrowseLive = vi.fn(),
}: {
  data?: Season;
  isManaging?: boolean;
  onJoin?: (season: Season) => void;
  onBrowseLive?: () => void;
}) {
  const openerRef = useRef<HTMLButtonElement>(null);
  const fallbackRef = useRef<HTMLHeadingElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manageAction, setManageAction] = useState<SeasonManageAction | null>(null);
  return (
    <>
      <h1 ref={fallbackRef} tabIndex={-1}>
        시즌
      </h1>
      <button ref={openerRef} onClick={() => setSelectedId(data.id)}>
        상세 열기
      </button>
      <SeasonDetailDialog
        selectedId={selectedId}
        query={queryOf(data)}
        manageAction={manageAction}
        manageError={null}
        isManaging={isManaging}
        isRefreshingManagement={false}
        canInteract
        isJoining={false}
        onClose={() => setSelectedId(null)}
        onJoin={onJoin}
        onBrowseLive={onBrowseLive}
        onOpenManage={setManageAction}
        onCloseManage={() => setManageAction(null)}
        onConfirmManage={() => setManageAction(null)}
        restoreFocusTo={openerRef}
        fallbackFocusTo={fallbackRef}
      />
    </>
  );
}

function openDetail(props: Parameters<typeof DetailHarness>[0] = {}) {
  render(
    <MemoryRouter>
      <DetailHarness {...props} />
    </MemoryRouter>
  );
  const opener = screen.getByRole('button', { name: '상세 열기' });
  fireEvent.click(opener);
  return opener;
}

describe('season detail focus lifecycle', () => {
  it('restores nested confirmation and detail focus to their openers', async () => {
    const opener = openDetail();
    expect(screen.getByRole('heading', { name: season.title })).toBeTruthy();
    const manageButton = screen.getByRole('button', { name: '예약 취소' });
    fireEvent.click(manageButton);
    fireEvent.click(screen.getByRole('button', { name: '돌아가기' }));
    await waitFor(() => expect(document.activeElement).toBe(manageButton));
    fireEvent.click(screen.getAllByRole('button', { name: '닫기' })[0]);
    await waitFor(() => expect(document.activeElement).toBe(opener));

    fireEvent.click(opener);
    expect(screen.getByRole('heading', { name: season.title })).toBeTruthy();
  });

  it('keeps translated close controls visible but disabled during a management request', () => {
    openDetail({ isManaging: true });
    const closeButtons = screen.getAllByRole('button', { name: '닫기' });
    expect(closeButtons).toHaveLength(2);
    closeButtons.forEach(button => expect(button.hasAttribute('disabled')).toBe(true));
  });

  it('returns from the typed end confirmation to the end button', async () => {
    openDetail({ data: { ...season, status: 'active', canCancel: false, canEnd: true } });
    const endButton = screen.getByRole('button', { name: '조기 종료' });
    fireEvent.click(endButton);
    const confirm = screen.getByRole('button', { name: '시즌 강제 종료' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: season.title } });
    expect(confirm.hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    await waitFor(() => expect(document.activeElement).toBe(endButton));
  });
});

describe('season detail actions', () => {
  it('offers joining to a non-participant of a live season', () => {
    const onJoin = vi.fn();
    const live = { ...season, status: 'active', isParticipant: false, isCreator: false } as const;
    openDetail({ data: { ...live, canCancel: false }, onJoin });
    fireEvent.click(screen.getByRole('button', { name: '시즌 참가' }));
    expect(onJoin).toHaveBeenCalledWith(expect.objectContaining({ id: 'season-1' }));
    expect(screen.queryByRole('link', { name: '캔버스 입장' })).toBeNull();
  });

  it('lets a participant enter the live canvas', () => {
    openDetail({ data: { ...season, status: 'active', canCancel: false } });
    expect(screen.getByRole('link', { name: '캔버스 입장' }).getAttribute('href')).toBe(
      '/season-canvas/season-1'
    );
    expect(screen.queryByRole('button', { name: '시즌 참가' })).toBeNull();
  });

  it('shows the ended notice with view and browse actions instead of close', () => {
    const onBrowseLive = vi.fn();
    openDetail({ data: { ...season, status: 'ended', canCancel: false }, onBrowseLive });
    expect(screen.getByText('종료된 시즌입니다.')).toBeTruthy();
    expect(screen.getByRole('link', { name: '캔버스 보기' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '진행 중인 시즌 보기' }));
    expect(onBrowseLive).toHaveBeenCalledTimes(1);
    // 상단 X 닫기만 남고 하단 동작 영역에는 닫기 버튼이 없다.
    expect(screen.getAllByRole('button', { name: '닫기' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'NFT 받기' })).toBeNull();
  });

  it('puts an NFT claim button under the view button and opens the claim card from it', () => {
    nft.state = 'claimable';
    openDetail({ data: { ...season, status: 'ended', canCancel: false } });
    const view = screen.getByRole('link', { name: '캔버스 보기' });
    const claim = screen.getByRole('button', { name: 'NFT 받기' });
    expect(view.compareDocumentPosition(claim) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('nft-season-1')).toBeNull();

    fireEvent.click(claim);
    expect(screen.getByTestId('nft-season-1').textContent).toBe('NFT claim started');
    expect(screen.queryByRole('button', { name: 'NFT 받기' })).toBeNull();
  });

  it.each([
    ['claimed', 'ended'],
    [null, 'ended'],
    ['claimable', 'active'],
  ] as const)('hides the NFT claim button for %s state in an %s season', (state, status) => {
    nft.state = state;
    openDetail({ data: { ...season, status, canCancel: false } });
    expect(screen.queryByRole('button', { name: 'NFT 받기' })).toBeNull();
  });
});

describe('season detail preview', () => {
  it('shows the current canvas only while the season is live', () => {
    openDetail({ data: { ...season, status: 'active', entryRule: 'wallet_holders' } });
    expect(screen.getByTestId('live-preview').textContent).toBe('season:season-1 true');
  });

  it.each(['scheduled', 'ended'] as const)('keeps the %s preview off the live canvas', status => {
    openDetail({ data: { ...season, status } });
    expect(screen.queryByTestId('live-preview')).toBeNull();
  });
});
