import { useTranslation } from 'react-i18next';
import type { CanvasSyncState } from '../model/canvasSync';

/** 연결 상태와 별도로 그림 복구·그리기 권한·서버 거절을 안내한다. */
export function CanvasSyncStatus({ sync }: { sync: CanvasSyncState }) {
  const { t } = useTranslation('mainCanvas');
  // 새 획의 사용 제한은 시도 시 모달에서 안내하므로 스탯 아래에는 중복 표시하지 않는다.
  if (sync.error?.code === 'STROKE_LIMIT_REACHED') return null;
  if (sync.error) {
    const key =
      sync.error.code === 'CANVAS_CAPACITY_REACHED'
        ? 'capacity'
        : sync.error.code === 'STROKE_ALREADY_USED'
          ? 'strokeAlreadyUsed'
          : ['AUTH_REQUIRED', 'USER_UNAVAILABLE'].includes(sync.error.code)
            ? 'auth'
            : sync.error.code === 'LOCAL_CAPACITY_REACHED'
              ? 'pendingCapacity'
              : 'error';
    return (
      <p className="canvas-sync-status" role="alert">
        {t(`sync.${key}`)}
      </p>
    );
  }
  // 일시 거절은 미확인 좌표를 유지하며 재시도한다. 영구 실패와 별도로 안내한다.
  if (sync.retry) {
    const key =
      sync.retry.code === 'CANVAS_CAPACITY_REACHED'
        ? 'capacity'
        : sync.retry.code === 'REALTIME_UNAVAILABLE'
          ? 'storageRetry'
          : 'retrying';
    return (
      <p className="canvas-sync-status" role="status">
        {t(`sync.${key}`)}
      </p>
    );
  }
  if (sync.status === 'recovering') {
    return (
      <p className="canvas-sync-status" role="status">
        {t('sync.recovering')}
      </p>
    );
  }
  // 포인터 종료 알림은 획 사용 안내이며, 마지막 ACK 대기 중에는 저장 완료로 표시하지 않는다.
  if (sync.status === 'ready' && sync.submissionStatus === 'saving') {
    return (
      <p className="canvas-sync-status" role="status">
        {t('sync.saving')}
      </p>
    );
  }
  // 사용 완료로 막힌 인증 계정에는 로그인 안내를 표시하지 않는다.
  if (sync.status === 'ready' && !sync.canDraw && !sync.strokeUsed) {
    return (
      <p className="canvas-sync-status" role="status">
        {t('sync.auth')}
      </p>
    );
  }
  return null;
}
