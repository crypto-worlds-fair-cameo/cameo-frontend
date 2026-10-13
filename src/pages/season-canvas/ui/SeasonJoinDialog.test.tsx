import { useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openWalletConnectDialog } from '@/app/layout/header/model/openWalletConnectDialog';
import type { SeasonJoinNotice } from '../model/useSeasonJoinFlow';
import { SeasonJoinDialog } from './SeasonJoinDialog';

vi.mock('@/app/layout/header/model/openWalletConnectDialog', () => ({
  openWalletConnectDialog: vi.fn(),
}));

function JoinHarness({
  onClose,
  initial = { kind: 'wallet' },
}: {
  onClose: () => void;
  initial?: SeasonJoinNotice;
}) {
  const [notice, setNotice] = useState<SeasonJoinNotice | null>(initial);
  const openerRef = useRef<HTMLElement>(null);
  const fallbackRef = useRef<HTMLHeadingElement>(null);
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <h1 ref={fallbackRef} tabIndex={-1}>
        Seasons
      </h1>
      <SeasonJoinDialog
        notice={notice}
        joiningId={null}
        onClose={() => {
          onClose();
          setNotice(null);
        }}
        onPay={vi.fn()}
        onRetry={vi.fn()}
        restoreFocusTo={openerRef}
        fallbackFocusTo={fallbackRef}
      />
    </QueryClientProvider>
  );
}

beforeEach(() => vi.mocked(openWalletConnectDialog).mockClear());

describe('season join dialog', () => {
  it('lets a guest open the wallet dialog from the join notice', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <JoinHarness onClose={onClose} />
      </MemoryRouter>
    );
    const dialog = screen.getByRole('dialog', { name: '방에 입장하려면 지갑을 연결하세요.' });
    expect(dialog.getAttribute('aria-describedby')).toBeNull();
    expect(dialog.textContent).not.toContain('오른쪽 위');
    await user.click(screen.getByRole('button', { name: '지갑 연결' }));
    expect(openWalletConnectDialog).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lets a guest open the wallet dialog when creating a season', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <JoinHarness onClose={onClose} initial={{ kind: 'wallet', action: 'create' }} />
      </MemoryRouter>
    );
    const dialog = screen.getByRole('dialog', { name: '지갑을 연결하고 시즌을 만드세요.' });
    expect(dialog.getAttribute('aria-describedby')).toBeNull();
    expect(dialog.textContent).not.toContain('오른쪽 위');
    await user.click(screen.getByRole('button', { name: '지갑 연결' }));
    expect(openWalletConnectDialog).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
