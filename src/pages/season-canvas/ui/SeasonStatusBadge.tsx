import { useTranslation } from 'react-i18next';
import type { SeasonStatus } from '../api/seasons.types';

export function SeasonStatusBadge({ status }: { status: SeasonStatus }) {
  const { t } = useTranslation('seasonCanvas');
  return <span className={`season-status season-status--${status}`}>{t(`status.${status}`)}</span>;
}
