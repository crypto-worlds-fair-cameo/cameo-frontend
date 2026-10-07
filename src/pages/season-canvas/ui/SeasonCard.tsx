import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/shared/ui/card';
import type { Season } from '../api/seasons.types';
import { formatSeasonDateRange, getSeasonDaysRemaining } from '../lib/seasonDate';
import { SeasonPreview } from './SeasonPreview';

/** 이미지 없음 표시와 서버의 시즌 기간·참가 현황을 보여 주고 상세 화면을 연다. */
export function SeasonCard({
  season,
  onOpen,
}: {
  season: Season;
  onOpen: (opener: HTMLButtonElement) => void;
}) {
  const { t, i18n } = useTranslation('seasonCanvas');
  // 참가 등록은 영구 자리를 사용하므로 정원에서 누적 참가 인원을 빼서 남은 자리를 표시한다.
  const remaining = Math.max(0, season.capacity - season.participantCount);
  const capacity = Math.max(1, season.capacity);
  const registered = Math.min(capacity, Math.max(0, season.participantCount));
  const daysRemaining = getSeasonDaysRemaining(season);
  // 조기 종료 기록이 있으면 예정 종료일 대신 실제 종료일까지의 기간을 보여 준다.
  const dateRange = formatSeasonDateRange(
    season.startsAt,
    season.forceEndedAt ?? season.endsAt,
    i18n.language
  );

  return (
    <Card className="season-card">
      <SeasonPreview status={season.status} className="season-card__preview" />
      <div className="season-card__body">
        <h2>
          {/* 카드 클릭으로 상세를 열고, 모달을 닫을 때 이 버튼으로 초점을 돌려준다. */}
          <button
            type="button"
            className="season-card__open"
            aria-label={`${t('card.details')}: ${season.title}`}
            onClick={event => onOpen(event.currentTarget)}
          >
            <span className="season-card__title">{season.title}</span>
          </button>
        </h2>
        <p className="season-card__dates">
          <span>{dateRange}</span>
          {/* 예약·진행 시즌에만 예정 종료일까지 남은 일수를 표시한다. */}
          {daysRemaining !== null && (
            <span title={t('card.daysRemaining', { count: daysRemaining })}>
              · D-{daysRemaining}
            </span>
          )}
        </p>
        <div className="season-card__footer">
          <span
            className="season-card__participants"
            aria-label={t('card.participants', {
              count: season.participantCount,
              capacity: season.capacity,
            })}
          >
            <UserRound aria-hidden="true" />
            {season.participantCount}/{season.capacity}
          </span>
          <progress
            className="season-card__capacity"
            max={capacity}
            value={registered}
            aria-label={t('detail.participants')}
          />
          <span className="season-card__remaining">
            {t('card.remaining', { count: remaining })}
          </span>
        </div>
      </div>
    </Card>
  );
}
