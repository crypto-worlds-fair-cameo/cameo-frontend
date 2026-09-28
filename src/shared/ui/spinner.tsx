import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/utils';
import './ui.css';

export function Spinner({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      role="status"
      aria-label="처리 중"
      {...props}
      className={cn('cameo-spinner', className)}
    />
  );
}
