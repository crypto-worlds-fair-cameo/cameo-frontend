import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CanvasHistoryItem } from '../api/history.types';
import { formatSnapshotDate, formatSnapshotTime } from '../lib/historyFormat';

interface SnapshotCardProps {
  item: CanvasHistoryItem;
  isLatest: boolean;
  onOpen: () => void;
}

export function SnapshotCard({ item, isLatest, onOpen }: SnapshotCardProps) {
  const { t, i18n } = useTranslation('history');
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const date = formatSnapshotDate(item.capturedAt, i18n.language);
  const time = formatSnapshotTime(item.capturedAt, i18n.language);

  return (
    <button
      type="button"
      className="history-card"
      aria-label={t('openSnapshot', { date, time })}
      onClick={onOpen}
    >
      <span className="history-card__frame">
        {failedUrl === item.imageUrl ? (
          <span className="history-card__fallback">
            <ImageOff aria-hidden="true" />
            {t('imageUnavailable')}
          </span>
        ) : (
          <img
            src={item.imageUrl}
            alt=""
            width={item.width}
            height={item.height}
            loading="lazy"
            decoding="async"
            onError={() => setFailedUrl(item.imageUrl)}
          />
        )}
        {(isLatest || item.isFinal) && (
          <span className="history-badge">{isLatest ? t('latest') : t('final')}</span>
        )}
      </span>
      <span className="history-card__time">
        {date} · {time}
      </span>
    </button>
  );
}
