import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionQueryKey, type AuthenticatedSession } from '@/entities/session';
import { Button } from '@/shared/ui/button';
import { updateDisplayName, uploadProfileImage } from '../api/profile.api';
import { AVATAR_MAX_BYTES } from '../lib/profileValidation';
import { EditProfileDialog } from './EditProfileDialog';

vi.mock('../api/profile.api', async importOriginal => ({
  ...(await importOriginal<typeof import('../api/profile.api')>()),
  updateDisplayName: vi.fn(),
  uploadProfileImage: vi.fn(),
}));

const profileUser: AuthenticatedSession['user'] = {
  id: 'user-1',
  displayName: 'jisun',
  avatarUrl: null,
  wallets: [],
};
const savedAvatarUrl = 'https://api.example.test/profile-images/user-1/photo.png';

function httpError(status: number, data?: unknown) {
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data,
  } as AxiosResponse);
}

/** 실제 화면처럼 세션 캐시의 사용자로 수정 창을 그려, 저장 뒤 바뀐 닉네임이 다음 비교 기준이 되게 한다. */
function SessionEditor() {
  const { data } = useQuery<AuthenticatedSession | null>({
    queryKey: sessionQueryKey,
    queryFn: () => null,
    enabled: false,
  });
  return data ? <EditProfileDialog user={data.user} trigger={<Button>수정</Button>} /> : null;
}

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData<AuthenticatedSession>(sessionQueryKey, {
    user: profileUser,
    activeWallet: { id: 'wallet-1', chainNamespace: 'solana', address: 'wallet' },
    session: {
      expiresAt: '2026-10-20T00:00:00.000Z',
      absoluteExpiresAt: '2026-10-20T00:00:00.000Z',
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SessionEditor />
    </QueryClientProvider>
  );
  return queryClient;
}

function fileInput() {
  const input = document.querySelector<HTMLInputElement>('.profile-edit-form input[type=file]');
  expect(input).toBeTruthy();
  return input!;
}

function sessionUser(queryClient: QueryClient) {
  return queryClient.getQueryData<AuthenticatedSession>(sessionQueryKey)?.user;
}

describe('profile editor', () => {
  beforeEach(() => {
    // jsdom에는 미리보기 주소 API가 없어 고른 사진의 미리보기만 대신한다.
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });
  });

  it('shows an API nickname validation error inline and resets it when input changes', async () => {
    vi.mocked(updateDisplayName).mockRejectedValue(
      httpError(400, { code: 'USER_DISPLAY_NAME_INVALID' })
    );
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: '수정' }));
    const input = screen.getByRole('textbox', { name: '닉네임' });
    await user.clear(input);
    await user.type(input, 'invalid_name');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
    const help = document.getElementById(input.getAttribute('aria-describedby')!);
    expect(help?.className).toBe('cameo-field-error');
    expect(screen.getByRole('status').textContent).toBe(help?.textContent);
    expect(screen.getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(true);

    await user.type(input, '_new');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(screen.getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(false);
  });

  it('allows a valid nickname to save while an oversized profile image is rejected', async () => {
    vi.mocked(updateDisplayName).mockResolvedValue({ id: 'user-1', displayName: 'jisun_art' });
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: '수정' }));
    await user.upload(
      fileInput(),
      new File([new Uint8Array(AVATAR_MAX_BYTES + 1)], 'large.png', { type: 'image/png' })
    );
    expect(document.querySelector('.profile-edit-avatar-frame')?.getAttribute('data-state')).toBe(
      'error'
    );
    // 거절된 사진만으로는 저장할 수 없다.
    expect(screen.getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(true);
    const input = screen.getByRole('textbox', { name: '닉네임' });
    await user.clear(input);
    await user.type(input, 'jisun_art');
    expect(screen.getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(false);
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(vi.mocked(updateDisplayName).mock.lastCall?.[0]).toBe('jisun_art');
    expect(uploadProfileImage).not.toHaveBeenCalled();
  });

  it('uploads a newly selected image and updates the session avatar', async () => {
    vi.mocked(uploadProfileImage).mockResolvedValue({ id: 'user-1', avatarUrl: savedAvatarUrl });
    const user = userEvent.setup();
    const queryClient = renderEditor();
    await user.click(screen.getByRole('button', { name: '수정' }));
    const photo = new File([new Uint8Array(16)], 'photo.png', { type: 'image/png' });
    await user.upload(fileInput(), photo);

    expect(screen.getByText('새 사진 선택됨. 저장하면 적용됩니다.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(vi.mocked(uploadProfileImage).mock.lastCall?.[0]).toBe(photo);
    expect(updateDisplayName).not.toHaveBeenCalled();
    expect(sessionUser(queryClient)?.avatarUrl).toBe(savedAvatarUrl);
  });

  it('keeps a saved nickname when the image fails and retries only the image', async () => {
    vi.mocked(updateDisplayName).mockResolvedValue({ id: 'user-1', displayName: 'jisun_art' });
    vi.mocked(uploadProfileImage)
      .mockRejectedValueOnce(httpError(400, { code: 'USER_PROFILE_IMAGE_INVALID' }))
      .mockResolvedValueOnce({ id: 'user-1', avatarUrl: savedAvatarUrl });
    const user = userEvent.setup();
    const queryClient = renderEditor();
    await user.click(screen.getByRole('button', { name: '수정' }));
    const input = screen.getByRole('textbox', { name: '닉네임' });
    await user.clear(input);
    await user.type(input, 'jisun_art');
    await user.upload(
      fileInput(),
      new File([new Uint8Array(16)], 'photo.jpg', { type: 'image/jpeg' })
    );
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      '이 사진은 사용할 수 없습니다. 2MB 이하의 JPG 또는 PNG를 선택하세요.'
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(sessionUser(queryClient)?.displayName).toBe('jisun_art');

    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(updateDisplayName).toHaveBeenCalledTimes(1);
    expect(uploadProfileImage).toHaveBeenCalledTimes(2);
    expect(sessionUser(queryClient)?.avatarUrl).toBe(savedAvatarUrl);
  });
});
