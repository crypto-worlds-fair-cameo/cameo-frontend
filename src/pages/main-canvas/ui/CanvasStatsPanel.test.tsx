import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { initialCanvasConnection } from '../model/canvasConnection';
import { CanvasStatsPanel } from './CanvasStatsPanel';

describe('canvas stats presence', () => {
  it('updates the received count and preserves zero as a known count', () => {
    const { rerender } = render(
      <CanvasStatsPanel
        connection={{ ...initialCanvasConnection, status: 'ready', connectionCount: 42 }}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByRole('definition').textContent).toBe('42');
    expect(screen.queryByText('준비 완료')).toBeNull();
    rerender(
      <CanvasStatsPanel
        connection={{ ...initialCanvasConnection, status: 'ready', connectionCount: 0 }}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByRole('definition').textContent).toBe('0');
  });

  it('does not present an old count while connecting or reconnecting', () => {
    const { rerender } = render(
      <CanvasStatsPanel connection={initialCanvasConnection} onRetry={vi.fn()} />
    );
    expect(screen.getByRole('definition').textContent).toBe('—');
    expect(screen.getByRole('status').textContent).toContain('연결 중');
    rerender(
      <CanvasStatsPanel
        connection={{ ...initialCanvasConnection, status: 'reconnecting', connectionCount: 42 }}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByRole('definition').textContent).toBe('—');
    expect(screen.getByRole('status').textContent).toContain('재연결 중');
  });
});
