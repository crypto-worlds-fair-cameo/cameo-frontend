import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
import { useWalletAuthentication } from '../model/useWalletAuthentication';
import { WalletConnectContent } from './WalletConnectContent';

vi.mock('../model/useWalletAuthentication', () => ({ useWalletAuthentication: vi.fn() }));

type WalletAuthentication = ReturnType<typeof useWalletAuthentication>;

function mockAuth(overrides: Partial<WalletAuthentication> = {}) {
  const auth: WalletAuthentication = {
    session: undefined,
    walletAddress: undefined,
    isAuthenticated: false,
    checkingSession: false,
    isPending: false,
    errorKey: null,
    errorWalletName: undefined,
    connect: vi.fn(),
    saveNickname: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
  vi.mocked(useWalletAuthentication).mockReturnValue(auth);
  return auth;
}

function renderInDialog(content: ReactNode) {
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>지갑 연결</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('wallet connect dialog', () => {
  it('shows Phantom with next and cancel actions before connecting', () => {
    const auth = mockAuth();
    renderInDialog(<WalletConnectContent />);

    expect(screen.getByText('Phantom')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(auth.connect).toHaveBeenCalledWith('Phantom', expect.any(Function));
    expect(screen.getByRole('button', { name: '취소' })).toBeTruthy();
  });

  it('only allows cancelling while the wallet request is open', () => {
    mockAuth({ isPending: true });
    renderInDialog(<WalletConnectContent />);

    expect(screen.getByRole('status').textContent).toBe('지갑 연결 중…');
    expect(screen.queryByRole('button', { name: '다음' })).toBeNull();
    expect(screen.getByRole('button', { name: '취소' })).toBeTruthy();
  });

  it('marks a declined signature in the wallet row and offers a retry', () => {
    const auth = mockAuth({ errorKey: 'errors.rejected' });
    renderInDialog(<WalletConnectContent />);

    expect(screen.getByRole('status').textContent).toBe('요청 거절됨');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(auth.connect).toHaveBeenCalledTimes(1);
  });

  it('explains other failures and links to the Phantom install page', () => {
    mockAuth({ errorKey: 'errors.notInstalled', errorWalletName: 'Phantom' });
    renderInDialog(<WalletConnectContent />);

    expect(screen.getByRole('status').textContent).toBe('연결 실패');
    expect(screen.getByRole('alert').textContent).toContain('Phantom 지갑을 찾을 수 없습니다');
    expect(screen.getByRole('link', { name: 'Phantom 설치' }).getAttribute('href')).toBe(
      'https://phantom.com/download'
    );
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
  });

  it('shows the connected view with a done button once the session is confirmed', () => {
    mockAuth({
      session: {
        user: { id: 'user-1', displayName: 'GAEMI', avatarUrl: null, wallets: [] },
        activeWallet: { id: 'wallet-1', chainNamespace: 'solana', address: 'BhBXabcdefghW1aD' },
        session: { expiresAt: '2026-10-13T00:00:00Z', absoluteExpiresAt: '2026-10-19T00:00:00Z' },
      },
      walletAddress: 'BhBXabcdefghW1aD',
      isAuthenticated: true,
    });
    useModalStore.getState().openModal({ content: null });
    renderInDialog(<WalletConnectContent />);

    expect(screen.getByRole('status').textContent).toBe('지갑이 연결되었습니다!');
    expect(screen.getByText('BhBX…W1aD')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '지갑 연결 해제' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(useModalStore.getState().isModalOpen).toBe(false);
  });

  it('closes the global dialog with cancel', () => {
    mockAuth();
    useModalStore.getState().openModal({ content: null });
    renderInDialog(<WalletConnectContent />);

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(useModalStore.getState().isModalOpen).toBe(false);
  });
});
