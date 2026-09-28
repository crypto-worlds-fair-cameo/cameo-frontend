import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/utils';
import { Input } from './input';

export function DateTimePicker({
  type = 'datetime-local',
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { type?: 'date' | 'time' | 'datetime-local' }) {
  return <Input {...props} type={type} className={cn('cameo-date-time', className)} />;
}
