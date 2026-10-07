import { useRef, useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Season } from '../api/seasons.types';
import type { SeasonManageAction } from '../model/useSeasonDetail';
import { SeasonDetailDialog } from './SeasonDetailDialog';
import { MemoryRouter } from 'react-router';

const season: Season = {
  id: 'season-1',
  creatorId: 'user-1',
  title: '예약 시즌',
  description: null,
  width: 1000,
  height: 1000,
  strokeLimitPerUser: 1,
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

const query = {
  data: season,
  error: null,
  isLoading: false,
  isError: false,
  isRefetchError: false,
  isFetching: false,
  refetch: vi.fn(),
} as unknown as UseQueryResult<Season, Error>;

function DetailHarness() {
  const openerRef = useRef<HTMLButtonElement>(null);
  const fallbackRef = useRef<HTMLHeadingElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manageAction, setManageAction] = useState<SeasonManageAction | null>(null);
  return (
    <>
      <h1 ref={fallbackRef} tabIndex={-1}>
        시즌
      </h1>
      <button ref={openerRef} onClick={() => setSelectedId(season.id)}>
        상세 열기
      </button>
      <SeasonDetailDialog
        selectedId={selectedId}
        query={query}
        manageAction={manageAction}
        manageError={null}
        isManaging={false}
        isRefreshingManagement={false}
        canInteract
        onClose={() => setSelectedId(null)}
        onOpenManage={setManageAction}
        onCloseManage={() => setManageAction(null)}
        onConfirmManage={() => setManageAction(null)}
        restoreFocusTo={openerRef}
        fallbackFocusTo={fallbackRef}
      />
    </>
  );
}

describe('season detail focus lifecycle', () => {
  it('restores nested confirmation and detail focus to their openers', async () => {
    render(
      <MemoryRouter>
        <DetailHarness />
      </MemoryRouter>
    );
    const opener = screen.getByRole('button', { name: '상세 열기' });
    fireEvent.click(opener);
    const manageButton = screen.getByRole('button', { name: '예약 취소' });
    fireEvent.click(manageButton);
    fireEvent.click(screen.getByRole('button', { name: '돌아가기' }));
    await waitFor(() => expect(document.activeElement).toBe(manageButton));
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
