import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import type { CanvasConnectionState } from '../model/canvasConnection';
import { MAX_CANVAS_RETRIES } from '../config/canvasConnectionPolicy';

interface CanvasConnectionStatusProps {
  connection: CanvasConnectionState;
  onRetry: () => void;
}

export function CanvasConnectionStatus({ connection, onRetry }: CanvasConnectionStatusProps) {
  const { t } = useTranslation('mainCanvas');
  const { status, connectionCount, notice, transportConnected, retryCount } = connection;
  const canRetry = status === 'failed' && !transportConnected && notice !== 'protocol_error';
  const ending =
    transportConnected && (notice === 'server_shutdown' || notice === 'connection_policy');

  return (
    <div className="canvas-connection" data-status={status}>
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="canvas-connection-label">
          <span className="canvas-connection-dot" aria-hidden="true" />
          {t(`connection.${ending ? 'ending' : status}`)}
          {status === 'reconnecting' && !ending && retryCount > 0 && (
            <span>
              {t('connection.retryProgress', { count: retryCount, max: MAX_CANVAS_RETRIES })}
            </span>
          )}
          {status === 'ready' && connectionCount !== null && (
            <span>{t('connection.count', { count: connectionCount })}</span>
          )}
        </p>
        {notice && <p className="canvas-connection-notice">{t(`connection.${notice}`)}</p>}
      </div>
      {canRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
