import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import './ui.css';

type NavigationItem = { href: string; label: string; icon?: ReactNode };
export function Navigation({
  items,
  activeHref,
  label,
  variant = 'top',
  onNavigate,
}: {
  items: NavigationItem[];
  activeHref: string;
  label: string;
  variant?: 'top' | 'sidebar';
  onNavigate?: (href: string) => void;
}) {
  return (
    <nav aria-label={label} className={cn('cameo-navigation', `cameo-navigation--${variant}`)}>
      {items.map(item => (
        <a
          key={item.href}
          href={item.href}
          aria-current={activeHref === item.href ? 'page' : undefined}
          onClick={event => {
            if (
              onNavigate &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey
            ) {
              event.preventDefault();
              onNavigate(item.href);
            }
          }}
        >
          {item.icon}
          {item.label}
        </a>
      ))}
    </nav>
  );
}
