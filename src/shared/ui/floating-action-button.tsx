import { Button, type ButtonProps } from './button';
import { cn } from '@/shared/lib/utils';

export function FloatingActionButton({
  className,
  ...props
}: Omit<ButtonProps, 'size' | 'variant'> & { 'aria-label': string }) {
  return <Button {...props} size="icon" variant="primary" className={cn('cameo-fab', className)} />;
}
