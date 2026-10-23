import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListSeasonHoldersInput, SeasonHoldersPage } from '../api/seasons.types';
import { SeasonHoldersDialog } from './SeasonHoldersDialog';

const api = vi.hoisted(() => ({ listSeasonHolders: vi.fn() }));
vi.mock('../api/seasons.api', () => ({
  getLatestSeasonSnapshotUrl: vi.fn(),
  getSeason: vi.fn(),
  listSeasons: vi.fn(),
  listSeasonHolders: api.listSeasonHolders,
}));

const holders = [
  { displayName: 'Mina', walletAddress: 'BhBXZAzWGGx2wZCwbkDC9NDQh5NBreTJ3TvDe2GNW1aD', amount: 1 },
  { displayName: null, walletAddress: 'G34283423045xxxxxxxxxxxxxxxxxxxxxxxxW1aZ', amount: null },
  { displayName: 'Joon', walletAddress: 'wallet-3', amount: null },
  { displayName: 'Sora', walletAddress: 'wallet-4', amount: 1 },
  { displayName: 'Hana', walletAddress: 'wallet-5', amount: null },
];

function respond(_seasonId: string, input: ListSeasonHoldersInput): Promise<SeasonHoldersPage> {
  const search = input.search?.toLowerCase() ?? '';
  const matched = holders.filter(
    holder =>
      !search ||
      holder.displayName?.toLowerCase().includes(search) ||
      holder.walletAddress.toLowerCase().includes(search)
  );
  const start = (input.page - 1) * input.limit;
  return Promise.resolve({
    items: matched.slice(start, start + input.limit),
    page: input.page,
    limit: input.limit,
    total: matched.length,
    collection: null,
  });
}

function renderDialog() {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <SeasonHoldersDialog
        open
        seasonId="season-1"
        title="Design the UI"
        sessionKey="guest"
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  api.listSeasonHolders.mockImplementation(respond);
});

describe('SeasonHoldersDialog', () => {
  it('lists drawers with their wallet and NFT amount, shortening a missing name', async () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'NFT 보유자 · Design the UI' })).toBeTruthy();
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText('Mina')).toBeTruthy();
    expect(within(rows[0]).getByText('BhBXZAzWGGx2wZCwbkDC9NDQh5NBreTJ3TvDe2GNW1aD')).toBeTruthy();
    expect(within(rows[0]).getByText('1')).toBeTruthy();
    expect(within(rows[1]).getByText('G342…W1aZ')).toBeTruthy();
    expect(within(rows[1]).getByText('미발급')).toBeTruthy();
    expect(api.listSeasonHolders).toHaveBeenCalledWith(
      'season-1',
      { page: 1, limit: 4, search: '' },
      expect.any(AbortSignal)
    );

    fireEvent.click(screen.getByRole('button', { name: '2페이지' }));
    await waitFor(() => expect(screen.getByText('Hana')).toBeTruthy());
    expect(screen.getByRole('button', { name: '2페이지' }).getAttribute('aria-current')).toBe(
      'page'
    );
  });

  it('searches after typing stops, returns to the first page, and explains an empty result', async () => {
    renderDialog();
    await screen.findByText('Mina');
    fireEvent.click(screen.getByRole('button', { name: '2페이지' }));
    await screen.findByText('Hana');

    const search = screen.getByRole('searchbox', { name: '이름이나 지갑 주소로 검색' });
    fireEvent.change(search, { target: { value: ' jo' } });
    fireEvent.change(search, { target: { value: ' joon ' } });

    expect(await screen.findByText('Joon')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(api.listSeasonHolders).toHaveBeenLastCalledWith(
      'season-1',
      { page: 1, limit: 4, search: 'joon' },
      expect.any(AbortSignal)
    );
    expect(api.listSeasonHolders).not.toHaveBeenCalledWith(
      'season-1',
      expect.objectContaining({ search: 'jo' }),
      expect.any(AbortSignal)
    );

    fireEvent.change(search, { target: { value: 'nobody' } });
    expect(await screen.findByText('검색 결과가 없습니다.')).toBeTruthy();
  });

  it('keeps the dialog usable when the list cannot load', async () => {
    api.listSeasonHolders.mockRejectedValueOnce(new Error('offline'));
    renderDialog();
    expect(await screen.findByText('참가자 목록을 불러오지 못했습니다.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('Mina')).toBeTruthy();
  });
});
