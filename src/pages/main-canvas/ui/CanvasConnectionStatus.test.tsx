import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { initialCanvasConnection } from '../model/canvasConnection';
import { CanvasConnectionStatus } from './CanvasConnectionStatus';

describe('canvas connection recovery controls', () => {
  it('leaves a healthy connection to the active users display', () => {
    render(
      <CanvasConnectionStatus
        connection={{ ...initialCanvasConnection, status: 'ready', connectionCount: 42 }}
        onRetry={vi.fn()}
      />
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('explains exhausted retries and offers a working manual retry', () => {
    const onRetry = vi.fn();
    render(
      <CanvasConnectionStatus
        connection={{
          ...initialCanvasConnection,
          status: 'failed',
          retryCount: 3,
          notice: 'retry_limit',
        }}
        onRetry={onRetry}
      />
    );
    expect(screen.getByRole('status').textContent).toContain('3회 재시도 후에도');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows retry progress but does not offer retry while the server is closing', () => {
    const { rerender } = render(
      <CanvasConnectionStatus
        connection={{ ...initialCanvasConnection, status: 'reconnecting', retryCount: 2 }}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByRole('status').textContent).toContain('재시도 2/3회');
    rerender(
      <CanvasConnectionStatus
        connection={{
          ...initialCanvasConnection,
          status: 'failed',
          transportConnected: true,
          notice: 'connection_policy',
        }}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByRole('status').textContent).toContain('연결 종료 대기 중');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not suggest retry for an incompatible protocol', () => {
    render(
      <CanvasConnectionStatus
        connection={{ ...initialCanvasConnection, status: 'failed', notice: 'protocol_error' }}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByRole('status').textContent).toContain('서버의 연결 규격');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
