import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedSession } from '@/entities/session';
import { getSession } from '@/entities/session/api/session.api';
import { i18n } from '@/app/i18n/i18n';
import {
  getHostedSeasons,
  getParticipatedSeasons,
  getTransactions,
  getWalletBalance,
  updateDisplayName,
} from './api/profile.api';
import { formatDate } from './lib/profileFormat';
import ProfilePage from './ProfilePage';

vi.mock('@/entities/session/api/session.api', () => ({ getSession: vi.fn() }));
vi.mock('./api/profile.api', async importOriginal => ({
  ...(await importOriginal<typeof import('./api/profile.api')>()),
  updateDisplayName: vi.fn(),
  getParticipatedSeasons: vi.fn(),
  getHostedSeasons: vi.fn(),
  getWalletBalance: vi.fn(),
  getTransactions: vi.fn(),
}));
vi.mock('@/features/season-nft-claim', () => ({
  SeasonNftClaimCard: ({ seasonId }: { seasonId: string }) => (
    <div data-testid={`nft-${seasonId}`} />
  ),
}));

const session: AuthenticatedSession = {
  user: {
    id: 'user-1',
    displayName: 'jisun',
    avatarUrl: null,
    createdAt: '2026-09-10T12:00:00.000Z',
    wallets: [
      { chainNamespace: 'solana', address: 'FirstWalletabcdefghijklmnop1111' },
      { chainNamespace: 'solana', address: 'ActiveWalletabcdefghijklmnop2222' },
    ],
  },
  activeWallet: {
    id: 'wallet-2',
    chainNamespace: 'solana',
    address: 'ActiveWalletabcdefghijklmnop2222',
  },
  session: { expiresAt: '2026-10-07T00:00:00Z', absoluteExpiresAt: '2026-10-14T00:00:00Z' },
};

const joinedSeason = {
  seasonId: '11111111-1111-4111-8111-111111111111',
  title: 'Night Sky',
  lifecycleStatus: 'ended' as const,
  startsAt: '2026-03-01T12:00:00.000Z',
  endsAt: '2026-03-20T12:00:00.000Z',
  joinedAt: '2026-03-02T12:00:00.000Z',
  ownStrokeCount: 12,
  finalImageUrl: null,
  nft: {
    network: 'devnet' as const,
    availability: 'READY' as const,
    reason: null,
    claim: {
      eligibility: 'ELIGIBLE' as const,
      state: 'UNCLAIMED' as const,
      walletAddress: null,
      activeAttemptId: null,
      assetAddress: null,
      signature: null,
      receiptState: 'NONE' as const,
      claimedAt: null,
    },
  },
};

const hostedSeason = {
  seasonId: '22222222-2222-4222-8222-222222222222',
  title: 'Design the UI',
  lifecycleStatus: 'active' as const,
  startsAt: '2026-10-01T12:00:00.000Z',
  endsAt: '2026-10-20T12:00:00.000Z',
  participantCount: 3,
  finalImageUrl: null,
};

beforeEach(() => {
  vi.mocked(getParticipatedSeasons).mockResolvedValue({
    items: [joinedSeason],
    total: 1,
    limit: 20,
    offset: 0,
  });
  vi.mocked(getHostedSeasons).mockResolvedValue({
    items: [hostedSeason],
    total: 1,
    limit: 20,
    offset: 0,
  });
  vi.mocked(getWalletBalance).mockResolvedValue({
    walletAddress: 'ActiveWalletabcdefghijklmnop2222',
    network: 'devnet',
    lamports: '1222330000000',
  });
  vi.mocked(getTransactions).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
});

function renderProfile(path = '/profile') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('profile page', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    vi.mocked(updateDisplayName).mockReset();
  });

  it('asks signed-out visitors to connect a wallet', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    renderProfile();
    expect(await screen.findByRole('heading', { name: '지갑을 연결하세요' })).toBeTruthy();
  });

  it('recovers from a session load failure with the retry action', async () => {
    vi.mocked(getSession).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(null);
    const user = userEvent.setup();
    renderProfile();
    expect((await screen.findByRole('alert')).textContent).toContain(
      '프로필을 불러오지 못했습니다'
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('heading', { name: '지갑을 연결하세요' })).toBeTruthy();
  });

  it('shows only real profile data and switches to joined canvases', async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    const user = userEvent.setup();
    renderProfile();

    expect(await screen.findByRole('heading', { name: '@jisun' })).toBeTruthy();
    expect(screen.getByText('Acti…2222')).toBeTruthy();
    expect(screen.queryByText('Firs…1111')).toBeNull();
    expect(screen.getByRole('button', { name: '수정' })).toBeTruthy();
    expect(screen.getByText('가입일')).toBeTruthy();
    expect(screen.getByText(formatDate('2026-09-10T12:00:00.000Z', i18n.language))).toBeTruthy();
    expect(screen.getByText('잔액')).toBeTruthy();
    expect(await screen.findByText('1,222.33 SOL')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '거래 내역' })).toBeTruthy();
    expect(await screen.findByText('거래 내역이 없습니다.')).toBeTruthy();
    expect(screen.queryByText(/샘플 데이터/)).toBeNull();
    expect(screen.queryByText('Brush stroke')).toBeNull();

    // 내 시즌 탭은 서버가 돌려준 내가 개설한 시즌만 보여 주고, 화살표로 해당 시즌에 들어간다.
    await user.click(screen.getByRole('link', { name: '내 시즌' }));
    expect(screen.getByRole('link', { name: '내 시즌' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: '새 시즌' }).getAttribute('href')).toBe(
      '/season-canvas'
    );
    const mySeasons = screen.getByRole('region', { name: '내 시즌' });
    const hosted = await within(mySeasons).findByRole('article');
    expect(hosted.textContent).toContain('Design the UI');
    expect(hosted.textContent).toContain('참여자 3명');
    expect(hosted.textContent).toContain('진행 중');
    expect(
      within(mySeasons).getByRole('link', { name: 'Design the UI 열기' }).getAttribute('href')
    ).toBe(`/season-canvas/${hostedSeason.seasonId}`);
    expect(screen.getByRole('button', { name: '수정' })).toBeTruthy();

    // 시안처럼 참여한 캔버스 탭에서는 수정 버튼을 숨긴다.
    await user.click(screen.getByRole('button', { name: '참여한 캔버스' }));
    const joinedCanvases = await screen.findByRole('region', { name: '참여한 캔버스' });
    expect((await within(joinedCanvases).findByRole('article')).textContent).toMatch(/12\s*획/);
    expect(screen.getByTestId(`nft-${joinedSeason.seasonId}`)).toBeTruthy();
    expect(screen.getByRole('link', { name: '참여한 캔버스' }).getAttribute('aria-current')).toBe(
      'page'
    );
    expect(screen.queryByRole('button', { name: '수정' })).toBeNull();
  });

  it('lists confirmed SOL entries from the server and hides an unknown balance', async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(getWalletBalance).mockRejectedValue(new Error('rpc down'));
    vi.mocked(getTransactions).mockResolvedValue({
      items: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          type: 'season_entry',
          direction: 'outgoing',
          seasonId: joinedSeason.seasonId,
          seasonTitle: 'Night Sky',
          lamports: '10000000',
          network: 'devnet',
          signature: 'sig-out',
          occurredAt: '2026-09-28T12:00:00.000Z',
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          type: 'season_entry',
          direction: 'incoming',
          seasonId: hostedSeason.seasonId,
          seasonTitle: 'Design the UI',
          lamports: '25000000',
          network: 'devnet',
          signature: 'sig-in',
          occurredAt: '2026-09-27T12:00:00.000Z',
        },
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });
    renderProfile();

    const list = await screen.findByRole('list', { name: '거래 내역' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining('시즌 입장료'),
      expect.stringContaining('입장료 수령'),
    ]);
    expect(rows[0].textContent).toContain('−0.01 SOL');
    expect(rows[1].textContent).toContain('+0.025 SOL');
    await waitFor(() => expect(vi.mocked(getWalletBalance)).toHaveBeenCalled());
    expect(screen.getByText('잔액').nextElementSibling?.textContent).toBe('—');
  });

  it('opens the tab named in the URL and falls back to the profile tab', async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    renderProfile('/profile?tab=unknown');
    expect(await screen.findByRole('heading', { name: '@jisun' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '프로필' }).getAttribute('aria-current')).toBe('page');
  });

  it('shows the empty joined canvases state with a link to browse seasons', async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(getParticipatedSeasons).mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    const user = userEvent.setup();
    renderProfile();

    await user.click(await screen.findByRole('link', { name: '참여한 캔버스' }));
    expect(await screen.findByText('아직 참여한 캔버스가 없습니다.')).toBeTruthy();
    expect(screen.getByRole('link', { name: '시즌 둘러보기' }).getAttribute('href')).toBe(
      '/season-canvas'
    );
  });

  it('validates the nickname and saves it through the existing API', async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(updateDisplayName).mockResolvedValue({ id: 'user-1', displayName: 'jisun_art' });
    const user = userEvent.setup();
    renderProfile();

    await user.click(await screen.findByRole('button', { name: '수정' }));
    const input = await screen.findByRole('textbox', { name: '닉네임' });
    // 현재 닉네임 그대로는 저장할 내용이 없다.
    expect(screen.getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(true);

    await user.clear(input);
    await user.type(input, 'a'.repeat(21));
    expect(screen.getByText('20자 이하로 입력하세요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(true);

    await user.clear(input);
    await user.type(input, ' jisun_art ');
    await user.click(screen.getByRole('button', { name: '저장' }));

    // 앞뒤 공백을 제거한 닉네임을 첫 번째 인자로 보낸다. 두 번째 인자는 React Query의 실행 정보다.
    await waitFor(() => expect(vi.mocked(updateDisplayName).mock.calls[0]?.[0]).toBe('jisun_art'));
    expect(await screen.findByRole('heading', { name: '@jisun_art' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the dialog open with a message when saving fails', async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(updateDisplayName).mockRejectedValue(new Error('server down'));
    const user = userEvent.setup();
    renderProfile();

    await user.click(await screen.findByRole('button', { name: '수정' }));
    const input = await screen.findByRole('textbox', { name: '닉네임' });
    await user.clear(input);
    await user.type(input, 'new name');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      '프로필을 저장하지 못했습니다. 다시 시도하세요.'
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    // 모달이 열린 동안 뒤쪽 화면은 접근성 트리에서 숨겨지므로 hidden 요소까지 확인한다.
    expect(screen.getByRole('heading', { name: '@jisun', hidden: true })).toBeTruthy();
  });
});
