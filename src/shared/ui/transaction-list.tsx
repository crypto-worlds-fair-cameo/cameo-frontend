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
  label = 'Transactions',
}: {
  items: TransactionItem[];
  label?: string;
}) {
  return (
    <ul className="cameo-transactions" aria-label={label}>
      {items.length === 0 ? (
        <li>No transactions.</li>
      ) : (
        items.map(item => (
          <li key={item.id}>
            <span>
              {item.label}
              {item.date && <small>{item.date}</small>}
            </span>
            <span data-direction={item.direction}>
              <span className="sr-only">
                {item.direction === 'outgoing' ? 'Outgoing ' : 'Incoming '}
              </span>
              {item.amount}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}
