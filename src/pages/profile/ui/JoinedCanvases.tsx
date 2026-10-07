import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';
import { MediaListItem } from '@/shared/ui/list-item';
import { StatusBadge } from '@/shared/ui/status-badge';
import type { JoinedCanvas } from '../api/profile.api';
import { formatDateRange } from '../lib/profileFormat';
import { SeasonThumbnail } from './SeasonThumbnail';

/** 참여한 시즌 캔버스와 내가 그린 획 수. */
export function JoinedCanvases({ canvases }: { canvases: JoinedCanvas[] }) {
  const { t, i18n } = useTranslation('profile');
  const titleId = useId();
  return (
    <section className="profile-section" aria-labelledby={titleId}>
      <div className="profile-section-header">
        <h2 id={titleId}>{t('joined.title')}</h2>
      </div>
      {canvases.length === 0 ? (
        <div className="profile-empty">
          <p>{t('joined.empty')}</p>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/season-canvas">{t('joined.browse')}</Link>
          </Button>
        </div>
      ) : (
        <ul className="profile-list">
          {canvases.map(canvas => (
            <li key={canvas.id}>
              <MediaListItem
                media={<SeasonThumbnail colors={canvas.thumbnail} />}
                title={canvas.title}
                description={[
                  formatDateRange(canvas.startsAt, canvas.endsAt, i18n.language),
                  canvas.minted ? t('seasons.minted') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                action={
                  <div className="profile-list-actions">
                    <span className="profile-strokes">
                      {t('joined.strokes', { count: canvas.strokeCount })}
                    </span>
                    <StatusBadge status={canvas.status}>{t(`status.${canvas.status}`)}</StatusBadge>
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
