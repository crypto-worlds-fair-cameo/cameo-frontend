import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedSession } from '@/entities/session';
import { Button } from '@/shared/ui/button';
import { updateDisplayName } from '../api/profile.api';
import { AVATAR_MAX_BYTES } from '../lib/profileValidation';
import { EditProfileDialog } from './EditProfileDialog';

vi.mock('../api/profile.api', async importOriginal => ({
  ...(await importOriginal<typeof import('../api/profile.api')>()),
  updateDisplayName: vi.fn(),
}));

const profileUser: AuthenticatedSession['user'] = {
  id: 'user-1',
  displayName: 'jisun',
  avatarUrl: null,
  wallets: [],
};

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <EditProfileDialog user={profileUser} trigger={<Button>수정</Button>} />
    </QueryClientProvider>
  );
}

describe('profile editor', () => {
  it('shows an API nickname validation error inline and resets it when input changes', async () => {
    vi.mocked(updateDisplayName).mockRejectedValue(
      new AxiosError('invalid', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status: 400,
        data: { code: 'USER_DISPLAY_NAME_INVALID' },
      } as AxiosResponse)
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
    const fileInput = document.querySelector<HTMLInputElement>(
      '.profile-edit-form input[type=file]'
    );
    expect(fileInput).toBeTruthy();
    await user.upload(
      fileInput!,
      new File([new Uint8Array(AVATAR_MAX_BYTES + 1)], 'large.png', { type: 'image/png' })
    );
    expect(document.querySelector('.profile-edit-avatar-frame')?.getAttribute('data-state')).toBe(
      'error'
    );
    const input = screen.getByRole('textbox', { name: '닉네임' });
    await user.clear(input);
    await user.type(input, 'jisun_art');
    expect(screen.getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(false);
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(vi.mocked(updateDisplayName).mock.lastCall?.[0]).toBe('jisun_art');
  });
});
