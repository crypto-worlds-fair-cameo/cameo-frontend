import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedSession } from '@/entities/session';
import { getSession } from '@/entities/session/api/session.api';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
import Header from './index';

vi.mock('@/entities/session/api/session.api', () => ({ getSession: vi.fn() }));

const session: AuthenticatedSession = {
  user: {
    id: 'user-1',
    displayName: 'GAEMI',
    avatarUrl: null,
    wallets: [{ chainNamespace: 'solana', address: 'CRp5abcdefghijklmnopqrstuvwxyzGPf8' }],
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
    const user = userEvent.setup();
    renderHeader();

    await user.click(await screen.findByRole('button', { name: /CRp5abcd/ }));

    expect(screen.getByRole('menuitem', { name: '프로필' }).getAttribute('href')).toBe('/profile');
    expect(screen.getByRole('menuitem', { name: '지갑 연결 해제' })).toBeTruthy();
    // 메뉴로 대체했으므로 로그인 상태에서는 지갑 연결 창을 열지 않는다.
    expect(useModalStore.getState().isModalOpen).toBe(false);
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
