import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/utils';
import './ui.css';

export function GlassPanel({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('cameo-glass-panel', className)} />;
}
