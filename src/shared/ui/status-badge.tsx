import type { ReactNode } from 'react';
import './ui.css';

export function StatusBadge({
  status,
  children,
}: {
  status: 'active' | 'ended';
  children?: ReactNode;
}) {
  return (
    <span className={`cameo-status cameo-status--${status}`}>
      {status === 'active' && <span className="cameo-status-dot" aria-hidden="true" />}
      {children ?? (status === 'active' ? 'Active' : 'Ended')}
    </span>
  );
}
