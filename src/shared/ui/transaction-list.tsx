import type { ReactNode } from 'react';
import './ui.css';

type TransactionItem = {
  id: string;
  label: string;
  date?: string;
  amount: ReactNode;
  direction: 'incoming' | 'outgoing';
};
export function TransactionList({
  items,
  label = '거래 내역',
}: {
  items: TransactionItem[];
  label?: string;
}) {
  return (
    <ul className="cameo-transactions" aria-label={label}>
      {items.length === 0 ? (
        <li>거래 내역이 없습니다.</li>
      ) : (
        items.map(item => (
          <li key={item.id}>
            <span>
              {item.label}
              {item.date && <small>{item.date}</small>}
            </span>
            <span data-direction={item.direction}>
              <span className="sr-only">{item.direction === 'outgoing' ? '출금 ' : '입금 '}</span>
              {item.amount}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}
