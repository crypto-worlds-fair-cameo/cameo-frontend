import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import './error-state.css';

interface ErrorStateProps {
  symbol: ReactNode;
  title: string;
  description: string;
  actions: ReactNode;
  fullScreen?: boolean;
  role?: 'alert';
}

export function ErrorState({
  symbol,
  title,
  description,
  actions,
  fullScreen = false,
  role,
}: ErrorStateProps) {
  return (
    <section className={cn('error-state', fullScreen && 'error-state--fullscreen')} role={role}>
      <div className="error-state__content">
        <div className="error-state__symbol" aria-hidden="true">
          {symbol}
        </div>
        <h1 className="error-state__title">{title}</h1>
        <p className="error-state__description">{description}</p>
        <div className="error-state__actions">{actions}</div>
      </div>
    </section>
  );
}
