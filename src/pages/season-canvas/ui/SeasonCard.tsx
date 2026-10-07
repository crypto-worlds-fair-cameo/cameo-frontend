import { CalendarClock, Maximize2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import type { Season } from '../api/seasons.types';
import { formatSeasonDate } from '../lib/seasonDate';
import { SeasonStatusBadge } from './SeasonStatusBadge';

export function SeasonCard({
  season,
  onOpen,
}: {
  season: Season;
  onOpen: (opener: HTMLButtonElement) => void;
}) {
  const { t, i18n } = useTranslation('seasonCanvas');
  return (
    <Card className="season-card">
      <div className="season-card__header">
        <div className="season-card__title-wrap">
          <SeasonStatusBadge status={season.status} />
          <h2>{season.title}</h2>
        </div>
        <div className="season-card__flags">
          {season.isCreator && <span>{t('card.creator')}</span>}
          {season.isParticipant && <span>{t('card.participant')}</span>}
        </div>
      </div>
      {season.description && <p className="season-card__description">{season.description}</p>}
      <ul className="season-card__facts">
        <li>
          <Users aria-hidden="true" />
          <span>
            {t('card.participants', { count: season.participantCount, capacity: season.capacity })}
          </span>
        </li>
        <li>
          <Maximize2 aria-hidden="true" />
          <span>{t('card.size', { width: season.width, height: season.height })}</span>
        </li>
        <li>
          <CalendarClock aria-hidden="true" />
          <span>
            {t('card.startsAt', { date: formatSeasonDate(season.startsAt, i18n.language) })}
          </span>
        </li>
        <li>
          <CalendarClock aria-hidden="true" />
          <span>
            {t(season.forceEndedAt ? 'card.actualEnd' : 'card.endsAt', {
              date: formatSeasonDate(season.forceEndedAt ?? season.endsAt, i18n.language),
            })}
          </span>
        </li>
      </ul>
      <div className="season-card__footer">
        <span>
          {season.strokeLimitPerUser === null
            ? t('card.unlimited')
            : t('card.strokes', { count: season.strokeLimitPerUser })}
        </span>
        <Button variant="secondary" size="sm" onClick={event => onOpen(event.currentTarget)}>
          {t('card.details')}
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to={`/season-canvas/${season.id}`}>{t('workspace.watch')}</Link>
        </Button>
      </div>
    </Card>
  );
}
