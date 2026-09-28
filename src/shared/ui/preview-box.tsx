import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/utils';
import './ui.css';

export function PreviewBox({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('cameo-preview-box', className)} />;
}
