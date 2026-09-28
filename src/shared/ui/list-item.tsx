import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import './ui.css';

export function MediaListItem({
  media,
  title,
  description,
  action,
}: {
  media: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <article className="cameo-media-list-item">
      <div className="cameo-media-list-image">{media}</div>
      <div className="cameo-list-copy">
        <h3>{title}</h3>
        <div>{description}</div>
      </div>
      {action}
    </article>
  );
}
export function DataRow({
  leading,
  items,
}: {
  leading?: ReactNode;
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <div className="cameo-data-row">
      {leading}
      <dl>
        {items.map(item => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
export function SelectionRow({
  icon,
  children,
  selected,
  className,
  ...props
}: ComponentProps<'button'> & { icon?: ReactNode; selected?: boolean }) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={selected}
      className={cn('cameo-selection-row', className)}
    >
      {icon && <span className="cameo-selection-icon">{icon}</span>}
      <span>{children}</span>
      {selected && (
        <span className="cameo-selection-check" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}
