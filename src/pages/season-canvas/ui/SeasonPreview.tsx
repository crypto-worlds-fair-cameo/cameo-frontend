import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasLivePreview } from '@/features/canvas-workspace';
import { useSeasonNftPreview } from '@/features/season-nft-claim';
import { cn } from '@/shared/lib/utils';
import type { SeasonStatus } from '../api/seasons.types';
import { useSeasonSnapshotPreview } from '../model/useSeasonSnapshotPreview';

/**
 * 진행 중 시즌은 서버가 주기적으로 찍은 최신 스냅샷을, 종료된 시즌은 확정 NFT 이미지(없으면 최종 스냅샷)를 표시한다.
 * 준비 전·조회 실패에는 빈 도화지처럼 흰 바탕만 둔다.
 * live를 받은 곳에서는 스냅샷을 먼저 보여 주고, 실시간 그림이 준비되면 그 위에 덮어 현재 그림을 보여 준다.
 * 서버의 시즌 상태와 참가 여부 배지를 함께 보여 준다.
 */
export function SeasonPreview({
  seasonId,
  status,
  joined = false,
  variant = 'card',
  live,
  className,
}: {
  seasonId?: string;
  status?: SeasonStatus;
  joined?: boolean;
  variant?: 'card' | 'detail';
  /** 시즌마다 연결을 하나씩 열므로 한 번에 하나만 보이는 상세 창에서만 켠다. */
  live?: { requiresSession: boolean };
  className: string;
}) {
  const { t } = useTranslation('seasonCanvas');
  const nftImageUrl = useSeasonNftPreview(seasonId, status === 'ended');
  const snapshotUrl = useSeasonSnapshotPreview(seasonId, status === 'active' || status === 'ended');
  const imageUrl = (status === 'ended' ? nftImageUrl : null) ?? snapshotUrl;
  const showLive = Boolean(live && seasonId && status === 'active');
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className={cn('season-preview', `season-preview--${variant}`, className)}>
      {showLive && live && seasonId && (
        <CanvasLivePreview
          key={seasonId}
          canvasKey={`season:${seasonId}`}
          requiresSession={live.requiresSession}
          label={t('liveCanvasPreview')}
          className="season-preview__live"
        />
      )}
      {/* 실패한 주소만 대체하여 다른 시즌이나 새 이미지가 도착하면 다시 표시한다. */}
      {imageUrl && imageUrl !== failedUrl && (
        <img
          src={imageUrl}
          alt={showLive ? '' : t(status === 'ended' ? 'finalCanvasPreview' : 'liveCanvasPreview')}
          loading="lazy"
          onError={() => setFailedUrl(imageUrl)}
        />
      )}
      {/* 아직 시즌 정보를 받지 못했으면 상태 배지를 표시하지 않는다. */}
      {status && (
        <span className={`season-preview__status season-preview__status--${status}`}>
          {t(`status.${status}`)}
        </span>
      )}
      {joined && <span className="season-preview__joined">{t('card.joined')}</span>}
    </div>
  );
}
