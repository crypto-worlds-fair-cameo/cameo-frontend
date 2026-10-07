import { useTranslation } from 'react-i18next';
import { Card } from '@/shared/ui/card';
import { formatDate, formatSol } from '../lib/profileFormat';

/** 가입일과 지갑 잔액 카드. */
export function ProfileSummary({ joinedAt, balanceSol }: { joinedAt: string; balanceSol: number }) {
  const { t, i18n } = useTranslation('profile');
  return (
    <div className="profile-summary">
      <Card>
        <dl>
          <dt>{t('summary.joined')}</dt>
          <dd>{formatDate(joinedAt, i18n.language)}</dd>
        </dl>
      </Card>
      <Card>
        <dl>
          <dt>{t('summary.balance')}</dt>
          <dd>{formatSol(balanceSol, i18n.language)}</dd>
        </dl>
      </Card>
    </div>
  );
}
