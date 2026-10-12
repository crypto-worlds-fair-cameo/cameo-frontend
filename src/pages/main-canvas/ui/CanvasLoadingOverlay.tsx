import { useTranslation } from 'react-i18next';
import { Spinner } from '@/shared/ui/spinner';

/** 첫 진입에서 공유 그림을 받는 동안 빈 도화지로 오해하지 않게 도화지 가운데에 불러오는 중을 표시한다. */
export function CanvasLoadingOverlay() {
  const { t } = useTranslation('mainCanvas');
  return (
    <div className="main-canvas-loading" role="status">
      <Spinner aria-hidden="true" className="main-canvas-loading__spinner" />
      <p>{t('sync.recovering')}</p>
    </div>
  );
}
