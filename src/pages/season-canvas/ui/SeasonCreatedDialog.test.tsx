import { useRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SeasonCreatedDialog } from './SeasonCreatedDialog';

function CreatedHarness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [createdId, setCreatedId] = useState<string | null>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const fallbackRef = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  return (
    <>
      <h1 ref={fallbackRef} tabIndex={-1}>
        Seasons
      </h1>
      <button ref={openerRef} onClick={() => setCreatedId('season-42')}>
        Create complete
      </button>
      <output data-testid="current-path">{location.pathname}</output>
      <SeasonCreatedDialog
        createdId={createdId}
        onClose={() => {
          onClose();
          setCreatedId(null);
        }}
        restoreFocusTo={openerRef}
        fallbackFocusTo={fallbackRef}
      />
    </>
  );
}

describe('season created dialog actions', () => {
  it('opens the created season workspace and closes the notice', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={['/season-canvas']}>
        <CreatedHarness onClose={onClose} />
      </MemoryRouter>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Create complete' }));
    const link = screen.getByRole('link', { name: '내 시즌 보기' });
    expect(link.getAttribute('href')).toBe('/season-canvas/season-42');
    await user.click(link);
    expect(screen.getByTestId('current-path').textContent).toBe('/season-canvas/season-42');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses Done without navigating and restores opener focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={['/season-canvas']}>
        <CreatedHarness onClose={onClose} />
      </MemoryRouter>
    );
    const opener = screen.getByRole('button', { name: 'Create complete' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: '완료' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('current-path').textContent).toBe('/season-canvas');
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
