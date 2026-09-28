import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/utils';
import './ui.css';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input {...props} type={type} data-slot="input" className={cn('cameo-input', className)} />
  );
}
