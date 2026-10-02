import { siteConfig } from '@/app/config/site';

const Footer = () => {
  return (
    <footer className="layout-footer">
      <p className="text-sm text-muted-foreground">{siteConfig.name} · 실시간 협업 캔버스</p>
    </footer>
  );
};

export default Footer;
