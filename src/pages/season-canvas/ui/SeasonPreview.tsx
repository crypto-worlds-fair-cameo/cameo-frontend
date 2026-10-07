import { ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import type { SeasonStatus } from '../api/seasons.types';

/** 카드와 상세 모달에 이미지 없음 표시와 서버의 시즌 상태를 함께 보여 준다. */
export function SeasonPreview({ status, className }: { status?: SeasonStatus; className: string }) {
  const { t } = useTranslation('seasonCanvas');
  return (
    <div className={cn('season-preview', className)}>
      <div className="season-preview__empty">
        <ImageOff aria-hidden="true" />
        <span>{t('previewUnavailable')}</span>
      </div>
      {/* 아직 시즌 정보를 받지 못했으면 상태 배지를 표시하지 않는다. */}
      {status && (
        <span className={`season-preview__status season-preview__status--${status}`}>
          {t(`status.${status}`)}
        </span>
      )}
    </div>
  );
}
