import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedSession } from '@/entities/session';
import { getSession } from '@/entities/session/api/session.api';
import { getParticipatedSeasons, getProfileActivity, updateDisplayName } from './api/profile.api';
import ProfilePage from './ProfilePage';

vi.mock('@/entities/session/api/session.api', () => ({ getSession: vi.fn() }));
vi.mock('./api/profile.api', async importOriginal => ({
  ...(await importOriginal<typeof import('./api/profile.api')>()),
  getProfileActivity: vi.fn(),
  updateDisplayName: vi.fn(),
  getParticipatedSeasons: vi.fn(),
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

beforeEach(() => {
  vi.mocked(getParticipatedSeasons).mockResolvedValue({
    items: [joinedSeason],
    total: 1,
    limit: 20,
    offset: 0,
  });
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
  beforeEach(async () => {
    vi.mocked(getSession).mockReset();
    vi.mocked(updateDisplayName).mockReset();
    const originalApi =
      await vi.importActual<typeof import('./api/profile.api')>('./api/profile.api');
    vi.mocked(getProfileActivity).mockReset().mockImplementation(originalApi.getProfileActivity);
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

  it('shows the signed-in profile with sample activity and switches tabs', async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    const user = userEvent.setup();
    renderProfile();

    expect(await screen.findByRole('heading', { name: '@jisun' })).toBeTruthy();
    expect(screen.getByText('Acti…2222')).toBeTruthy();
    expect(screen.queryByText('Firs…1111')).toBeNull();
    expect(await screen.findByText('Season entry')).toBeTruthy();
    const sampleNotice = screen.getByText(/샘플 데이터/);
    expect(
      sampleNotice.compareDocumentPosition(screen.getByText('잔액')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    await user.click(screen.getByRole('link', { name: '내 시즌' }));
    expect(await screen.findByText('Design the UI')).toBeTruthy();
    expect(screen.getByRole('link', { name: '내 시즌' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('button', { name: 'NFT 만들기' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'NFT 보기' })).toBeNull();

    // 시안처럼 참여한 캔버스 탭에서는 수정 버튼과 요약 카드를 숨긴다.
    await user.click(screen.getByRole('button', { name: '참여한 캔버스' }));
    const joinedCanvases = await screen.findByRole('region', { name: '참여한 캔버스' });
    expect((await within(joinedCanvases).findByRole('article')).textContent).toMatch(/12\s*획/);
    expect(screen.getByTestId(`nft-${joinedSeason.seasonId}`)).toBeTruthy();
    expect(screen.queryByText(/샘플 데이터/)).toBeNull();
    expect(screen.queryByRole('button', { name: '수정' })).toBeNull();
    expect(screen.queryByText('잔액')).toBeNull();
  });

  it('opens the tab named in the URL and falls back to the profile tab', async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    renderProfile('/profile?tab=unknown');
    expect(await screen.findByText('Season entry')).toBeTruthy();
    expect(screen.getByRole('link', { name: '프로필' }).getAttribute('aria-current')).toBe('page');
  });

  it('shows empty activity states for each tab and offers a link to browse seasons', async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(getProfileActivity).mockResolvedValue({
      joinedAt: '2026-09-10T12:00:00Z',
      balanceSol: 0,
      transactions: [],
      mySeasons: [],
    });
    vi.mocked(getParticipatedSeasons).mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    const user = userEvent.setup();
    renderProfile();

    expect(await screen.findByText('거래 내역이 없습니다.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: '거래 내역' })).toBeNull();
    expect(screen.getByText(/샘플 데이터/)).toBeTruthy();

    await user.click(screen.getByRole('link', { name: '내 시즌' }));
    expect(await screen.findByText('아직 만든 시즌이 없습니다.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'NFT 만들기' })).toBeNull();
    expect(screen.getByRole('link', { name: '새 시즌' }).getAttribute('href')).toBe(
      '/season-canvas'
    );

    await user.click(screen.getByRole('link', { name: '참여한 캔버스' }));
    expect(await screen.findByText('아직 참여한 캔버스가 없습니다.')).toBeTruthy();
    expect(screen.getByRole('link', { name: '시즌 둘러보기' }).getAttribute('href')).toBe(
      '/season-canvas'
    );
    expect(screen.queryByText('잔액')).toBeNull();
  });

  it('keeps the profile identity visible and recovers from an activity load failure', async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(getProfileActivity).mockRejectedValueOnce(new Error('activity offline'));
    const user = userEvent.setup();
    renderProfile();

    expect((await screen.findByRole('alert')).textContent).toContain(
      '활동 내역을 불러오지 못했습니다.'
    );
    expect(screen.getByRole('heading', { name: '@jisun' })).toBeTruthy();
    expect(screen.queryByText('잔액')).toBeNull();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('Season entry')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('잔액')).toBeTruthy();
    expect(vi.mocked(getProfileActivity)).toHaveBeenCalledTimes(2);
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
