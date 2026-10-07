import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { TransactionList } from '@/shared/ui/transaction-list';
import type { ProfileTransaction } from '../api/profile.api';
import { formatMonthDay, formatSol } from '../lib/profileFormat';

/** 거래 내역. 빈 목록 문구는 공용 목록 대신 페이지 번역을 사용한다. */
export function ProfileTransactions({ transactions }: { transactions: ProfileTransaction[] }) {
  const { t, i18n } = useTranslation('profile');
  const titleId = useId();
  return (
    <section className="profile-section" aria-labelledby={titleId}>
      <div className="profile-section-header">
        <h2 id={titleId}>{t('transactions.title')}</h2>
      </div>
      {transactions.length === 0 ? (
        <p className="profile-empty">{t('transactions.empty')}</p>
      ) : (
        <TransactionList
          label={t('transactions.title')}
          items={transactions.map(transaction => ({
            id: transaction.id,
            label: transaction.label,
            date: formatMonthDay(transaction.occurredAt, i18n.language),
            amount: formatSol(transaction.amountSol, i18n.language),
            direction: transaction.amountSol < 0 ? 'outgoing' : 'incoming',
          }))}
        />
      )}
    </section>
  );
}
