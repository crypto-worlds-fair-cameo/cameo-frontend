import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import './ui.css';

export function Card({ className, ...props }: ComponentProps<'article'>) {
  return <article {...props} className={cn('cameo-card', className)} />;
}
export function MediaCard({
  media,
  title,
  meta,
  children,
}: {
  media: ReactNode;
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="cameo-media-card">
      <div className="cameo-media-card-image">{media}</div>
      <h3>{title}</h3>
      {meta && <div className="cameo-media-card-meta">{meta}</div>}
      {children}
    </article>
  );
}
export function ProfileCard({
  avatar,
  name,
  description,
  children,
}: {
  avatar: ReactNode;
  name: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <Card className="cameo-profile-card">
      {avatar}
      <h3>{name}</h3>
      {description && <p>{description}</p>}
      {children}
    </Card>
  );
}
export function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <dl className="cameo-info-card">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </dl>
  );
}
export function StatsCard({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="cameo-stats-card">
      {items.map(item => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
