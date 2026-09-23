import { siteConfig } from '@/app/config/site';

const Footer = () => {
    return (
        <footer className="layout-footer">
            <p className="text-sm text-muted-foreground">
                {siteConfig.name} · Replace this footer with product links, legal pages, or release
                metadata when the new project starts.
            </p>
        </footer>
    );
};

export default Footer;
