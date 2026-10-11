import { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { SeasonJoinNotice } from '../model/useSeasonJoinFlow';
import { SeasonJoinDialog } from './SeasonJoinDialog';

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
  return (
    <>
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
        onRetry={vi.fn()}
        restoreFocusTo={openerRef}
        fallbackFocusTo={fallbackRef}
      />
    </>
  );
}

describe('season join dialog', () => {
  it('points a guest to the header wallet button and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <JoinHarness onClose={onClose} />
      </MemoryRouter>
    );
    const dialog = screen.getByRole('dialog', { name: '지갑을 연결하고 시즌에 입장하세요.' });
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(dialog.textContent).toContain('오른쪽 위의 지갑 연결 버튼');
    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the create-season title when a guest tries to create a season', () => {
    render(
      <MemoryRouter>
        <JoinHarness onClose={vi.fn()} initial={{ kind: 'wallet', action: 'create' }} />
      </MemoryRouter>
    );
    const dialog = screen.getByRole('dialog', { name: '지갑을 연결하고 시즌을 만드세요.' });
    expect(dialog.textContent).toContain('오른쪽 위의 지갑 연결 버튼');
  });
});
