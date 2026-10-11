import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedSession } from '@/entities/session';
import { getSession } from '@/entities/session/api/session.api';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
import { logout } from './api/wallet-auth.api';
import Header from './index';
import { disconnectWallet } from './lib/wallet-standard';

vi.mock('@/entities/session/api/session.api', () => ({ getSession: vi.fn() }));
vi.mock('./api/wallet-auth.api', async importOriginal => ({
  ...(await importOriginal<typeof import('./api/wallet-auth.api')>()),
  logout: vi.fn(),
}));
vi.mock('./lib/wallet-standard', async importOriginal => ({
  ...(await importOriginal<typeof import('./lib/wallet-standard')>()),
  disconnectWallet: vi.fn(),
}));

const session: AuthenticatedSession = {
  user: {
    id: 'user-1',
    displayName: 'GAEMI',
    avatarUrl: null,
    wallets: [
      { chainNamespace: 'solana', address: 'FirstWalletabcdefghijklmnopqrstuvwxyz1111' },
      { chainNamespace: 'solana', address: 'ActiveWalletabcdefghijklmnopqrstuvwxyz2222' },
    ],
  },
  activeWallet: {
    id: 'wallet-2',
    chainNamespace: 'solana',
    address: 'ActiveWalletabcdefghijklmnopqrstuvwxyz2222',
  },
  session: { expiresAt: '2026-10-08T00:00:00Z', absoluteExpiresAt: '2026-10-14T00:00:00Z' },
};

function renderHeader() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Header menuItems={[]} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('header account button', () => {
  it('opens a menu with a profile link and disconnect when signed in', async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(logout).mockResolvedValue(undefined);
    vi.mocked(disconnectWallet).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderHeader();

    await user.click(await screen.findByRole('button', { name: /ActiveWallet/ }));

    expect(screen.getByRole('menuitem', { name: '프로필' }).getAttribute('href')).toBe('/profile');
    expect(screen.getByRole('menuitem', { name: '지갑 연결 해제' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /FirstWallet/ })).toBeNull();
    // 메뉴로 대체했으므로 로그인 상태에서는 지갑 연결 창을 열지 않는다.
    expect(useModalStore.getState().isModalOpen).toBe(false);

    await user.click(screen.getByRole('menuitem', { name: '지갑 연결 해제' }));

    // 서버 로그아웃 후 첫 번째 연결 지갑이 아닌 실제 인증 지갑을 확장 프로그램에서 해제한다.
    await waitFor(() =>
      expect(disconnectWallet).toHaveBeenCalledWith(session.activeWallet.address)
    );
  });

  it('keeps opening the wallet dialog when signed out', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const user = userEvent.setup();
    renderHeader();

    await user.click(await screen.findByRole('button', { name: '지갑 연결' }));

    await waitFor(() => expect(useModalStore.getState().isModalOpen).toBe(true));
    expect(screen.queryByRole('menuitem')).toBeNull();
    useModalStore.getState().closeModal();
  });
});
