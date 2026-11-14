import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/shared/ui/spinner';

/**
 * 첫 진입에서 공유 그림을 받는 동안 빈 도화지로 오해하지 않게 도화지 위에 불러오는 중을 표시한다.
 * 서버가 미리 줄여 둔 그림을 받으면 도화지에 맞춰 먼저 보여 주고, 안내는 그림을 가리지 않게 아래쪽에 작게 둔다.
 */
export function CanvasLoadingOverlay({ previewImageUrl }: { previewImageUrl?: string | null }) {
  const { t } = useTranslation('mainCanvas');
  // 다 받은 그림만 보여 준다. 더 새로운 주소가 오면 뒤에서 받아 두었다가 준비되면 바꿔 깜빡임을 없앤다.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  // 불러오지 못한 주소만 건너뛰어, 새 주소가 오면 다시 시도한다.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const pendingUrl =
    previewImageUrl && previewImageUrl !== failedUrl && previewImageUrl !== loadedUrl
      ? previewImageUrl
      : null;
  return (
    <div className="main-canvas-loading" role="status" data-preview={loadedUrl ? '' : undefined}>
      {loadedUrl && <img className="main-canvas-loading__preview" src={loadedUrl} alt="" />}
      {pendingUrl && (
        <img
          className="main-canvas-loading__preview main-canvas-loading__preview--pending"
          src={pendingUrl}
          alt=""
          decoding="async"
          fetchPriority="high"
          onLoad={() => setLoadedUrl(pendingUrl)}
          onError={() => setFailedUrl(pendingUrl)}
        />
      )}
      <div className="main-canvas-loading__status">
        <Spinner aria-hidden="true" className="main-canvas-loading__spinner" />
        <p>{t('sync.recovering')}</p>
      </div>
    </div>
  );
}
