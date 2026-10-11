import { useTranslation } from 'react-i18next';
import type { CanvasMode } from '@/features/canvas-workspace';

/** 도화지 아래에서 현재 모드와 평생 한 획 규칙을 한 줄로 안내한다. */
export function CanvasStrokeNotice({
  mode,
  strokeUsed,
}: {
  mode: CanvasMode;
  strokeUsed: boolean;
}) {
  const { t } = useTranslation('mainCanvas');

  // 연습은 획 제한이 없으므로 규칙 대신 진행 중 표시를 보여준다.
  if (mode === 'practice') {
    return (
      <p className="canvas-stroke-notice">
        {t('strokeNotice.practice')}
        <span className="canvas-stroke-notice-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </p>
    );
  }
  // 이번 접속에서 한 획을 남겼거나 서버가 사용 완료를 알린 계정에는 결과를 안내한다.
  if (strokeUsed) return <p className="canvas-stroke-notice">{t('strokeNotice.used')}</p>;
  return (
    <p className="canvas-stroke-notice">
      {t('strokeNotice.description')}
      <span className="canvas-stroke-notice-badge">{t('strokeNotice.badge')}</span>
    </p>
  );
}
