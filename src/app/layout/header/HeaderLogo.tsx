import { Link } from 'react-router';
import { siteConfig } from '@/app/config/site';

const HeaderLogo = ({ onNavigate }: { onNavigate?: () => void }) => {
  return (
    <Link
      onClick={onNavigate}
      to="/"
      aria-label={siteConfig.name}
      className="flex min-w-0 items-center gap-3"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
        {siteConfig.shortName}
      </span>
      <span className="layout-header-logo-copy grid min-w-0 leading-tight">
        <span className="truncate text-sm font-semibold tracking-tight">{siteConfig.name}</span>
        <span className="truncate text-xs text-muted-foreground">{siteConfig.repositoryLabel}</span>
      </span>
    </Link>
  );
};

export default HeaderLogo;
