import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

interface SurfaceCardProps {
  children: ReactNode;
  className?: string;
}

const SurfaceCard = ({ children, className }: SurfaceCardProps) => {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-[var(--shadow-card)]',
        className
      )}
    >
      {children}
    </section>
  );
};

export default SurfaceCard;
