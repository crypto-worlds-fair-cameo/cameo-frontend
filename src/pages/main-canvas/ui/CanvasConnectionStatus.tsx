import { useTranslation } from 'react-i18next';
import type { CanvasConnectionState } from '@/features/canvas-workspace';

interface CanvasConnectionStatusProps {
  connection: CanvasConnectionState;
}

/** 자동 접속, 준비 대기와 복구 실패 안내를 통계 패널에 표시한다. */
export function CanvasConnectionStatus({ connection }: CanvasConnectionStatusProps) {
  const { t } = useTranslation('mainCanvas');
  const { status, notice, retryCount } = connection;
  // 정상 연결은 통계의 연결 수로 나타내고 연결 안내는 숨긴다.
  if (status === 'ready' && !notice) return null;

  return (
    <div className="canvas-connection" data-status={status}>
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="canvas-connection-label">
          <span className="canvas-connection-dot" aria-hidden="true" />
          {t(`connection.${status}`)}
          {/* 자동 복구가 실제 시작된 이후에만 진행 중인 재시도 횟수를 표시한다. */}
          {status === 'reconnecting' && retryCount > 0 && (
            <span>{t('connection.retryProgress', { count: retryCount })}</span>
          )}
        </p>
        {/* 서버 또는 네트워크 사유가 있을 때 상태 아래에 해당 안내를 덧붙인다. */}
        {notice && <p className="canvas-connection-notice">{t(`connection.${notice}`)}</p>}
      </div>
    </div>
  );
}
