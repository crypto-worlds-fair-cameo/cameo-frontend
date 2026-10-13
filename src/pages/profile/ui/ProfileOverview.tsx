import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import type { ProfileTransaction } from '../api/profile.api';
import { useTransactionsQuery, useWalletBalanceQuery } from '../api/profile.queries';
import { formatActivityDate, formatDate, formatSol } from '../lib/profileFormat';

interface ProfileOverviewProps {
  userId: string;
  walletAddress: string;
  createdAt?: string;
}

/** 프로필 탭의 가입일·잔액 박스와 거래 내역. 모든 값은 서버가 확인한 기록에서 온다. */
export function ProfileOverview({ userId, walletAddress, createdAt }: ProfileOverviewProps) {
  const { t, i18n } = useTranslation('profile');
  const balance = useWalletBalanceQuery(walletAddress);
  const joined = createdAt ? formatDate(createdAt, i18n.language) : t('overview.unavailable');

  return (
    <section className="profile-overview">
      <dl className="profile-stats">
        <div>
          <dt>{t('overview.joined')}</dt>
          <dd>{joined}</dd>
        </div>
        <div>
          <dt>{t('overview.balance')}</dt>
          <dd aria-busy={balance.isPending || undefined}>
            {balance.data
              ? t('overview.sol', { amount: formatSol(balance.data.lamports, i18n.language, 4) })
              : t('overview.unavailable')}
          </dd>
        </div>
      </dl>
      <ProfileTransactions userId={userId} />
    </section>
  );
}

function ProfileTransactions({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation('profile');
  const titleId = useId();
  const query = useTransactionsQuery(userId);
  const items = useMemo(() => {
    const unique = new Map<string, ProfileTransaction>();
    for (const page of query.data?.pages ?? []) {
      for (const item of page.items) unique.set(item.id, item);
    }
    return [...unique.values()];
  }, [query.data]);

  return (
    <div className="profile-transactions">
      <h2 id={titleId}>{t('overview.transactions')}</h2>
      {query.isPending ? (
        <p role="status">{t('overview.loading')}</p>
      ) : query.isError && items.length === 0 ? (
        <div className="profile-activity-error" role="alert">
          <p>{t('overview.error')}</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {t('activityError.retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p>{t('overview.empty')}</p>
      ) : (
        <>
          <ul aria-labelledby={titleId}>
            {items.map(item => (
              <li key={item.id} title={item.seasonTitle}>
                <span className="profile-transaction-label">
                  {t(
                    item.direction === 'outgoing'
                      ? 'overview.seasonEntry'
                      : 'overview.entryReceived'
                  )}
                </span>
                <time dateTime={item.occurredAt}>
                  {formatActivityDate(item.occurredAt, i18n.language)}
                </time>
                <span className="profile-transaction-amount" data-direction={item.direction}>
                  {t(item.direction === 'outgoing' ? 'overview.paid' : 'overview.received', {
                    amount: formatSol(item.lamports, i18n.language),
                  })}
                </span>
              </li>
            ))}
          </ul>
          {query.hasNextPage && (
            <Button
              variant="secondary"
              size="sm"
              loading={query.isFetchingNextPage}
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t('overview.loadMore')}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
