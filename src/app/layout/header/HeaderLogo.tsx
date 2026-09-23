import { Link } from 'react-router';
import { siteConfig } from '@/app/config/site';

const HeaderLogo = ({ onNavigate }: { onNavigate?: () => void }) => {
    return (
        <Link onClick={onNavigate} to="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
                {siteConfig.shortName}
            </span>
            <span className="grid leading-tight">
                <span className="text-sm font-semibold tracking-tight">{siteConfig.name}</span>
                <span className="text-xs text-muted-foreground">{siteConfig.repositoryLabel}</span>
            </span>
        </Link>
    );
};

export default HeaderLogo;
