import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';
import { Spinner } from './spinner';
import './ui.css';

const buttonVariants = cva('cameo-button', {
  variants: {
    variant: {
      default: 'cameo-button--primary',
      primary: 'cameo-button--primary',
      web3: 'cameo-button--web3',
      secondary: 'cameo-button--secondary',
      outline: 'cameo-button--secondary',
      ghost: 'cameo-button--ghost',
      glass: 'cameo-button--glass',
      destructive: 'cameo-button--destructive',
      link: 'cameo-button--link',
    },
    size: {
      default: 'cameo-button--md',
      md: 'cameo-button--md',
      sm: 'cameo-button--sm',
      lg: 'cameo-button--lg',
      icon: 'cameo-button--icon',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  onClick,
  onClickCapture,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  const unavailable = disabled || loading;
  return (
    <Comp
      {...props}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? 'button')}
      disabled={asChild ? undefined : unavailable}
      aria-disabled={unavailable || undefined}
      aria-busy={loading || undefined}
      onClickCapture={event => {
        if (unavailable) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClickCapture?.(event);
      }}
      onClick={event => {
        if (unavailable) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner aria-hidden="true" />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
