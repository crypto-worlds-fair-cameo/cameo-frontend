import { useTranslation } from 'react-i18next';
import type { CanvasMode } from '../model/useCanvasMode';

/** 모드 전환 버튼 아래에서 실제 그리기와 연습의 규칙을 짧게 안내한다. */
export function CanvasStrokeNotice({ mode }: { mode: CanvasMode }) {
  const { t } = useTranslation('mainCanvas');

  return (
    <p className="canvas-stroke-notice">
      {/* 연습에서는 평생 획 제한이 적용되지 않으므로 비공개 반복 연습을 안내한다. */}
      {t(mode === 'practice' ? 'strokeNotice.practiceDescription' : 'strokeNotice.description')}
    </p>
  );
}
