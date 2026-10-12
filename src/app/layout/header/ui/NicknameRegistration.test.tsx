import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedSession } from '@/entities/session';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
import { useWalletAuthentication } from '../model/useWalletAuthentication';
import { NicknameRegistrationContent } from './NicknameRegistration';
import { ProfileCreatedContent } from './ProfileCreatedContent';

vi.mock('../model/useWalletAuthentication', () => ({ useWalletAuthentication: vi.fn() }));

const session: AuthenticatedSession = {
  user: {
    id: 'user-1',
    displayName: null,
    avatarUrl: null,
    wallets: [{ chainNamespace: 'solana', address: 'CRp5abcdefghijklmnopqrstuvwxyzGPf8' }],
  },
  activeWallet: {
    id: 'wallet-1',
    chainNamespace: 'solana',
    address: 'CRp5abcdefghijklmnopqrstuvwxyzGPf8',
  },
  session: { expiresAt: '2026-10-12T00:00:00Z', absoluteExpiresAt: '2026-10-18T00:00:00Z' },
};

function mockSignedIn() {
  const auth: ReturnType<typeof useWalletAuthentication> = {
    session,
    walletAddress: session.activeWallet.address,
    isAuthenticated: true,
    checkingSession: false,
    isPending: false,
    errorKey: null,
    errorWalletName: undefined,
    connect: vi.fn(),
    saveNickname: vi.fn(),
    logout: vi.fn(),
  };
  vi.mocked(useWalletAuthentication).mockReturnValue(auth);
  return auth;
}

function renderInDialog(content: ReactNode) {
  render(
    <MemoryRouter>
      <Dialog open>
        <DialogContent>
          <DialogTitle>닉네임 만들기</DialogTitle>
          {content}
        </DialogContent>
      </Dialog>
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('nickname registration step', () => {
  it('blocks nicknames over 20 characters with the design message', () => {
    const auth = mockSignedIn();
    renderInDialog(<NicknameRegistrationContent />);

    expect(screen.getByText('0/20')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: 'a'.repeat(21) } });
    expect(screen.getByText('21/20')).toBeTruthy();
    expect(screen.getByText('20자 이내로 입력하세요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' }).hasAttribute('disabled')).toBe(true);
    expect(auth.saveNickname).not.toHaveBeenCalled();
  });

  it('opens the profile created step after saving', () => {
    const auth = mockSignedIn();
    renderInDialog(<NicknameRegistrationContent />);

    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: 'GAEMI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(auth.saveNickname).toHaveBeenCalledWith('GAEMI', expect.any(Function));

    vi.mocked(auth.saveNickname).mock.calls[0]![1]();
    const modal = useModalStore.getState();
    expect(modal.isModalOpen).toBe(true);
    expect(modal.title).toBe('프로필 생성 완료!');
    // 큰 완료 문구가 제목을 대신하므로 제목은 보조 기술에만 남긴다.
    expect(modal.titleClassName).toBe('sr-only');
    modal.closeModal();
  });
});

describe('profile created step', () => {
  it('links to the profile and closes the dialog from either action', () => {
    useModalStore.getState().openModal({ content: null });
    renderInDialog(<ProfileCreatedContent />);

    expect(screen.getByRole('status').textContent).toContain('프로필 생성 완료!');
    const profileLink = screen.getByRole('link', { name: '프로필 보기' });
    expect(profileLink.getAttribute('href')).toBe('/profile');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(useModalStore.getState().isModalOpen).toBe(false);
  });
});
