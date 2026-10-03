import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import type { CanvasConnectionState } from '../model/canvasConnection';
import { MAX_CANVAS_RETRIES } from '../config/canvasConnectionPolicy';

interface CanvasConnectionStatusProps {
  connection: CanvasConnectionState;
  onRetry: () => void;
}

/** 페이지가 전달한 연결 상태를 안내로 표시하고, 허용된 수동 재시도 요청을 페이지에 돌려준다. */
export function CanvasConnectionStatus({ connection, onRetry }: CanvasConnectionStatusProps) {
  const { t } = useTranslation('mainCanvas');
  const { status, connectionCount, notice, transportConnected, retryCount } = connection;
  // 연결이 실제로 끝난 일반 실패만 수동 재시도를 제공하며, 규격 오류는 재접속 버튼을 숨긴다.
  const canRetry = status === 'failed' && !transportConnected && notice !== 'protocol_error';
  // 종료 안내를 받은 연결이 유지되면 종료 대기로 표시하고, 그 외에는 전달받은 status를 표시한다.
  const ending =
    transportConnected && (notice === 'server_shutdown' || notice === 'connection_policy');

  return (
    <div className="canvas-connection" data-status={status}>
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="canvas-connection-label">
          <span className="canvas-connection-dot" aria-hidden="true" />
          {t(`connection.${ending ? 'ending' : status}`)}
          {/* 종료 대기가 아닌 재연결에서 실제 재시도가 시작됐을 때만 사용 횟수와 한도를 표시한다. */}
          {status === 'reconnecting' && !ending && retryCount > 0 && (
            <span>
              {t('connection.retryProgress', { count: retryCount, max: MAX_CANVAS_RETRIES })}
            </span>
          )}
          {/* 서버 준비가 완료되고 연결 수가 있을 때만 탭·기기를 포함한 연결 수를 표시한다. */}
          {status === 'ready' && connectionCount !== null && (
            <span>{t('connection.count', { count: connectionCount })}</span>
          )}
        </p>
        {/* 종료·오류 사유가 있으면 해당 안내를 추가하고, 사유가 없으면 상태 문구만 표시한다. */}
        {notice && <p className="canvas-connection-notice">{t(`connection.${notice}`)}</p>}
      </div>
      {/* 재시도 가능한 실패에서만 버튼을 표시하며, 클릭 시 상위 페이지의 연결 제어 함수를 호출한다. */}
      {canRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
