import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { initialCanvasConnection } from '../model/canvasConnection';
import { CanvasConnectionStatus } from './CanvasConnectionStatus';

describe('canvas automatic connection recovery', () => {
  it('leaves a healthy connection to the active connections display', () => {
    render(
      <CanvasConnectionStatus
        connection={{ ...initialCanvasConnection, status: 'ready', connectionCount: 42 }}
      />
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each(['initializing', 'reconnecting', 'failed'] as const)(
    'shows %s status without a manual retry button',
    status => {
      const { container } = render(
        <CanvasConnectionStatus
          connection={{ ...initialCanvasConnection, status, retryCount: 5 }}
        />
      );
      expect(screen.getByRole('status')).toBeTruthy();
      expect(container.querySelector('.canvas-connection')?.getAttribute('data-status')).toBe(
        status
      );
      expect(screen.queryByRole('button')).toBeNull();
    }
  );

  it('explains incompatible protocol without suggesting retries', () => {
    render(
      <CanvasConnectionStatus
        connection={{ ...initialCanvasConnection, status: 'failed', notice: 'protocol_error' }}
      />
    );
    expect(screen.getByRole('status').textContent).toContain('서버의 연결 규격');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
