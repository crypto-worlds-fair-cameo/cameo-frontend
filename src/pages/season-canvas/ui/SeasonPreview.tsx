import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSeasonNftPreview } from '@/features/season-nft-claim';
import { cn } from '@/shared/lib/utils';
import type { SeasonStatus } from '../api/seasons.types';

/** 종료된 시즌의 확정 NFT 이미지를 표시하고, 준비 전·조회 실패에는 빈 미리보기를 유지한다. */
export function SeasonPreview({
  seasonId,
  status,
  className,
}: {
  seasonId?: string;
  status?: SeasonStatus;
  className: string;
}) {
  const { t } = useTranslation('seasonCanvas');
  const imageUrl = useSeasonNftPreview(seasonId, status === 'ended');
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className={cn('season-preview', className)}>
      {/* 실패한 주소만 대체하여 다른 시즌이나 새 이미지가 도착하면 다시 표시한다. */}
      {imageUrl && imageUrl !== failedUrl ? (
        <img
          src={imageUrl}
          alt={t('finalCanvasPreview')}
          loading="lazy"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <div className="season-preview__empty">
          <ImageOff aria-hidden="true" />
          <span>{t('previewUnavailable')}</span>
        </div>
      )}
      {/* 아직 시즌 정보를 받지 못했으면 상태 배지를 표시하지 않는다. */}
      {status && (
        <span className={`season-preview__status season-preview__status--${status}`}>
          {t(`status.${status}`)}
        </span>
      )}
    </div>
  );
}
