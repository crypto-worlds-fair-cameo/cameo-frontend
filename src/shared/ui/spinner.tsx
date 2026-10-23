import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/utils';
import './ui.css';

export function Spinner({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      role="status"
      aria-label="Loading"
      {...props}
      className={cn('cameo-spinner', className)}
    />
  );
}
