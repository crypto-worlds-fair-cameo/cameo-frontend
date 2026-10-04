import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { initialCanvasConnection } from '../model/canvasConnection';
import { CanvasStatsPanel } from './CanvasStatsPanel';

describe('canvas stats presence', () => {
  it('updates the received active connection count', () => {
    const { rerender } = render(
      <CanvasStatsPanel
        connection={{ ...initialCanvasConnection, status: 'ready', connectionCount: 42 }}
      />
    );
    expect(screen.getByRole('definition').textContent).toBe('42');
    expect(screen.queryByText('준비 완료')).toBeNull();
    rerender(
      <CanvasStatsPanel
        connection={{ ...initialCanvasConnection, status: 'ready', connectionCount: 1 }}
      />
    );
    expect(screen.getByRole('definition').textContent).toBe('1');
  });

  it.each(['connecting', 'initializing', 'reconnecting', 'failed'] as const)(
    'hides stale counts while %s',
    status => {
      render(
        <CanvasStatsPanel
          connection={{ ...initialCanvasConnection, status, connectionCount: 42 }}
        />
      );
      expect(screen.getByRole('definition').textContent).toBe('—');
      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.getAllByRole('button')).toHaveLength(1);
    }
  );
});
