import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWallets } from '@wallet-standard/app';
import type { Wallet } from '@wallet-standard/base';
import { forgetWalletChoice, rememberWalletChoice } from '@/shared/lib/solana-wallet/wallet-choice';
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

const registered: Array<() => void> = [];

/** 브라우저에 설치된 지갑처럼 지갑 공통 규격 목록에 등록한다. */
function installWallet(name: string) {
  const wallet = {
    version: '1.0.0',
    name,
    icon: `data:image/svg+xml;base64,${btoa(`<svg data-name="${name}"/>`)}`,
    chains: ['solana:mainnet', 'solana:devnet'],
    accounts: [],
    features: { 'solana:signIn': { version: '1.0.0', signIn: vi.fn() } },
  } as unknown as Wallet;
  registered.push(getWallets().register(wallet));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  for (const unregister of registered.splice(0)) unregister();
  forgetWalletChoice();
});

describe('wallet connect dialog', () => {
  it('shows Phantom with next and cancel actions before connecting', () => {
    const auth = mockAuth();
    renderInDialog(<WalletConnectContent />);

    expect(screen.getByText('Phantom')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(auth.connect).toHaveBeenCalledWith('Phantom', expect.any(Function));
    expect(screen.getByRole('button', { name: '취소' })).toBeTruthy();
  });

  it('lists every supported wallet and connects the one the user picks', () => {
    const auth = mockAuth();
    renderInDialog(<WalletConnectContent />);

    const rows = ['Phantom', 'Solflare', 'Backpack'].map(name =>
      screen.getByRole('button', { name: new RegExp(name) })
    );
    // 설치된 지갑이 없으면 첫 지갑(Phantom)을 골라 두고, 모두 설치 안 됨으로 표시한다.
    expect(rows.map(row => row.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(screen.getAllByText('설치 안 됨')).toHaveLength(3);

    fireEvent.click(rows[1]!);
    expect(rows[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('link', { name: 'Solflare 설치' }).getAttribute('href')).toBe(
      'https://solflare.com'
    );
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(auth.connect).toHaveBeenCalledWith('Solflare', expect.any(Function));
  });

  it('shows each wallet icon even before the wallet is installed', () => {
    mockAuth();
    renderInDialog(<WalletConnectContent />);

    const iconOf = (name: RegExp) =>
      screen.getByRole('button', { name }).querySelector('img')?.getAttribute('src');
    expect(iconOf(/Phantom/)).toBe('/images/phantom.svg');
    expect(iconOf(/Solflare/)).toBe('/images/solflare.svg');
    expect(iconOf(/Backpack/)).toBe('/images/backpack.png');
  });

  it('starts with the first installed wallet and uses its own icon', () => {
    installWallet('Backpack');
    const auth = mockAuth();
    renderInDialog(<WalletConnectContent />);

    const backpack = screen.getByRole('button', { name: /Backpack/ });
    expect(backpack.getAttribute('aria-pressed')).toBe('true');
    expect(backpack.textContent).not.toContain('설치 안 됨');
    expect(backpack.querySelector('img')?.getAttribute('src')).toContain('data:image/svg+xml');
    // 설치된 지갑을 골랐으면 설치 안내를 띄우지 않는다.
    expect(screen.queryByRole('link', { name: /설치/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(auth.connect).toHaveBeenCalledWith('Backpack', expect.any(Function));
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
    // 로그인에 쓴 지갑을 모르면 "지갑"이라고만 쓴다.
    expect(screen.getByText('BhBX…W1aD').parentElement?.textContent).toBe('지갑 BhBX…W1aD');
    expect(screen.queryByRole('button', { name: '지갑 연결 해제' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(useModalStore.getState().isModalOpen).toBe(false);
  });

  it('names the wallet the account signed in with on the connected view', () => {
    rememberWalletChoice('BhBXabcdefghW1aD', 'Solflare');
    mockAuth({
      session: {
        user: { id: 'user-1', displayName: 'GAEMI', avatarUrl: null, wallets: [] },
        activeWallet: { id: 'wallet-1', chainNamespace: 'solana', address: 'BhBXabcdefghW1aD' },
        session: { expiresAt: '2026-10-13T00:00:00Z', absoluteExpiresAt: '2026-10-19T00:00:00Z' },
      },
      walletAddress: 'BhBXabcdefghW1aD',
      isAuthenticated: true,
    });
    renderInDialog(<WalletConnectContent />);
    expect(screen.getByText('BhBX…W1aD').parentElement?.textContent).toBe('Solflare BhBX…W1aD');
  });

  it('closes the global dialog with cancel', () => {
    mockAuth();
    useModalStore.getState().openModal({ content: null });
    renderInDialog(<WalletConnectContent />);

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(useModalStore.getState().isModalOpen).toBe(false);
  });
});
