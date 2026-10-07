import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { initialCanvasSync } from '@/features/canvas-workspace';
import { CanvasSyncStatus } from './CanvasSyncStatus';

describe('canvas account stroke guidance', () => {
  it.each(['CANVAS_CAPACITY_REACHED', 'REALTIME_UNAVAILABLE'])(
    'explains automatic retries for %s without claiming transmission has stopped',
    code => {
      render(
        <CanvasSyncStatus
          sync={{ ...initialCanvasSync, retry: { code, message: 'Temporary failure' } }}
        />
      );
      expect(screen.getByRole('status').textContent).toContain('자동으로 재전송');
      expect(screen.queryByRole('alert')).toBeNull();
    }
  );

  it('shows saving only until the final ACK is confirmed, without a used-stroke panel', () => {
    const sync = { ...initialCanvasSync, status: 'ready' as const, strokeUsed: true };
    const { rerender } = render(
      <CanvasSyncStatus sync={{ ...sync, submissionStatus: 'saving' }} />
    );
    expect(screen.getByRole('status').textContent).toContain('저장하는 중');
    rerender(<CanvasSyncStatus sync={{ ...sync, submissionStatus: 'saved' }} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not add a panel while the consumed stroke is still being drawn or sent', () => {
    render(
      <CanvasSyncStatus
        sync={{
          ...initialCanvasSync,
          status: 'ready',
          userId: 'user-a',
          strokeUsed: true,
          optimisticStrokes: [
            {
              stroke: {
                brush: { brushType: 'round', brushSize: 12, color: '#ED4242' },
                points: [{ x: 100, y: 200 }],
              },
              acknowledgedPoints: 1,
            },
          ],
        }}
      />
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('does not show a usage panel or login prompt after an authenticated account finishes drawing', () => {
    render(
      <CanvasSyncStatus
        sync={{ ...initialCanvasSync, status: 'ready', userId: 'user-a', strokeUsed: true }}
      />
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('leaves a new stroke limit refusal to the dialog instead of duplicating it in stats', () => {
    render(
      <CanvasSyncStatus
        sync={{
          ...initialCanvasSync,
          strokeUsed: true,
          error: { code: 'STROKE_LIMIT_REACHED', message: 'Server refusal' },
        }}
      />
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still explains an unrecoverable past stroke', () => {
    render(
      <CanvasSyncStatus
        sync={{
          ...initialCanvasSync,
          strokeUsed: true,
          error: { code: 'STROKE_ALREADY_USED', message: 'Server refusal' },
        }}
      />
    );
    expect(screen.getByRole('alert').textContent).toContain('복구할 수 없어');
  });

  it('still offers guests practice and does not show remaining usage for a fresh authenticated connection', () => {
    const { rerender } = render(
      <CanvasSyncStatus sync={{ ...initialCanvasSync, status: 'ready' }} />
    );
    expect(screen.getByRole('status').textContent).toContain('지갑을 연결');
    rerender(
      <CanvasSyncStatus
        sync={{ ...initialCanvasSync, status: 'ready', userId: 'user-a', canDraw: true }}
      />
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
