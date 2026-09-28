import { Search } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/utils';
import { Input } from './input';

export function SearchInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <div className="cameo-search">
      <Search size={14} aria-hidden="true" />
      <Input {...props} type="search" className={cn('cameo-search-input', className)} />
    </div>
  );
}
